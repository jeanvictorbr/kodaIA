// src/events/interactionCreate.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } from 'discord.js';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`🚨 [Erro] Comando ${interaction.commandName}:`, error);
        const replyOptions = { content: 'Deu erro interno. Tente novamente mais tarde.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyOptions);
        else await interaction.reply(replyOptions);
      }
    } 
    else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      try {
        const customId = interaction.customId;

        // ==========================================
        // 🏠 MENU PRINCIPAL (HUB)
        // ==========================================
        if (customId === 'menu_hub') {
          await interaction.deferUpdate();
          const embed = new EmbedBuilder()
            .setTitle('⚙️ Central de Controle KodaAI')
            .setDescription('Navegue pelo painel de controlo selecionando uma das opções abaixo:')
            .setColor('#2b2d31')
            .addFields(
              { name: '📊 Dashboard de Analytics', value: `\`\`\`yaml\nVisualize o tráfego de mensagens, retenção e obtenha consultoria gerada por IA.\n\`\`\`` },
              { name: '💬 Resposta a Menções', value: `\`\`\`yaml\nAtive para que a KodaAI responda no chat quando for mencionada.\n\`\`\`` },
              { name: '❓ Central de Ajuda', value: `\`\`\`yaml\nDescubra como os radares de texto e visão protegem o seu servidor.\n\`\`\`` },
              { name: '💎 Gestão VIP', value: `\`\`\`yaml\nGerencie funcionalidades Premium como OCR avançado e Moderação Automática.\n\`\`\`` }
            );

          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_analytics').setLabel('Analytics').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
            new ButtonBuilder().setCustomId('toggle_mention').setLabel('IA Respostas').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
            new ButtonBuilder().setCustomId('menu_help').setLabel('Ajuda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
            new ButtonBuilder().setCustomId('vip_dashboard').setLabel('Upgrade VIP').setStyle(ButtonStyle.Success).setEmoji('💎')
          );

          await interaction.editReply({ content: '', embeds: [embed], files: [], components: [row1] });
        }

        // ==========================================
        // 💬 TOGGLE: ATIVAR/DESATIVAR MENÇÕES
        // ==========================================
        if (customId === 'toggle_mention') {
            await interaction.deferUpdate();
            let dbGuild = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
            if (!dbGuild) {
                dbGuild = await prisma.guild.create({ data: { id: interaction.guildId } });
            }
            
            const newState = !dbGuild.respondMentions;
            await prisma.guild.update({
                where: { id: interaction.guildId },
                data: { respondMentions: newState }
            });

            await interaction.followUp({ content: `✅ As respostas automáticas da KodaAI foram **${newState ? 'ATIVADAS' : 'DESATIVADAS'}** neste servidor!`, ephemeral: true });
        }

        // ==========================================
        // 📊 DASHBOARD ANALYTICS E GRÁFICO
        // ==========================================
        if (customId === 'menu_analytics' || customId === 'select_period' || customId === 'refresh_analytics') {
          await interaction.deferUpdate();

          let days = 7;
          if (interaction.isStringSelectMenu()) days = parseInt(interaction.values[0]);

          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          startDate.setUTCHours(0,0,0,0);

          let analytics = await prisma.dailyAnalytics.findMany({
            where: { guildId: interaction.guildId, date: { gte: startDate } },
            orderBy: { date: 'asc' }
          });

          if (analytics.length === 0) analytics = [{ date: new Date(), messages: 0, joins: 0, leaves: 0 }];

          const labels = []; const messagesData = []; const joinsData = [];
          let totalMsgs = 0, totalJoins = 0, totalLeaves = 0;

          analytics.forEach(day => {
            labels.push(`${day.date.getDate()}/${day.date.getMonth()+1}`);
            messagesData.push(day.messages); joinsData.push(day.joins);
            totalMsgs += day.messages; totalJoins += day.joins; totalLeaves += day.leaves;
          });

          const chartConfig = {
            type: 'line',
            data: {
              labels: labels,
              datasets: [
                { label: 'Mensagens', data: messagesData, borderColor: '#00e5ff', backgroundColor: 'rgba(0, 229, 255, 0.2)', borderWidth: 4, pointBackgroundColor: '#00e5ff', pointRadius: 4, fill: true, tension: 0.4 },
                { label: 'Entradas', data: joinsData, borderColor: '#ff00aa', backgroundColor: 'rgba(255, 0, 170, 0.2)', borderWidth: 4, pointBackgroundColor: '#ff00aa', pointRadius: 4, fill: true, tension: 0.4 }
              ]
            },
            options: {
              layout: { padding: 20 },
              plugins: { legend: { labels: { color: '#ffffff', font: { size: 16, family: 'sans-serif' } }, position: 'top' } },
              scales: {
                x: { ticks: { color: '#e0e0e0', font: { size: 14 } }, grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: false } },
                y: { ticks: { color: '#e0e0e0', font: { size: 14 }, beginAtZero: true }, grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: false } }
              }
            }
          };

          const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=800&h=400&bkg=2b2d31&devicePixelRatio=2`;
          const chartAttachment = new AttachmentBuilder(chartUrl, { name: 'dashboard.png' });

          const prompt = `Consultor tech de comunidades Discord. Dados de ${days} dias: Mensagens: ${totalMsgs}, Entradas: ${totalJoins}, Saídas: ${totalLeaves}. Dê UMA dica genial e curta (máx 3 linhas) para melhorar engajamento.`;
          const insight = await KodaAIEngine.getConsultingInsight(prompt);

          const appUIContent = `## 📊 Analytics: ${interaction.guild.name} (${days} Dias)\n**Estatísticas:** \`💬 ${totalMsgs} Msgs\` ➖ \`📥 ${totalJoins} Entradas\` ➖ \`📤 ${totalLeaves} Saídas\`\n\n**🧠 IA:**\n> ${insight}`;

          const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('select_period').setPlaceholder('📅 Alterar Período de Análise').addOptions(
                { label: 'Últimos 7 Dias', value: '7', emoji: '📆' },
                { label: 'Últimos 15 Dias', value: '15', emoji: '📅' },
                { label: 'Últimos 30 Dias', value: '30', emoji: '📊' }
              )
          );

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('refresh_analytics').setLabel('Atualizar Dados').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('menu_hub').setLabel('Voltar ao Início').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: appUIContent, files: [chartAttachment], embeds: [], components: [selectRow, btnRow] });
        }

        // ==========================================
        // ❓ MENU DE AJUDA
        // ==========================================
        if (customId === 'menu_help') {
          await interaction.deferUpdate();
          const helpContent = `## ❓ Central de Ajuda - KodaAI\nO sistema anti-raid e anti-scam mais letal e inteligente do Discord.\n\n### 🛡️ O que eu faço?\n* **Radar de Texto:** Intercepto links de phishing, nitro falso e golpes financeiros.\n* **Radar Visual (VIP):** Faço OCR (Leitura) em imagens para bloquear prints de PIX falsos, pornografia e gore.\n* **Anti-Raid:** Analiso a idade e a reputação global de quem entra.\n* **Anti-Toxicidade:** Puno instantaneamente palavras de baixo calão.\n\n### 🛠️ Comandos Disponíveis\n* \`/painel\` - Abre a interface nativa.\n* \`/setup\` - Cria a base de operações segura.\n* \`/dev\` - Gerencia as licenças VIP e métricas.\n\n*A KodaAI opera silenciosamente.*`;
          
          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_hub').setLabel('Voltar ao Menu Principal').setStyle(ButtonStyle.Primary).setEmoji('🏠')
          );

          await interaction.editReply({ content: helpContent, files: [], embeds: [], components: [btnRow] });
        }

        // ==========================================
        // 💎 PAINEL VIP
        // ==========================================
        if (customId === 'vip_dashboard') {
          const vipEmbed = new EmbedBuilder()
            .setTitle('💎 Módulo VIP - KodaAI')
            .setDescription('Acesso restrito. O plano VIP libera **OCR (Leitura de Imagens e Prints)**, bloqueio avançado de **NSFW/Gore** e o sistema implacável de **Timeout e Kick Automático**.\n\n*Contate o desenvolvedor para adquirir a licença.*')
            .setColor('#FEE75C');

          await interaction.reply({ embeds: [vipEmbed], ephemeral: true });
        }

        // ==========================================
        // 🚨 TESTE DE SEGURANÇA (SETUP)
        // ==========================================
        if (customId === 'test_security_log') {
          await interaction.reply({ content: 'Disparando alarme de teste...', ephemeral: true });
          const embedFake = new EmbedBuilder()
            .setTitle('🚨 [TESTE] Ameaça Neutralizada').setColor('#ED4245')
            .addFields({ name: 'Tipo', value: 'PHISHING_SIMULADO' }, { name: 'Análise KodaAI', value: 'Teste disparado pelo painel de Setup. Operante.' }).setTimestamp();

          const dbGuild = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
          if (dbGuild && dbGuild.logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(dbGuild.logChannelId) || await interaction.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
            if (logChannel) await logChannel.send({ embeds: [embedFake] });
          }
        }

      } catch (error) { 
        console.error('Erro de interação:', error); 
      }
    }
  }
};