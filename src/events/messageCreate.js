// src/events/messageCreate.js
import { EmbedBuilder } from 'discord.js';
import axios from 'axios';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const content = message.content.toLowerCase();
    const hasLink = /https?:\/\/[^\s]+/.test(content);
    const hasSuspiciousWords = /(nitro.*free|steam.*gift|discord.*promo|clique.*aqui)/.test(content);
    const hasToxicWords = /(lixo|macaco|fdp|cuzão|arrombado|retardado|viado|vagabundo|morre|mata|preto|puta|corno|merda|desgraça)/i.test(content);
    
    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));

    if (!hasLink && !hasSuspiciousWords && !hasToxicWords && !imageAttachment) return;

    try {
      const dbGuild = await prisma.guild.findUnique({
        where: { id: message.guild.id }
      });

      if (!dbGuild || !dbGuild.logChannelId) return;

      const tier = dbGuild.vip ? 'VIP' : 'FREE';
      let analysis = { isThreat: false };

      if (imageAttachment && tier === 'VIP') {
        if (imageAttachment.size > 5 * 1024 * 1024) return;

        const response = await axios.get(imageAttachment.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);

        analysis = await KodaAIEngine.analyzeImage(imageBuffer, imageAttachment.contentType);
      } else if (hasLink || hasSuspiciousWords || hasToxicWords) {
        analysis = await KodaAIEngine.analyzeText(message.content, tier);
      }

      if (analysis.isThreat) {
        await message.delete().catch(() => {});

        let timeoutApplied = false;
        if (tier === 'VIP' && analysis.suggestTimeout) {
          try {
            await message.member.timeout(10 * 60 * 1000, `KodaAI Automoderation: ${analysis.type}`);
            timeoutApplied = true;
            await message.author.send(`⚠️ Você foi silenciado no servidor **${message.guild.name}** por 10 minutos devido a comportamento tóxico. Esfrie a cabeça!`).catch(()=>{});
          } catch (e) {
            console.log('⚠️ [KodaAI] O bot não tem permissão para dar Timeout neste usuário.');
          }
        }

        let phraseType = 'threatDeleted';
        if (imageAttachment) phraseType = 'imageThreatDeleted';
        if (analysis.type === 'TOXICITY' || analysis.type === 'SEVERE_INSULT') phraseType = 'toxicityDeleted';

        const alertMsg = await message.channel.send({
          content: `⚠️ <@${message.author.id}>, ${KodaAIEngine.getRandomPhrase(phraseType)}`
        });

        setTimeout(() => alertMsg.delete().catch(() => {}), 10000);

        // 🟢 CORREÇÃO: Força o bot a procurar o canal na API (fetch) se não estiver na RAM (cache)
        const logChannel = message.guild.channels.cache.get(dbGuild.logChannelId) || await message.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(imageAttachment ? '📸 Fraude/Conteúdo Impróprio Bloqueado' : '🚨 Ameaça/Toxicidade Neutralizada')
            .setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
              { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
              { name: '🛑 Tipo', value: `\`${analysis.type || 'Ameaça'}\``, inline: true },
              // Proteção contra falhas da IA omitir a string de razão
              { name: '🤖 Análise Forense KodaAI', value: analysis.reason || 'Análise direta executada sem justificativa extensa.', inline: false }
            )
            .setFooter({ text: `Confiança da IA: ${analysis.confidence || 100}% | Nível: ${tier}` })
            .setTimestamp();

          if (timeoutApplied) {
            logEmbed.addFields({ name: '⏱️ Ação VIP Automática', value: 'Usuário recebeu **Timeout de 10 Minutos** para acalmar os ânimos.', inline: false });
          }

          if (imageAttachment) {
             logEmbed.setThumbnail(imageAttachment.url);
          } else if (message.content) {
             logEmbed.addFields({ name: '💬 Texto Apagado', value: `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false });
          }

          // Adicionado catch para garantir que erros de permissão de envio não crashem o radar silenciosamente
          await logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("🚨 Falha ao enviar Log Embed:", err));
        }

        if (analysis.type !== 'TOXICITY' && analysis.type !== 'SEVERE_INSULT') {
          await prisma.globalReputation.upsert({
            where: { userId: message.author.id },
            update: { trustScore: { decrement: 15 }, flags: { increment: 1 }, lastOffense: new Date() },
            create: { userId: message.author.id, trustScore: 85, flags: 1, lastOffense: new Date() }
          });
        }
      }

    } catch (error) {
      console.error('🚨 [messageCreate] Erro no radar de ameaças:', error);
    }
  }
};