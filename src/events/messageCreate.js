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

    // 1. Carrega ou cria Guild no banco
    let dbGuild = await prisma.guild.findUnique({ where: { id: message.guild.id } });
    if (!dbGuild) dbGuild = await prisma.guild.create({ data: { id: message.guild.id } });

    // 2. Rastreamento Analítico
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await prisma.dailyAnalytics.upsert({
        where: { guildId_date: { guildId: message.guild.id, date: today } },
        update: { messages: { increment: 1 } },
        create: { guildId: message.guild.id, date: today, messages: 1 }
      });
    } catch (e) { /* Falha silenciosa */ }

    // 3. IA: Resposta a Menções (Apenas se o dono ativou no Painel)
    if (message.mentions.has(client.user.id) && !message.reference && dbGuild.respondMentions) {
      const cleanContent = message.content.replace(`<@${client.user.id}>`, '').trim();
      
      if (cleanContent.length > 0) {
        try {
            await message.channel.sendTyping(); // Mostra "KodaAI está a escrever..."
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
              model: "llama-3.1-8b-instant",
              messages: [
                  { role: "system", content: "Você é a KodaAI, uma assistente de moderação e segurança. Responda de forma extremamente curta, levemente sarcástica, direta e amigável." },
                  { role: "user", content: cleanContent }
              ],
              temperature: 0.7 
            }, {
              headers: { 'Authorization': `Bearer ${process.env.LLAMA_API_KEY}`, 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            await message.reply(response.data.choices[0].message.content);
            return; // Impede a continuação para não acionar o radar em conversas normais
        } catch(e) { console.error("Falha ao responder menção:", e.message); }
      }
    }

    // 4. Radar de Segurança Base
    if (!dbGuild.logChannelId) return; // Só protege se configurado

    const content = message.content.toLowerCase();
    const hasLink = /https?:\/\/[^\s]+/.test(content);
    const hasSuspiciousWords = /(nitro.*free|steam.*gift|discord.*promo|clique.*aqui)/.test(content);
    
    const normalizedText = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/0/g, 'o').replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!]/g, 'i').replace(/5/g, 's').replace(/7/g, 't').replace(/[.,_*\-\|/]/g, '');
    const toxicRegex = /\b(cuzao|cusao|cusam|vadia|vadio|coco|vagabunda|vagabundo|vagabund|arrombado|arrombada|arrombad|fdp|puta|puto|corno|corna|merda|desgraca|desgracado|viado|veado|retardado|retardada|macaco|lixo|foder|foda|caralho|buceta|pica|rola|cacete|babaca|otario|idiota|imbecil|vsf|tnc|krl|pqp|vtc|filhodaputa|rapariga|cadela)\b/i;
    const hasToxicWords = toxicRegex.test(normalizedText);
    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));

    if (!hasLink && !hasSuspiciousWords && !hasToxicWords && !imageAttachment) return;

    try {
      const tier = dbGuild.vip ? 'VIP' : 'FREE';
      let analysis = { isThreat: false };

      if (imageAttachment && tier === 'VIP') {
        if (imageAttachment.size > 5 * 1024 * 1024) return;
        const response = await axios.get(imageAttachment.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        analysis = await KodaAIEngine.analyzeImage(imageBuffer, imageAttachment.contentType);
      } else if (hasToxicWords) {
        analysis = { isThreat: true, type: 'SEVERE_INSULT', reason: 'Filtro Local Avançado: Palavra de baixo calão detectada.', confidence: 100, suggestTimeout: true };
      } else if (hasLink || hasSuspiciousWords) {
        analysis = await KodaAIEngine.analyzeText(message.content, tier);
      }

      if (analysis.isThreat) {
        await message.delete().catch(() => {});
        let timeoutApplied = false;
        
        if (tier === 'VIP' && analysis.suggestTimeout) {
          try {
            await message.member.timeout(10 * 60 * 1000, `KodaAI Automoderation: ${analysis.type}`);
            timeoutApplied = true;
            await message.author.send(`⚠️ Você foi silenciado em **${message.guild.name}** por 10 minutos devido a comportamento tóxico. Esfrie a cabeça!`).catch(()=>{});
          } catch (e) { }
        }

        let phraseType = imageAttachment ? 'imageThreatDeleted' : (analysis.type === 'TOXICITY' || analysis.type === 'SEVERE_INSULT' ? 'toxicityDeleted' : 'threatDeleted');
        const alertMsg = await message.channel.send({ content: `⚠️ <@${message.author.id}>, ${KodaAIEngine.getRandomPhrase(phraseType)}` });
        setTimeout(() => alertMsg.delete().catch(() => {}), 10000);

        const logChannel = message.guild.channels.cache.get(dbGuild.logChannelId) || await message.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(imageAttachment ? '📸 Fraude/Conteúdo Impróprio Bloqueado' : '🚨 Ameaça/Toxicidade Neutralizada')
            .setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
              { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
              { name: '🛑 Tipo', value: `\`${analysis.type || 'Ameaça'}\``, inline: true },
              { name: '🤖 Análise Forense KodaAI', value: analysis.reason || 'Análise direta executada.', inline: false }
            ).setTimestamp();

          if (timeoutApplied) logEmbed.addFields({ name: '⏱️ Ação VIP Automática', value: 'Usuário recebeu **Timeout de 10 Minutos**.', inline: false });
          if (imageAttachment) logEmbed.setThumbnail(imageAttachment.url);
          else if (message.content) logEmbed.addFields({ name: '💬 Texto Apagado', value: `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false });

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

    } catch (error) { console.error('🚨 Erro no radar:', error); }
  }
};