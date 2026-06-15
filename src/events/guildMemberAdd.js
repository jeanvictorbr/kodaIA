// src/events/guildMemberAdd.js
import { EmbedBuilder } from 'discord.js';
import prisma from '../database/prisma.js';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    if (member.user.bot) return; // Ignora outros bots

    try {
      // 1. Pega as configs do Servidor e a Ficha Global do cara no nosso banco
      const [dbGuild, userReputation] = await Promise.all([
        prisma.guild.findUnique({ where: { id: member.guild.id } }),
        prisma.globalReputation.findUnique({ where: { userId: member.id } })
      ]);

      // Se o server não tem a KodaAI configurada, não fazemos nada
      if (!dbGuild || !dbGuild.logChannelId) return;

      // 2. Lógica Anti-Raid Heurística (O cálculo matemático do risco)
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

      // 3. Ação Baseada no Risco
      const logChannel = member.guild.channels.cache.get(dbGuild.logChannelId);

      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        // Se for servidor VIP, a gente pode dar Kick/Ban automático aqui. 
        // No FREE, a gente alerta a Staff de forma agressiva.
        
        if (logChannel) {
          const alertEmbed = new EmbedBuilder()
            .setTitle('🛡️ Alerta de Segurança Anti-Raid')
            .setColor(riskLevel === 'CRITICAL' ? '#992D22' : '#E67E22') // Vermelho escuro ou Laranja
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Um usuário de alto risco acabou de entrar no servidor. Fiquem de olho.`)
            .addFields(
              { name: '👤 Usuário', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
              { name: '📅 Idade da Conta', value: `${accountAgeDays} dia(s)`, inline: true },
              { name: '⚠️ Motivo do Alerta', value: reason.join('\n'), inline: false }
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