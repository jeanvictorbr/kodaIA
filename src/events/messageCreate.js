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

    // 📊 RASTREAMENTO DE ENGAJAMENTO
    try {
      const dbGuild = await prisma.guild.findUnique({ where: { id: message.guild.id } });
      if (dbGuild) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        await prisma.dailyAnalytics.upsert({
          where: { guildId_date: { guildId: message.guild.id, date: today } },
          update: { messages: { increment: 1 } },
          create: { guildId: message.guild.id, date: today, messages: 1 }
        });
      }
    } catch (e) { /* Falha silenciosa pra não travar o bot */ }

    const content = message.content.toLowerCase();
    const hasLink = /https?:\/\/[^\s]+/.test(content);
    const hasSuspiciousWords = /(nitro.*free|steam.*gift|discord.*promo|clique.*aqui)/.test(content);
    
    const normalizedText = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/0/g, 'o').replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!]/g, 'i').replace(/5/g, 's').replace(/7/g, 't').replace(/[.,_*\-\|/]/g, '');
    const toxicRegex = /\b(cuzao|cusao|cusam|vadia|vadio|coco|vagabunda|vagabundo|vagabund|arrombado|arrombada|arrombad|fdp|puta|puto|corno|corna|merda|desgraca|desgracado|viado|veado|retardado|retardada|macaco|lixo|foder|foda|caralho|buceta|pica|rola|cacete|babaca|otario|idiota|imbecil|vsf|tnc|krl|pqp|vtc|filhodaputa|rapariga|cadela)\b/i;
    const hasToxicWords = toxicRegex.test(normalizedText);
    
    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (!hasLink && !hasSuspiciousWords && !hasToxicWords && !imageAttachment) return;

    try {
      const dbGuild = await prisma.guild.findUnique({ where: { id: message.guild.id } });
      if (!dbGuild || !dbGuild.logChannelId) return;

      const tier = dbGuild.vip ? 'VIP' : 'FREE';
      let analysis = { isThreat: false };

      if (imageAttachment && tier === 'VIP') {
        if (imageAttachment.size > 5 * 1024 * 1024) return;
        const response = await axios.get(imageAttachment.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        analysis = await KodaAIEngine.analyzeImage(imageBuffer, imageAttachment.contentType);
      } else if (hasToxicWords) {
        analysis = { isThreat: true, type: 'SEVERE_INSULT', reason: 'Filtro Local: Palavra de baixo calão detectada.', confidence: 100, suggestTimeout: true };
      } else if (hasLink || hasSuspiciousWords) {
        analysis = await KodaAIEngine.analyzeText(message.content, tier);
      }

      if (analysis.isThreat) {
        await message.delete().catch(() => {});
        let timeoutApplied = false;
        
        if (tier === 'VIP' && analysis.suggestTimeout) {
          try {
            await message.member.timeout(10 * 60 * 1000, `KodaAI: ${analysis.type}`);
            timeoutApplied = true;
            await message.author.send(`⚠️ Você foi silenciado em **${message.guild.name}** por comportamento tóxico.`).catch(()=>{});
          } catch (e) { }
        }

        let phraseType = imageAttachment ? 'imageThreatDeleted' : (analysis.type === 'TOXICITY' || analysis.type === 'SEVERE_INSULT' ? 'toxicityDeleted' : 'threatDeleted');
        const alertMsg = await message.channel.send({ content: `⚠️ <@${message.author.id}>, ${KodaAIEngine.getRandomPhrase(phraseType)}` });
        setTimeout(() => alertMsg.delete().catch(() => {}), 10000);

        const logChannel = message.guild.channels.cache.get(dbGuild.logChannelId) || await message.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(imageAttachment ? '📸 Impróprio Bloqueado' : '🚨 Ameaça Neutralizada').setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
              { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
              { name: '🛑 Tipo', value: `\`${analysis.type || 'Ameaça'}\``, inline: true },
              { name: '🤖 Análise KodaAI', value: analysis.reason || 'Executada.', inline: false }
            ).setTimestamp();
          if (timeoutApplied) logEmbed.addFields({ name: '⏱️ Ação VIP', value: '**Timeout de 10 Minutos**.', inline: false });
          if (imageAttachment) logEmbed.setThumbnail(imageAttachment.url);
          else if (message.content) logEmbed.addFields({ name: '💬 Texto', value: `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false });

          await logChannel.send({ embeds: [logEmbed] }).catch(()=>{});
        }

        if (analysis.type !== 'TOXICITY' && analysis.type !== 'SEVERE_INSULT') {
          await prisma.globalReputation.upsert({
            where: { userId: message.author.id },
            update: { trustScore: { decrement: 15 }, flags: { increment: 1 }, lastOffense: new Date() },
            create: { userId: message.author.id, trustScore: 85, flags: 1, lastOffense: new Date() }
          });
        }
      }
    } catch (error) { console.error('🚨 Erro radar:', error); }
  }
};