// src/commands/dev.js
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// ⚠️ COLOQUE O SEU ID DO DISCORD AQUI PARA BLINDAR O COMANDO
const DEVELOPER_ID = 'SEU_ID_AQUI'; 

export default {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('💻 [Owner] Terminal Global de Administração da KodaAI'),
    
  async execute(interaction, client) {
    // 🔒 Barreira de Segurança Suprema
    if (interaction.user.id !== DEVELOPER_ID) {
      return interaction.reply({ 
        content: '❌ **Acesso Negado.** Este terminal é restrito à arquitetura de desenvolvimento.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // 📊 Coleta de Métricas do Sistema em Tempo Real
    const ping = client.ws.ping;
    const uptime = (client.uptime / 1000 / 60 / 60).toFixed(1); // Em horas
    const ramUsada = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const limiteRam = 150; // Limite do seu discloud.config
    
    const ramStatus = ramUsada > 120 ? '🔴 CRÍTICO' : ramUsada > 90 ? '🟡 ALERTA' : '🟢 ESTÁVEL';

    // 🖥️ UI Nativa do Terminal
    const terminalUI = `## 💻 Terminal do Desenvolvedor
*Módulo de Administração Global KodaAI*

**📡 Status do Sistema Motor:**
\`\`\`yaml
Latência (Ping) : ${ping}ms
Uptime          : ${uptime} Horas Online
Memória (RAM)   : ${ramUsada}MB / ${limiteRam}MB [${ramStatus}]
\`\`\`

Selecione um dos módulos de gestão abaixo para operar a infraestrutura:`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dev_metrics').setLabel('Métricas Globais').setStyle(ButtonStyle.Primary).setEmoji('📊'),
      new ButtonBuilder().setCustomId('dev_vip_manager').setLabel('Gestão VIP').setStyle(ButtonStyle.Success).setEmoji('💎'),
      new ButtonBuilder().setCustomId('dev_refresh').setLabel('Atualizar Rede').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
    );

    await interaction.editReply({ content: terminalUI, components: [row] });
  }
};