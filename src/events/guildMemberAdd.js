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

      const accountAgeMs = Date.now() - member.user.createdTimestamp;
      const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
      
      let riskLevel = 'LOW';
      let reason = [];

      if (accountAgeDays < 3) {
        riskLevel = 'HIGH';
        reason.push('Conta criada há menos de 3 dias.');
      }

      if (userReputation && userReputation.trustScore < 50) {
        riskLevel = 'CRITICAL';
        reason.push(`Ficha Suja Global: Reputação baixa (${userReputation.trustScore}/100) por enviar scams em outros servidores.`);
      }

      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        // 🟢 CORREÇÃO: Força o bot a procurar o canal com fetch
        const logChannel = member.guild.channels.cache.get(dbGuild.logChannelId) || await member.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
        let actionTaken = 'Nenhuma ação automática (Servidor FREE ou Risco apenas Alto).';

        if (dbGuild.vip && riskLevel === 'CRITICAL') {
          try {
            await member.kick('KodaAI VIP: Risco Crítico de Raid detectado na entrada.');
            actionTaken = '🥾 **KICK APLICADO AUTOMATICAMENTE** (Modo VIP Anti-Raid)';
          } catch (e) {
            actionTaken = 'Falha ao aplicar Kick automático (Falta de permissão do Bot ou hierarquia de cargos).';
          }
        }
        
        if (logChannel) {
          const alertEmbed = new EmbedBuilder()
            .setTitle('🛡️ Alerta de Segurança Anti-Raid')
            .setColor(riskLevel === 'CRITICAL' ? '#992D22' : '#E67E22')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Um usuário de alto risco acabou de entrar no servidor. Fiquem de olho.`)
            .addFields(
              { name: '👤 Usuário', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
              { name: '📅 Idade da Conta', value: `${accountAgeDays} dia(s)`, inline: true },
              { name: '⚠️ Motivo do Alerta', value: reason.join('\n'), inline: false },
              { name: '🤖 Ação da KodaAI', value: actionTaken, inline: false }
            )
            .setFooter({ text: 'KodaAI - Monitoramento de Entrada' })
            .setTimestamp();

          await logChannel.send({ embeds: [alertEmbed] });
        }
      }

    } catch (error) {
      console.error('🚨 [guildMemberAdd] Erro no módulo Anti-Raid:', error);
    }
  }
};