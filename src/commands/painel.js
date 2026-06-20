// src/commands/painel.js
import { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('📊 Exibe o Dashboard de Engajamento e Consultoria (App Nativo)'),
    
  async execute(interaction) {
    // Mantém a requisição em espera (defer) para dar tempo de desenhar o gráfico
    await interaction.deferReply();

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setUTCHours(0,0,0,0);

      let analytics = await prisma.dailyAnalytics.findMany({
        where: { guildId: interaction.guildId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'asc' }
      });

      // 🟢 CORREÇÃO: Forja dados em branco caso seja um servidor recém adicionado, evitando bloqueios
      if (analytics.length === 0) {
        analytics = [{ date: new Date(), messages: 0, joins: 0, leaves: 0 }];
      }

      const labels = [];
      const messagesData = [];
      const joinsData = [];
      let totalMsgs = 0, totalJoins = 0, totalLeaves = 0;

      analytics.forEach(day => {
        labels.push(`${day.date.getDate()}/${day.date.getMonth()+1}`);
        messagesData.push(day.messages);
        joinsData.push(day.joins);
        totalMsgs += day.messages;
        totalJoins += day.joins;
        totalLeaves += day.leaves;
      });

      const chartConfig = {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Mensagens', data: messagesData, borderColor: '#00ffff', backgroundColor: 'rgba(0, 255, 255, 0.1)', fill: true, tension: 0.4, borderWidth: 3 },
            { label: 'Entradas', data: joinsData, borderColor: '#ff00ff', backgroundColor: 'rgba(255, 0, 255, 0.1)', fill: true, tension: 0.4, borderWidth: 3 }
          ]
        },
        options: {
          plugins: { legend: { labels: { color: '#ffffff', font: { family: 'sans-serif', size: 14 } } }, title: { display: false } },
          scales: { x: { ticks: { color: '#aaaaaa' }, grid: { color: '#333333' } }, y: { ticks: { color: '#aaaaaa' }, grid: { color: '#333333' }, beginAtZero: true } }
        }
      };

      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=800&h=300&bkg=1e1e2f`;
      
      // Constrói o anexo nativo da imagem no Discord
      const chartAttachment = new AttachmentBuilder(chartUrl, { name: 'dashboard.png' });

      const prompt = `Você é um consultor tech especialista em comunidades do Discord. Dados semanais deste servidor: Mensagens: ${totalMsgs}, Entradas: ${totalJoins}, Saídas: ${totalLeaves}. Dê UMA dica genial e curta (máximo 3 linhas) para melhorar o engajamento ou reter membros. Sem formatação exagerada.`;

      const insight = await KodaAIEngine.getConsultingInsight(prompt);

      // 🟢 CORREÇÃO: UI Limpa e Nativa em Markdown sem o velho EmbedBuilder
      const appUIContent = `## 📊 Dashboard Analítico: ${interaction.guild.name}
*Módulo de Inteligência de Comunidades KodaAI*

**Estatísticas Totais do Período:**
\`💬 ${totalMsgs} Mensagens\` ➖ \`📥 ${totalJoins} Entradas\` ➖ \`📤 ${totalLeaves} Saídas\`

**🧠 Consultoria da IA:**
> ${insight}`;

      // Botões/Containers (Components V2)
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('refresh_painel').setLabel('Atualizar Dados').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('vip_dashboard').setLabel('Upgrade VIP').setStyle(ButtonStyle.Success).setEmoji('💎')
      );

      // Entrega a UI final
      await interaction.editReply({ 
        content: appUIContent, 
        files: [chartAttachment], 
        components: [actionRow] 
      });

    } catch (error) {
      console.error('🚨 Erro ao gerar painel:', error);
      await interaction.editReply({ content: '❌ Ocorreu uma falha ao renderizar a interface analítica. Tente novamente.', components: [] });
    }
  }
};