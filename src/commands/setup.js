// src/commands/setup.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags // <--- Adicionado aqui
} from 'discord.js';
import prisma from '../database/prisma.js';

export default {
  // A estrutura de dados inteligente que o ready.js vai mandar pro Discord
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Monta a infraestrutura de segurança da KodaAI no servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    // deferReply segura a onda do Discord (evita timeout de 3 segundos) enquanto o bot processa
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild } = interaction;

    try {
      // 1. Verifica no banco de dados automático se o server já tá configurado
      let dbGuild = await prisma.guild.findUnique({ where: { id: guild.id } });

      if (dbGuild?.logChannelId && guild.channels.cache.has(dbGuild.logChannelId)) {
        return interaction.editReply({
          content: 'Tranquilidade, chefe! A KodaAI já tá montada e na ativa nesse servidor.'
        });
      }

      // 2. Cria Categoria Fechada (Apenas Staff e o Bot)
      const category = await guild.channels.create({
        name: '🔒 KODA SECURITY',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
          }
        ],
      });

      // 3. Cria o Canal de Logs dentro da categoria
      const logChannel = await guild.channels.create({
        name: '📜・koda-logs',
        type: ChannelType.GuildText,
        parent: category.id,
      });

      // 4. Salva a estrutura no banco de dados via Prisma (Upsert = atualiza se existir, cria se não)
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: { logChannelId: logChannel.id },
        create: { id: guild.id, logChannelId: logChannel.id }
      });

      // 5. Constrói o visual App-Like
      const embed = new EmbedBuilder()
        .setTitle('🛡️ KodaAI: Sistema Operacional Ativo')
        .setDescription('Tudo no esquema! A base de operações foi montada com sucesso. Daqui pra frente, quem vacilar vai cair no log.')
        .setColor('#2B2D31')
        .addFields(
          { name: '📂 Categoria Base', value: `<#${category.id}>`, inline: true },
          { name: '📝 Canal de Logs', value: `<#${logChannel.id}>`, inline: true },
          { name: '🤖 Status da Engine IA', value: '🟢 Híbrida (Gemini/Llama) Ativa', inline: false }
        );

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('test_security_log') // Vamos interceptar isso depois!
          .setLabel('Testar Alarme')
          .setEmoji('🚨')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('vip_dashboard')
          .setLabel('Painel VIP')
          .setEmoji('⚙️')
          .setStyle(ButtonStyle.Secondary)
      );

      // Manda a resposta final
      await interaction.editReply({ embeds: [embed], components: [actionRow] });

      // Mensagem de boas-vindas no canal recém-criado
      await logChannel.send({
        content: `**Salve Staff!** Canal criado com sucesso.\nToda infração interceptada pela IA da **KodaAI** vai bater aqui mastigadinha pra vocês analisarem.`
      });

    } catch (error) {
      console.error('🚨 Erro ao executar /setup:', error);
      await interaction.editReply({
        content: 'Vish, deu um B.O ao criar os canais. Confere se meu cargo tem a permissão de **Administrador** e se ele tá no topo da lista dos cargos.'
      });
    }
  }
};