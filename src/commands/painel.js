// src/commands/painel.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('⚙️ Abre a Central de Controle e Analytics da KodaAI'),
    
  async execute(interaction) {
    // 🔒 Torna o painel EPHEMERAL (Invisível para os outros membros)
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Central de Controle KodaAI')
      .setDescription('Bem-vindo ao painel de controle nativo. Escolha o módulo que deseja acessar abaixo:')
      .setColor('#2b2d31')
      .addFields(
        { name: '📊 Analytics (FREE)', value: 'Acesse o gráfico de engajamento, métricas de retenção e consultoria da nossa Inteligência Artificial.' },
        { name: '❓ Ajuda e Comandos', value: 'Descubra como a KodaAI protege seu servidor, os radares ativos e como utilizar os comandos.' },
        { name: '💎 Módulo VIP', value: 'Gerencie OCR, limites e punições automáticas (Timeouts e Kicks).' }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('menu_analytics').setLabel('Analytics').setStyle(ButtonStyle.Primary).setEmoji('📊'),
      new ButtonBuilder().setCustomId('menu_help').setLabel('Ajuda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
      new ButtonBuilder().setCustomId('vip_dashboard').setLabel('Upgrade VIP').setStyle(ButtonStyle.Success).setEmoji('💎')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
};