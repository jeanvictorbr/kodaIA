// src/events/interactionCreate.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../database/prisma.js';
import KodaAIEngine from '../utils/KodaAIEngine.js';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // ==========================================
    // 1. GESTÃO DE COMANDOS SLASH
    // ==========================================
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
    // ==========================================
    // 2. GESTÃO DE JANELAS POP-UP (MODALS - VIP)
    // ==========================================
    else if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId === 'modal_add_vip') {
          await interaction.deferReply({ ephemeral: true });
          
          const guildId = interaction.fields.getTextInputValue('input_guild_id');
          const days = parseInt(interaction.fields.getTextInputValue('input_vip_days'));

          if (isNaN(days) || days <= 0) {
            return interaction.editReply('❌ **Erro:** O número de dias precisa ser um valor numérico válido maior que zero.');
          }

          // Calcula a data de expiração
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + days);

          // Salva no banco de dados (Requer o vipExpiration no schema.prisma)
          await prisma.guild.upsert({
            where: { id: guildId },
            update: { vip: true, vipExpiration: expirationDate },
            create: { id: guildId, vip: true, vipExpiration: expirationDate }
          });

          // Formata a data para a tag de timestamp nativa do Discord
          const discordTimestamp = `<t:${Math.floor(expirationDate.getTime() / 1000)}:f>`;
          const relativeTimestamp = `<t:${Math.floor(expirationDate.getTime() / 1000)}:R>`;
          
          return interaction.editReply(`✅ **Licença VIP Ativada com Sucesso!**\n🏢 **Servidor:** \`${guildId}\`\n⏳ **Duração:** ${days} Dias\n⏰ **Expira em:** ${discordTimestamp} (${relativeTimestamp})`);
        }

        if (interaction.customId === 'modal_remove_vip') {
          await interaction.deferReply({ ephemeral: true });
          
          const guildId = interaction.fields.getTextInputValue('input_guild_id');

          await prisma.guild.upsert({
            where: { id: guildId },
            update: { vip: false, vipExpiration: null },
            create: { id: guildId, vip: false, vipExpiration: null }
          });

          return interaction.editReply(`🗑️ **Licença VIP Revogada.** O servidor \`${guildId}\` foi rebaixado para o plano FREE e perdeu o acesso ao motor OCR.`);
        }
      } catch (error) {
        console.error('Erro ao processar modal:', error);
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Falha ao processar formulário.', ephemeral: true });
      }
    }
    // ==========================================
    // 3. GESTÃO DE COMPONENTES (BOTÕES E MENUS)
    // ==========================================
    else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      try {
        const customId = interaction.customId;

        // 💻 TERMINAL DEV: INÍCIO E ATUALIZAR
        if (customId === 'dev_refresh' || customId === 'dev_hub') {
          await interaction.deferUpdate();
          
          const ping = client.ws.ping;
          const uptime = (client.uptime / 1000 / 60 / 60).toFixed(1);
          const ramUsada = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
          const ramStatus = ramUsada > 120 ? '🔴 CRÍTICO' : ramUsada > 90 ? '🟡 ALERTA' : '🟢 ESTÁVEL';

          const terminalUI = `## 💻 Terminal do Desenvolvedor\n*Módulo de Administração Global KodaAI*\n\n**📡 Status do Sistema Motor:**\n\`\`\`yaml\nLatência (Ping) : ${ping}ms\nUptime          : ${uptime} Horas Online\nMemória (RAM)   : ${ramUsada}MB / 150MB [${ramStatus}]\n\`\`\`\n\nSelecione um dos módulos de gestão abaixo para operar a infraestrutura:`;

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dev_metrics').setLabel('Métricas Globais').setStyle(ButtonStyle.Primary).setEmoji('📊'),
            new ButtonBuilder().setCustomId('dev_vip_manager').setLabel('Gestão VIP').setStyle(ButtonStyle.Success).setEmoji('💎'),
            new ButtonBuilder().setCustomId('dev_refresh').setLabel('Atualizar Rede').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
          );

          await interaction.editReply({ content: terminalUI, embeds: [], components: [row] });
        }

        // 💻 TERMINAL DEV: MÉTRICAS GLOBAIS
        if (customId === 'dev_metrics') {
          await interaction.deferUpdate();
          
          const totalGuilds = client.guilds.cache.size;
          const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
          
          const dbGuilds = await prisma.guild.count();
          const dbVips = await prisma.guild.count({ where: { vip: true } });

          const metricsUI = `## 📊 Métricas Globais da Base\n*Estatísticas de alcance da rede KodaAI*\n\n**Escala da Operação:**\n\`\`\`yaml\nServidores Ativos : ${totalGuilds}\nUsuários Radar    : ${totalUsers}\nRegistros (DB)    : ${dbGuilds} Comunidades\nLicenças VIP      : ${dbVips} Ativas\n\`\`\``;

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dev_hub').setLabel('Voltar ao Terminal').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: metricsUI, components: [btnRow] });
        }

        // 💻 TERMINAL DEV: MENU VIP
        if (customId === 'dev_vip_manager') {
          await interaction.deferUpdate();
          
          const vipUI = `## 💎 Gerenciador de Licenças VIP\n*Módulo Financeiro e de Concessão de Acessos*\n\nAqui você controla quem tem acesso ao motor OCR, moderação automática e limites de segurança aprimorados. O que deseja fazer?`;

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dev_add_vip').setLabel('Conceder VIP').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('dev_remove_vip').setLabel('Revogar VIP').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('dev_hub').setLabel('Voltar ao Terminal').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: vipUI, components: [row] });
        }

        // 💻 TERMINAL DEV: ABRIR MODAL DE CONCEDER VIP
        // Importante: NÃO podemos usar deferUpdate() antes de abrir um Modal!
        if (customId === 'dev_add_vip') {
          const modal = new ModalBuilder().setCustomId('modal_add_vip').setTitle('Conceder Licença VIP');
          const guildIdInput = new TextInputBuilder().setCustomId('input_guild_id').setLabel('ID do Servidor').setStyle(TextInputStyle.Short).setRequired(true);
          const daysInput = new TextInputBuilder().setCustomId('input_vip_days').setLabel('Duração (em Dias)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 30').setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(guildIdInput), new ActionRowBuilder().addComponents(daysInput));
          await interaction.showModal(modal);
          return;
        }

        // 💻 TERMINAL DEV: ABRIR MODAL DE REVOGAR VIP
        if (customId === 'dev_remove_vip') {
          const modal = new ModalBuilder().setCustomId('modal_remove_vip').setTitle('Revogar Licença VIP');
          const guildIdInput = new TextInputBuilder().setCustomId('input_guild_id').setLabel('ID do Servidor').setStyle(TextInputStyle.Short).setRequired(true);
          
          modal.addComponents(new ActionRowBuilder().addComponents(guildIdInput));
          await interaction.showModal(modal);
          return;
        }


        // 🏠 MENU PRINCIPAL E TOGGLE DE IA (USUÁRIOS)
        if (customId === 'menu_hub' || customId === 'toggle_mention') {
          await interaction.deferUpdate();

          let dbGuild = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
          if (!dbGuild) dbGuild = await prisma.guild.create({ data: { id: interaction.guildId } });

          if (customId === 'toggle_mention') {
            dbGuild = await prisma.guild.update({
              where: { id: interaction.guildId },
              data: { respondMentions: !dbGuild.respondMentions }
            });
          }

          const iaStatus = dbGuild.respondMentions ? '🟢 ATIVADO' : '🔴 DESATIVADO';
          const vipStatus = dbGuild.vip ? '💎 ATIVO' : '🆓 FREE';

          const embed = new EmbedBuilder()
            .setTitle('⚙️ Central de Controle KodaAI')
            .setDescription('Navegue pelo painel de controlo selecionando uma das opções abaixo:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            .setColor('#2b2d31')
            .addFields(
              { name: '📊 Dashboard de Analytics', value: `\`\`\`yaml\nVisualize o tráfego de mensagens, retenção e obtenha consultoria gerada por IA.\n\`\`\`` },
              { name: `💬 Resposta a Menções [${iaStatus}]`, value: `\`\`\`yaml\nAtive para que a KodaAI responda no chat quando for mencionada.\n\`\`\`` },
              { name: `💎 Gestão VIP [${vipStatus}]`, value: `\`\`\`yaml\nGerencie funcionalidades Premium como OCR avançado e Moderação Automática.\n\`\`\`` },
              { name: '❓ Central de Ajuda', value: `\`\`\`yaml\nDescubra como os radares de texto e visão protegem o seu servidor.\n\`\`\`` }
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

          await interaction.editReply({ content: '', embeds: [embed], files: [], components: [row1] });
        }

        // 📊 DASHBOARD ANALYTICS (GRÁFICO LIMPO)
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

          const analyticsEmbed = new EmbedBuilder()
            .setTitle(`📊 Analytics: ${interaction.guild.name} (${days} Dias)`)
            .setColor('#2b2d31')
            .setDescription('Métricas operacionais e retenção da comunidade.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            .addFields(
              { name: '💬 Mensagens', value: `\`\`\`\n${totalMsgs}\n\`\`\``, inline: true },
              { name: '📥 Entradas', value: `\`\`\`\n${totalJoins}\n\`\`\``, inline: true },
              { name: '📤 Saídas', value: `\`\`\`\n${totalLeaves}\n\`\`\``, inline: true }
            )
            .setImage('attachment://dashboard.png');

          const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('select_period').setPlaceholder('📅 Alterar Período de Análise').addOptions(
                { label: 'Últimos 7 Dias', value: '7', emoji: '📆' },
                { label: 'Últimos 15 Dias', value: '15', emoji: '📅' },
                { label: 'Últimos 30 Dias', value: '30', emoji: '📊' }
              )
          );

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`consultoria_${days}`).setLabel('Gerar Consultoria IA').setStyle(ButtonStyle.Success).setEmoji('🧠'),
            new ButtonBuilder().setCustomId('refresh_analytics').setLabel('Atualizar Dados').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('menu_hub').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: '', embeds: [analyticsEmbed], files: [chartAttachment], components: [selectRow, btnRow] });
        }

        // 🧠 RELATÓRIO DE CONSULTORIA DETALHADO DA IA
        if (customId.startsWith('consultoria_')) {
          await interaction.deferUpdate();
          const days = parseInt(customId.split('_')[1]);

          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          startDate.setUTCHours(0,0,0,0);

          let analytics = await prisma.dailyAnalytics.findMany({
            where: { guildId: interaction.guildId, date: { gte: startDate } }
          });

          let totalMsgs = 0, totalJoins = 0, totalLeaves = 0;
          analytics.forEach(day => { totalMsgs += day.messages; totalJoins += day.joins; totalLeaves += day.leaves; });

          const prompt = `Você é um Cientista de Dados focado em retenção de comunidades no Discord. Analise os dados dos últimos ${days} dias deste servidor:
          - Total de Mensagens: ${totalMsgs}
          - Novas Entradas: ${totalJoins}
          - Total de Saídas: ${totalLeaves}
          
          Crie um relatório curto, direto e esteticamente agradável contendo:
          1. Uma estimativa da Taxa de Retenção (%) com base em entradas vs saídas.
          2. Uma avaliação do nível de engajamento atual.
          3. Três ideias criativas de eventos ou dinâmicas para aquecer o servidor e aumentar a participação.
          Formate a sua resposta usando Markdown do Discord, emojis e listas.`;

          const insight = await KodaAIEngine.getConsultingInsight(prompt);

          const consultoriaEmbed = new EmbedBuilder()
            .setTitle(`🧠 Relatório de Inteligência - KodaAI`)
            .setColor('#ff00aa')
            .setDescription(`Abaixo está o relatório gerado pela nossa inteligência artificial analisando o comportamento dos seus membros nos últimos ${days} dias.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${insight}`)
            .setFooter({ text: 'Nota: O rastreio individual de canais chegará nas próximas atualizações.' });

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_analytics').setLabel('Voltar ao Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: '', embeds: [consultoriaEmbed], files: [], components: [btnRow] });
        }

        // ❓ MENU DE AJUDA
        if (customId === 'menu_help') {
          await interaction.deferUpdate();
          const helpEmbed = new EmbedBuilder()
            .setTitle('❓ Central de Ajuda - KodaAI')
            .setDescription('O sistema anti-raid e anti-scam mais letal e inteligente do Discord.')
            .setColor('#2b2d31')
            .addFields(
                { name: '🛡️ Radar de Texto', value: 'Intercepta links de phishing, nitro falso e golpes.' },
                { name: '👁️ Radar Visual (VIP)', value: 'Faz OCR em imagens para bloquear PIX falso, NSFW e Gore.' },
                { name: '⚡ Moderação Ativa', value: 'Bloqueio de raids por idade de conta e filtro anti-toxicidade implacável.' },
                { name: '🛠️ Comandos', value: '`/painel` - Dashboard nativo\n`/setup` - Configurar segurança\n`/dev` - Painel do desenvolvedor' }
            );
          
          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('menu_hub').setLabel('Voltar ao Menu Principal').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
          );

          await interaction.editReply({ content: '', embeds: [helpEmbed], files: [], components: [btnRow] });
        }

        // 💎 PAINEL VIP (USUÁRIO FINAL)
        if (customId === 'vip_dashboard') {
          const vipEmbed = new EmbedBuilder()
            .setTitle('💎 Módulo VIP - KodaAI')
            .setDescription('Acesso restrito. O plano VIP libera **OCR (Leitura de Imagens e Prints)**, bloqueio avançado de **NSFW/Gore** e o sistema implacável de **Timeout e Kick Automático**.\n\n*Contate o desenvolvedor para adquirir a licença.*')
            .setColor('#FEE75C');

          await interaction.reply({ embeds: [vipEmbed], ephemeral: true });
        }

        // 🚨 TESTE DE SEGURANÇA (SETUP)
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
        console.error('Erro de interação (Componentes):', error); 
      }
    }
  }
};