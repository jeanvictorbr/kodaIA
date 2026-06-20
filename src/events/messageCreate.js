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
    
    // ==========================================
    // 🛡️ MOTOR ANTI-BYPASS DE TOXICIDADE (Nível: Paranoia)
    // ==========================================
    // 1. Remove acentos (cuzão -> cuzao)
    // 2. Converte Leetspeak comum para letras (0->o, 4/@->a, 3->e, 1/!->i)
    // 3. Remove pontuações de disfarce (c.u.z.a.o -> cuzao)
    const normalizedText = content
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/0/g, 'o')
      .replace(/[@4]/g, 'a')
      .replace(/3/g, 'e')
      .replace(/[1!]/g, 'i')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/[.,_*\-\|/]/g, ''); // Limpa sujeira entre as letras

    // Dicionário Gigante + Variações do Print
    const toxicRegex = /\b(cuzao|cusao|cusam|vadia|vadio|coco|vagabunda|vagabundo|vagabund|arrombado|arrombada|arrombad|fdp|puta|puto|corno|corna|merda|desgraca|desgracado|viado|veado|retardado|retardada|macaco|lixo|foder|foda|caralho|buceta|pica|rola|cacete|babaca|otario|idiota|imbecil|vsf|tnc|krl|pqp|vtc|filhodaputa|rapariga|preto|niga|tmnc|verme|cadela)\b/i;
    
    const hasToxicWords = toxicRegex.test(normalizedText);
    
    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));

    // Se a mensagem for limpa, ignora e poupa processamento
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
      } 
      // 🚀 PUNIÇÃO LOCAL IMEDIATA DE PALAVRÕES (Não passa pela IA)
      else if (hasToxicWords) {
        analysis = {
          isThreat: true,
          type: 'SEVERE_INSULT',
          reason: 'Filtro Heurístico Local Avançado: Detecção direta de palavras de baixo calão ou evasões (Leetspeak/Variações) detectadas. Punição aplicada nativamente.',
          confidence: 100,
          suggestTimeout: true
        };
      } 
      // Se for esquema/golpe de texto, envia para a IA
      else if (hasLink || hasSuspiciousWords) {
        analysis = await KodaAIEngine.analyzeText(message.content, tier);
      }

      // ==========================================
      // 🚨 APLICAÇÃO DO CASTIGO E GERAÇÃO DE LOG
      // ==========================================
      if (analysis.isThreat) {
        await message.delete().catch(() => {});

        let timeoutApplied = false;
        // Castigo VIP: Muta o infrator por 10 Minutos
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

        // Resgata o canal de log do banco (ou força pela API se sumir da memória)
        const logChannel = message.guild.channels.cache.get(dbGuild.logChannelId) || await message.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(imageAttachment ? '📸 Fraude/Conteúdo Impróprio Bloqueado' : '🚨 Ameaça/Toxicidade Neutralizada')
            .setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
              { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
              { name: '🛑 Tipo', value: `\`${analysis.type || 'Ameaça'}\``, inline: true },
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

          await logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("🚨 Falha ao enviar Log Embed:", err));
        }

        // Ficha Criminal Global (Aplica a golpistas, mas ignora boca suja pra não foder o rank da pessoa à toa)
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