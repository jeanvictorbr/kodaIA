// src/events/interactionCreate.js
import { EmbedBuilder } from 'discord.js';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    
    // ==========================================
    // 🟢 FLUXO 1: COMANDOS DE BARRA (/)
    // ==========================================
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

    // ==========================================
    // 🟡 FLUXO 2: CLIQUES EM BOTÕES (Components V2)
    // ==========================================
    else if (interaction.isButton()) {
      try {
        if (interaction.customId === 'test_security_log') {
          // Responde só pra quem clicou pra não travar a interface
          await interaction.reply({ content: 'Disparando alarme de teste no canal de logs...', ephemeral: true });

          // Cria um Log Fake pra Staff ver como fica
          const embedFake = new EmbedBuilder()
            .setTitle('🚨 [TESTE] Ameaça Neutralizada')
            .setColor('#ED4245')
            .addFields(
              { name: '👤 Usuário', value: `${interaction.user.tag} (Simulação)`, inline: true },
              { name: '📍 Canal', value: `<#${interaction.channelId}>`, inline: true },
              { name: '🛑 Tipo de Ameaça', value: `\`PHISHING_SIMULADO\``, inline: true },
              { name: '💬 Mensagem Original', value: `\`\`\`text\nhttp://steam-nitro-free-golpe.com\n\`\`\``, inline: false },
              { name: '🤖 Análise KodaAI', value: 'Isso é apenas um teste disparado pelo painel de Setup. O sistema está operante e formatando os logs corretamente.', inline: false }
            )
            .setFooter({ text: 'Sistema Operante | Motor Híbrido Ativo' })
            .setTimestamp();

          await interaction.channel.send({ embeds: [embedFake] });
        }

        if (interaction.customId === 'vip_dashboard') {
          // Aqui no futuro a gente vai abrir um Modal ou um Menu Select completão
          const vipEmbed = new EmbedBuilder()
            .setTitle('💎 Painel VIP - KodaAI')
            .setDescription('Acesso restrito. Este módulo trará **OCR (Leitura de Prints)**, **Analytics de Retenção** e **Heurística Avançada Anti-Raid**.')
            .setColor('#FEE75C')
            .setFooter({ text: 'Em desenvolvimento pela engenharia.' });

          await interaction.reply({ embeds: [vipEmbed], ephemeral: true });
        }
      } catch (error) {
        console.error('Erro ao processar botão:', error);
      }
    }
  }
};