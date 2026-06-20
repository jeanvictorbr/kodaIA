// src/events/guildMemberAdd.js
import { EmbedBuilder } from 'discord.js';
import prisma from '../database/prisma.js';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const [dbGuild, userReputation] = await Promise.all([
        prisma.guild.findUnique({ where: { id: member.guild.id } }),
        prisma.globalReputation.findUnique({ where: { userId: member.id } })
      ]);

      if (!dbGuild || !dbGuild.logChannelId) return;

      // 📊 ANOTA A ENTRADA (JOINS)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await prisma.dailyAnalytics.upsert({
        where: { guildId_date: { guildId: member.guild.id, date: today } },
        update: { joins: { increment: 1 } },
        create: { guildId: member.guild.id, date: today, joins: 1 }
      }).catch(()=>{});

      // Lógica de Segurança original Anti-Raid...
      const accountAgeMs = Date.now() - member.user.createdTimestamp;
      const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
      let riskLevel = 'LOW';
      let reason = [];

      if (accountAgeDays < 3) { riskLevel = 'HIGH'; reason.push('Conta criada há menos de 3 dias.'); }
      if (userReputation && userReputation.trustScore < 50) {
        riskLevel = 'CRITICAL'; reason.push(`Ficha Suja Global: Reputação (${userReputation.trustScore}/100).`);
      }

      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        const logChannel = member.guild.channels.cache.get(dbGuild.logChannelId) || await member.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        let actionTaken = 'Nenhuma ação automática.';

        if (dbGuild.vip && riskLevel === 'CRITICAL') {
          try {
            await member.kick('KodaAI VIP: Risco Crítico de Raid.');
            actionTaken = '🥾 **KICK AUTOMÁTICO**';
          } catch (e) { actionTaken = 'Falha ao kickar.'; }
        }
        
        if (logChannel) {
          const alertEmbed = new EmbedBuilder()
            .setTitle('🛡️ Alerta Anti-Raid').setColor(riskLevel === 'CRITICAL' ? '#992D22' : '#E67E22')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: '👤 Usuário', value: `${member.user.tag}`, inline: true },
              { name: '📅 Idade', value: `${accountAgeDays} dias`, inline: true },
              { name: '⚠️ Motivo', value: reason.join('\n'), inline: false },
              { name: '🤖 Ação', value: actionTaken, inline: false }
            ).setTimestamp();
          await logChannel.send({ embeds: [alertEmbed] });
        }
      }
    } catch (error) { console.error('🚨 Erro Anti-Raid:', error); }
  }
};