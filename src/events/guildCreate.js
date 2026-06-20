// src/events/guildCreate.js
import { EmbedBuilder, ChannelType } from 'discord.js';
import prisma from '../database/prisma.js';

export default {
  name: 'guildCreate',
  once: false,
  async execute(guild) {
    try {
      // Registra o servidor automaticamente no banco de dados assim que entra
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: {},
        create: { id: guild.id }
      });

      // Procura o primeiro canal de texto onde a IA tem permissão para falar
      const channel = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildText && 
        c.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
      );

      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('👋 Olá! Eu sou a KodaAI.')
        .setDescription('Obrigado por me adicionar. Eu sou um sistema avançado de inteligência artificial focado em proteger a sua comunidade contra Raids, Scams, links maliciosos e toxicidade.')
        .setColor('#00FFFF')
        .addFields(
          { name: '🛡️ Como começar?', value: 'Para que a proteção funcione, precisa de me configurar. Digite o comando `/setup` para criar a base de operações.' },
          { name: '📊 Analytics e Dashboard', value: 'Após configurar, use `/painel` para aceder ao terminal nativo de métricas, gerir a IA e receber consultoria.' }
        )
        .setFooter({ text: 'Apenas Administradores podem usar os comandos de configuração.' });

      await channel.send({ embeds: [embed] });
      console.log(`🟢 [Onboarding] KodaAI entrou no servidor: ${guild.name}`);
    } catch (error) {
      console.error(`🚨 Erro ao entrar no servidor ${guild.id}:`, error);
    }
  }
};