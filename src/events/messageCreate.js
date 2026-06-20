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
    } catch (e) { }

    let dbGuild = await prisma.guild.findUnique({ where: { id: message.guild.id } });
    if (!dbGuild) dbGuild = await prisma.guild.create({ data: { id: message.guild.id } });

    // 💬 IA: RESPOSTA A MENÇÕES
    if (message.mentions.has(client.user.id) && !message.reference && dbGuild.respondMentions) {
      const cleanContent = message.content.replace(`<@${client.user.id}>`, '').trim();
      
      if (cleanContent.length > 0) {
        try {
            await message.channel.sendTyping();
            
            const systemPrompt = `Você é a KodaAI, o sistema de segurança e moderação mais letal e inteligente do Discord.
Regras de conduta: Responda de forma curta, levemente sarcástica e direta. NUNCA invente comandos ou funções. Baseie-se apenas nisto:

Suas Funções:
1. Radar de Texto (Grátis): Bloqueia phishing, links suspeitos, golpes (ex: nitro free) e toxicidade/palavrões.
2. Radar Visual (Módulo VIP): Lê imagens (OCR) para bloquear prints de PIX falsos, pornografia (NSFW) e gore.
3. Anti-Raid: Avalia a idade e reputação global de membros novos.

Seus Comandos Oficiais:
- /setup : O comando mais importante. O dono usa isso para configurar o canal de logs e ativar a segurança.
- /painel : Abre o dashboard nativo de Analytics, Consultoria de IA e botões de configuração (como ativar você no chat).
- /dev : Painel restrito apenas para o seu criador gerenciar acessos VIP.

Como Configurar:
Se perguntarem como te configurar, diga que o Administrador só precisa digitar "/setup" para criar a base de operações automaticamente, e "/painel" para ver os gráficos.`;

            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
              model: "llama-3.1-8b-instant",
              messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: cleanContent }
              ],
              temperature: 0.5 
            }, {
              headers: { 'Authorization': `Bearer ${process.env.LLAMA_API_KEY}`, 'Content-Type': 'application/json' },
              timeout: 10000
            });
            
            await message.reply(response.data.choices[0].message.content);
            return; 
        } catch(e) { console.error("Falha ao responder menção:", e.message); }
      }
    }

    if (!dbGuild.logChannelId) return;

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
        analysis = { isThreat: true, type: 'SEVERE_INSULT', reason: 'Filtro Local Avançado: Palavra de baixo calão ou evasão detectada.', confidence: 100, suggestTimeout: true };
      } else if (hasLink || hasSuspiciousWords) {
        analysis = await KodaAIEngine.analyzeText(message.content, tier);
      }

      if (analysis.isThreat) {
        // 🛡️ NOVO: Tratamento de erro elegante de Permissões
        let actionError = null;
        let timeoutApplied = false;

        try {
          if (message.deletable) await message.delete();
          else actionError = 'A KodaAI não possui permissão para apagar mensagens neste canal.';
        } catch (e) { actionError = 'Falha ao apagar mensagem.'; }
        
        if (tier === 'VIP' && analysis.suggestTimeout) {
          try {
            if (message.member && message.member.manageable) {
              await message.member.timeout(10 * 60 * 1000, `KodaAI: ${analysis.type}`);
              timeoutApplied = true;
              await message.author.send(`⚠️ Você foi silenciado em **${message.guild.name}** por 10 minutos devido a comportamento tóxico. Esfrie a cabeça!`).catch(()=>{});
            } else {
              actionError = actionError ? actionError + '\nO membro tem um cargo superior à KodaAI (Impossível aplicar Timeout).' : 'O membro tem um cargo superior à KodaAI (Impossível aplicar Timeout).';
            }
          } catch (e) { }
        }

        let phraseType = imageAttachment ? 'imageThreatDeleted' : (analysis.type === 'TOXICITY' || analysis.type === 'SEVERE_INSULT' ? 'toxicityDeleted' : 'threatDeleted');
        const alertMsg = await message.channel.send({ content: `⚠️ <@${message.author.id}>, ${KodaAIEngine.getRandomPhrase(phraseType)}` }).catch(()=>{});
        if(alertMsg) setTimeout(() => alertMsg.delete().catch(() => {}), 10000);

        const logChannel = message.guild.channels.cache.get(dbGuild.logChannelId) || await message.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(imageAttachment ? '📸 Impróprio Detectado' : '🚨 Ameaça Detectada').setColor(actionError ? '#E67E22' : '#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
              { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
              { name: '🛑 Tipo', value: `\`${analysis.type || 'Ameaça'}\``, inline: true },
              { name: '🤖 Análise KodaAI', value: analysis.reason || 'Executada nativamente.', inline: false }
            ).setTimestamp();
          
          if (timeoutApplied) logEmbed.addFields({ name: '⏱️ Ação VIP', value: '**Timeout de 10 Minutos aplicado**.', inline: false });
          if (actionError) logEmbed.addFields({ name: '⚠️ Falha na Ação Automática', value: actionError, inline: false });
          
          if (imageAttachment) logEmbed.setThumbnail(imageAttachment.url);
          else if (message.content) logEmbed.addFields({ name: '💬 Mensagem Original', value: `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false });

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