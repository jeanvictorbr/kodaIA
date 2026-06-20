// src/commands/painel.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../database/prisma.js';

export default {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('⚙️ Abre a Central de Controle e Analytics da KodaAI'),
    
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // 🟢 Busca os dados do servidor para mostrar o status real
    let dbGuild = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
    if (!dbGuild) dbGuild = await prisma.guild.create({ data: { id: interaction.guildId } });

    const iaStatus = dbGuild.respondMentions ? '🟢 ATIVADO' : '🔴 DESATIVADO';
    const vipStatus = dbGuild.vip ? '💎 ATIVO' : '🆓 FREE';

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Central de Controle KodaAI')
      .setDescription('Navegue pelo painel de controlo selecionando uma das opções abaixo:')
      .setColor('#2b2d31')
      .addFields(
        { 
          name: '📊 Dashboard de Analytics', 
          value: `\`\`\`yaml\nVisualize o tráfego de mensagens, retenção e obtenha consultoria gerada por IA.\n\`\`\``
        },
        { 
          name: `💬 Resposta a Menções [${iaStatus}]`, 
          value: `\`\`\`yaml\nAtive para que a KodaAI responda no chat quando for mencionada.\n\`\`\``
        },
        { 
          name: `💎 Gestão VIP [${vipStatus}]`, 
          value: `\`\`\`yaml\nGerencie funcionalidades Premium como OCR avançado e Moderação Automática.\n\`\`\``
        },
        { 
          name: '❓ Central de Ajuda', 
          value: `\`\`\`yaml\nDescubra como os radares de texto e visão protegem o seu servidor.\n\`\`\``
        }
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('menu_analytics').setLabel('Analytics').setStyle(ButtonStyle.Primary).setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('toggle_mention')
        .setLabel(dbGuild.respondMentions ? 'Desativar IA' : 'Ativar IA')
        .setStyle(dbGuild.respondMentions ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji('💬'),
      new ButtonBuilder().setCustomId('menu_help').setLabel('Ajuda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
      new ButtonBuilder().setCustomId('vip_dashboard').setLabel('Upgrade VIP').setStyle(ButtonStyle.Secondary).setEmoji('💎')
    );

    await interaction.editReply({ embeds: [embed], components: [row1] });
  }
};