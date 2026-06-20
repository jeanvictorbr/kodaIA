// src/events/interactionCreate.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } from 'discord.js';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // Tratamento de Comandos Slash normais
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`🚨 [Erro] B.O no comando ${interaction.commandName}:`, error);
        const replyOptions = { content: 'Deu ruim internamente. A staff já tá ligada.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyOptions);
        else await interaction.reply(replyOptions);
      }
    } 
    // Tratamento de Botões e Menus de Seleção do Dashboard
    else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      try {
        const customId = interaction.customId;

        // 🎛️ NAVEGAÇÃO: Voltar ao Menu Principal (Hub)
        if (customId === 'menu_hub') {
          await interaction.deferUpdate();
          const embed = new EmbedBuilder()
            .setTitle('⚙️ Central de Controle KodaAI')
            .setDescription('Bem-vindo ao painel de controle nativo. Escolha o módulo que deseja acessar abaixo:')
            .setColor('#2b2d31')
            .addFields(
              { name: '📊 Analytics (FREE)', value: 'Métricas de engajamento, retenção e IA consultiva.' },
              { name: '❓ Ajuda e Comandos', value: 'Descubra como a KodaAI protege seu servidor.' },
              { name: '💎 Módulo VIP', value: 'Gerencie OCR, limites e punições automáticas.' }
            );

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_analytics').setLabel('Analytics').setStyle(ButtonStyle.Primary).setEmoji('📊'),
            new ButtonBuilder().setCustomId('menu_help').setLabel('Ajuda').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
            new ButtonBuilder().setCustomId('vip_dashboard').setLabel('Upgrade VIP').setStyle(ButtonStyle.Success).setEmoji('💎')
          );

          await interaction.editReply({ content: '', embeds: [embed], files: [], components: [row] });
        }

        // 📊 NAVEGAÇÃO: Analytics & Gráficos (E troca de Período)
        if (customId === 'menu_analytics' || customId === 'select_period') {
          await interaction.deferUpdate();

          // Se veio do menu de seleção, pega os dias escolhidos. Se veio do botão principal, o padrão é 7.
          const days = interaction.isStringSelectMenu() ? parseInt(interaction.values[0]) : 7;
          
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          startDate.setUTCHours(0,0,0,0);

          let analytics = await prisma.dailyAnalytics.findMany({
            where: { guildId: interaction.guildId, date: { gte: startDate } },
            orderBy: { date: 'asc' }
          });

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

          // ✨ DESIGN PREMIUM DO GRÁFICO (Fontes Maiores, Alta Resolução e Linhas Neon)
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
              plugins: {
                legend: { labels: { color: '#ffffff', font: { size: 16, family: 'sans-serif' } }, position: 'top' },
                title: { display: false }
              },
              scales: {
                x: { ticks: { color: '#e0e0e0', font: { size: 14 } }, grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: false } },
                y: { ticks: { color: '#e0e0e0', font: { size: 14 }, beginAtZero: true }, grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: false } }
              }
            }
          };

          // devicePixelRatio=2 dobra a qualidade e nitidez da imagem
          const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=800&h=400&bkg=2b2d31&devicePixelRatio=2`;
          const chartAttachment = new AttachmentBuilder(chartUrl, { name: 'dashboard.png' });

          const prompt = `Consultor tech de comunidades Discord. Dados de ${days} dias: Mensagens: ${totalMsgs}, Entradas: ${totalJoins}, Saídas: ${totalLeaves}. Dê UMA dica genial e curta (máx 3 linhas) para melhorar engajamento ou retenção.`;
          const insight = await KodaAIEngine.getConsultingInsight(prompt);

          const appUIContent = `## 📊 Analytics: ${interaction.guild.name} (${days} Dias)\n*Módulo de Inteligência de Comunidades KodaAI*\n\n**Estatísticas do Período:**\n\`💬 ${totalMsgs} Mensagens\` ➖ \`📥 ${totalJoins} Entradas\` ➖ \`📤 ${totalLeaves} Saídas\`\n\n**🧠 Consultoria da IA:**\n> ${insight}`;

          // Menu de Seleção de Dias
          const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_period')
              .setPlaceholder('📅 Alterar Período de Análise')
              .addOptions(
                { label: 'Últimos 7 Dias', description: 'Visão semanal padrão', value: '7', emoji: '📆' },
                { label: 'Últimos 15 Dias', description: 'Visão quinzenal', value: '15', emoji: '📅' },
                { label: 'Últimos 30 Dias', description: 'Visão mensal completa', value: '30', emoji: '📊' }
              )
          );

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_hub').setLabel('Voltar ao Início').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: appUIContent, files: [chartAttachment], embeds: [], components: [selectRow, btnRow] });
        }

        // ❓ NAVEGAÇÃO: Menu de Ajuda
        if (customId === 'menu_help') {
          await interaction.deferUpdate();
          const helpContent = `## ❓ Central de Ajuda - KodaAI\nO sistema anti-raid e anti-scam mais letal e inteligente do Discord.\n\n### 🛡️ O que eu faço?\n*   **Radar de Texto:** Intercepto links de phishing, nitro falso e golpes financeiros.\n*   **Radar Visual (VIP):** Faço OCR (Leitura) em imagens para bloquear prints de PIX falsos, pornografia e gore.\n*   **Anti-Raid:** Analiso a idade e a reputação global de quem entra no servidor.\n*   **Anti-Toxicidade:** Puno instantaneamente palavras de baixo calão e evasões (leetspeak como "cuz4o").\n\n### 🛠️ Comandos Disponíveis\n*   \`/painel\` - Abre a interface nativa (Analytics e VIP).\n*   \`/setup\` - (Staff) Cria a base de operações segura e canais de log blindados.\n*   \`/dev\` - (Owner) Gerencia as licenças VIP e métricas brutas do bot.\n\n*A KodaAI opera silenciosamente. Se alguém violar as regras, a punição é imediata.*`;
          
          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_hub').setLabel('Voltar ao Menu Principal').setStyle(ButtonStyle.Primary).setEmoji('🏠')
          );

          await interaction.editReply({ content: helpContent, files: [], embeds: [], components: [btnRow] });
        }

        // 💎 BOTÃO VIP
        if (customId === 'vip_dashboard') {
          const vipEmbed = new EmbedBuilder()
            .setTitle('💎 Módulo VIP - KodaAI')
            .setDescription('Acesso restrito. O plano VIP libera **OCR (Leitura de Imagens e Prints)**, bloqueio avançado de **NSFW/Gore** e o sistema implacável de **Timeout e Kick Automático**.\n\n*Contate o desenvolvedor para adquirir uma licença para o seu servidor.*')
            .setColor('#FEE75C');

          await interaction.reply({ embeds: [vipEmbed], ephemeral: true });
        }

        // 🚨 BOTÃO DE TESTE DE ALARME (Preservando a lógica do comando /setup)
        if (customId === 'test_security_log') {
          await interaction.reply({ content: 'Disparando alarme de teste no canal de logs...', ephemeral: true });

          const embedFake = new EmbedBuilder()
            .setTitle('🚨 [TESTE] Ameaça Neutralizada')
            .setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${interaction.user.tag} (Simulação)`, inline: true },
              { name: '📍 Canal', value: `<#${interaction.channelId}>`, inline: true },
              { name: '🛑 Tipo de Ameaça', value: `\`PHISHING_SIMULADO\``, inline: true },
              { name: '💬 Mensagem Original', value: `\`\`\`text\nhttp://steam-nitro-free-golpe.com\n\`\`\``, inline: false },
              { name: '🤖 Análise KodaAI', value: 'Isso é apenas um teste disparado pelo painel de Setup. O sistema está operante.', inline: false }
            )
            .setFooter({ text: 'Sistema Operante | Motor Híbrido Ativo' })
            .setTimestamp();

          const dbGuild = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
          if (dbGuild && dbGuild.logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(dbGuild.logChannelId) || await interaction.guild.channels.fetch(dbGuild.logChannelId).catch(() => null);
            if (logChannel) {
              await logChannel.send({ embeds: [embedFake] });
            }
          }
        }

      } catch (error) {
        console.error('Erro ao processar interação:', error);
      }
    }
  }
};