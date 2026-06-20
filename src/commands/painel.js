// src/commands/painel.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('⚙️ Abre a Central de Controle e Analytics da KodaAI'),
    
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Central de Controle KodaAI')
      .setDescription('Navegue pelo painel de controlo selecionando uma das opções abaixo:')
      .setColor('#2b2d31')
      .addFields(
        { 
          name: '📊 Dashboard de Analytics', 
          value: "```yaml\nVisualize o tráfego de mensagens, retenção de membros e obtenha consultoria gerada por IA.\n
```" 
        },
        { 
          name: '💬 Resposta a Menções', 
          value: "```yaml\nAtive para que a KodaAI responda no chat quando for mencionada (Consome mais tokens).\n```" 
        },
        { 
          name: '❓ Central de Ajuda', 
          value: "```yaml\nDescubra como os radares de texto e visão protegem o seu servidor.\n
```" 
        },
        { 
          name: '💎 Gestão VIP', 
          value: "```yaml\nGerencie funcionalidades Premium como OCR avançado e Moderação Automática.\n```" 
        }
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('menu_analytics').setLabel('Analytics').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
      new ButtonBuilder().setCustomId('toggle_mention').setLabel('IA Respostas').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
      new ButtonBuilder().setCustomId('menu_help').setLabel('Ajuda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
      new ButtonBuilder().setCustomId('vip_dashboard').setLabel('Upgrade VIP').setStyle(ButtonStyle.Success).setEmoji('💎')
    );

    await interaction.editReply({ embeds: [embed], components: [row1] });
  }
};