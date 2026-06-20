// src/commands/painel.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('📊 Exibe o Dashboard de Engajamento Neon e a Consultoria da IA (Premium/Free)'),
    
  async execute(interaction) {
    // Avisa o Discord que estamos a processar (a imagem e a IA demoram uns segundos)
    await interaction.deferReply();

    try {
      // 1. Puxar dados dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setUTCHours(0,0,0,0);

      const analytics = await prisma.dailyAnalytics.findMany({
        where: { guildId: interaction.guildId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'asc' }
      });

      if (analytics.length === 0) {
        return interaction.editReply('📉 **Sem Dados:** Ainda não tenho dados suficientes. Deixe a KodaAI interagir no servidor por pelo menos 1 dia!');
      }

      // Preparar os dados para o gráfico
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

      // 2. Gerar Gráfico Neon via QuickChart API (Sem necessidade de bibliotecas pesadas)
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
          plugins: {
            legend: { labels: { color: '#ffffff', font: { family: 'sans-serif', size: 14 } } },
            title: { display: true, text: 'Tráfego de Engajamento (7 Dias)', color: '#ffffff', font: { size: 18 } }
          },
          scales: {
            x: { ticks: { color: '#aaaaaa' }, grid: { color: '#333333' } },
            y: { ticks: { color: '#aaaaaa' }, grid: { color: '#333333' }, beginAtZero: true }
          }
        }
      };

      // Fundo escuro #1e1e2f perfeito para o Discord
      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=800&h=400&bkg=1e1e2f`;

      // 3. Chamar a IA para a Consultoria
      const prompt = `Você é um consultor tech especialista em comunidades do Discord. Analise estes dados reais dos últimos 7 dias deste servidor:
      - Mensagens enviadas: ${totalMsgs}
      - Novos membros: ${totalJoins}
      - Membros que saíram: ${totalLeaves}
      Dê uma dica genial de no máximo 3 linhas para o dono do servidor melhorar o engajamento ou reter membros. Use tom empolgante, moderno e não use formatação markdown extravagante.`;

      const insight = await KodaAIEngine.getConsultingInsight(prompt);

      // 4. Montar a resposta Final
      const embed = new EmbedBuilder()
        .setTitle('📊 Dashboard Analítico - KodaAI')
        .setColor('#00FFFF') // Azul Neon
        .setDescription(`Resumo operacional dos últimos dias no servidor **${interaction.guild.name}**.`)
        .addFields(
          { name: '💬 Total de Mensagens', value: `\`${totalMsgs}\``, inline: true },
          { name: '📥 Entradas', value: `\`${totalJoins}\``, inline: true },
          { name: '📤 Saídas', value: `\`${totalLeaves}\``, inline: true },
          { name: '🧠 Consultoria Inteligente KodaAI', value: `> ${insight}`, inline: false }
        )
        .setImage(chartUrl)
        .setFooter({ text: `Requisitado por ${interaction.user.tag} • Módulo Analítico` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('🚨 Erro ao gerar painel:', error);
      await interaction.editReply('❌ Deu um erro interno ao compilar os seus gráficos. Tente novamente mais tarde.');
    }
  }
};