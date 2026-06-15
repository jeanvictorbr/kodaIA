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
    
    // Filtro para capturar a primeira imagem anexada (se houver)
    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));

    // Se não tiver texto suspeito E não tiver imagem, passa reto (Economiza banco e processamento)
    if (!hasLink && !hasSuspiciousWords && !imageAttachment) return;

    try {
      const dbGuild = await prisma.guild.findUnique({
        where: { id: message.guild.id }
      });

      if (!dbGuild || !dbGuild.logChannelId) return;

      const tier = dbGuild.vip ? 'VIP' : 'FREE';
      let analysis = { isThreat: false };

      // ==========================================
      // 💎 MÓDULO VIP: Análise de Imagem (OCR)
      // ==========================================
      if (imageAttachment && tier === 'VIP') {
        // Trava de segurança: Evita estourar a RAM com imagens maiores que 5MB
        if (imageAttachment.size > 5 * 1024 * 1024) return;

        // Baixa a imagem direto para a memória RAM (ArrayBuffer)
        const response = await axios.get(imageAttachment.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);

        analysis = await KodaAIEngine.analyzeImage(imageBuffer, imageAttachment.contentType);
      } 
      // ==========================================
      // 🆓 MÓDULO FREE: Análise de Texto
      // ==========================================
      else if (hasLink || hasSuspiciousWords) {
        analysis = await KodaAIEngine.analyzeText(message.content, tier);
      }

      // ==========================================
      // 🚨 EXECUTANDO A PUNIÇÃO E GERANDO LOG
      // ==========================================
      if (analysis.isThreat) {
        await message.delete().catch(() => {});

        const alertMsg = await message.channel.send({
          content: `⚠️ <@${message.author.id}>, ${KodaAIEngine.getRandomPhrase('threatDeleted')}`
        });

        setTimeout(() => alertMsg.delete().catch(() => {}), 10000);

        const logChannel = message.guild.channels.cache.get(dbGuild.logChannelId);
        
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(analysis.type === 'FAKE_PRINT' || analysis.type === 'IMAGE_SCAM' ? '📸 Fraude Visual Interceptada' : '🚨 Ameaça Neutralizada')
            .setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
              { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
              { name: '🛑 Tipo', value: `\`${analysis.type}\``, inline: true },
              { name: '🤖 Análise Forense KodaAI', value: analysis.reason, inline: false }
            )
            .setFooter({ text: `Confiança da IA: ${analysis.confidence}% | Nível: ${tier}` })
            .setTimestamp();

          // Se for imagem, adiciona a miniatura no Log da Staff para provar o bloqueio
          if (imageAttachment && (analysis.type === 'FAKE_PRINT' || analysis.type === 'IMAGE_SCAM')) {
             logEmbed.setThumbnail(imageAttachment.url);
          } else if (message.content) {
             logEmbed.addFields({ name: '💬 Texto', value: `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false });
          }

          await logChannel.send({ embeds: [logEmbed] });
        }

        // Ficha Suja no Banco Global
        await prisma.globalReputation.upsert({
          where: { userId: message.author.id },
          update: { trustScore: { decrement: 15 }, flags: { increment: 1 }, lastOffense: new Date() },
          create: { userId: message.author.id, trustScore: 85, flags: 1, lastOffense: new Date() }
        });
      }

    } catch (error) {
      console.error('🚨 [messageCreate] Erro no radar de ameaças:', error);
    }
  }
};