// src/events/guildMemberRemove.js
import prisma from '../database/prisma.js';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const dbGuild = await prisma.guild.findUnique({ where: { id: member.guild.id } });
      if (!dbGuild) return;

      // 📊 ANOTA A SAÍDA (LEAVES)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      await prisma.dailyAnalytics.upsert({
          where: { guildId_date: { guildId: member.guild.id, date: today } },
          update: { leaves: { increment: 1 } },
          create: { guildId: member.guild.id, date: today, leaves: 1 }
      });
    } catch (error) {
      console.error('🚨 [guildMemberRemove] Erro ao registrar leave:', error);
    }
  }
};