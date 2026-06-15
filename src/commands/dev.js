// src/commands/dev.js
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('🛠️ Painel do Desenvolvedor KodaAI (Acesso Restrito).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Esconde de membros comuns
    .addSubcommand(subcommand =>
      subcommand
        .setName('vip')
        .setDescription('Ativa ou desativa o status VIP de um servidor.')
        .addStringOption(option =>
          option.setName('servidor_id')
            .setDescription('O ID do Servidor (Guild ID)')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('status')
            .setDescription('True para ativar VIP, False para remover')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Mostra a performance da nave em tempo real.')
    ),

  async execute(interaction, client) {
    // 🔒 TRAVA DE SEGURANÇA ABSOLUTA
    if (interaction.user.id !== process.env.DEV_ID) {
      return interaction.reply({ 
        content: '🚫 Sai fora, Zé! Acesso negado. Esse comando é só pro engenheiro chefe da nave.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // 💎 MÓDULO: GERENCIAR VIP
    // ==========================================
    if (subcommand === 'vip') {
      const guildId = interaction.options.getString('servidor_id');
      const status = interaction.options.getBoolean('status');

      try {
        // Upsert: Atualiza se existir, ou já cria no banco com o VIP ativado
        await prisma.guild.upsert({
          where: { id: guildId },
          update: { vip: status },
          create: { id: guildId, vip: status }
        });

        return interaction.editReply({ 
          content: `✅ **Suave!** O status VIP do servidor \`${guildId}\` foi alterado para: **${status ? 'ATIVADO 💎' : 'DESATIVADO 🆓'}**.\nO módulo de OCR (Visão) já deve estar respondendo lá.` 
        });
      } catch (error) {
        console.error('Erro ao atualizar VIP:', error);
        return interaction.editReply({ content: '❌ Deu B.O ao tentar acessar o banco de dados.' });
      }
    }

    // ==========================================
    // 📊 MÓDULO: STATUS DE PERFORMANCE
    // ==========================================
    if (subcommand === 'status') {
      // Cálculo de RAM sendo usada no momento
      const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const cacheSize = KodaAIEngine.cache.size;

      const embed = new EmbedBuilder()
        .setTitle('🛠️ KodaAI - Telemetria do Sistema')
        .setColor('#2B2D31')
        .addFields(
          { name: '🖥️ Servidores Ativos', value: `\`${client.guilds.cache.size}\``, inline: true },
          { name: '💾 RAM Utilizada', value: `\`${ramUsage} MB\``, inline: true },
          { name: '🧠 Cache da IA (Otimização)', value: `\`${cacheSize} itens\``, inline: true },
          { name: '🟢 Ping da API', value: `\`${client.ws.ping}ms\``, inline: true }
        )
        .setFooter({ text: 'Engenharia de Alta Performance' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};