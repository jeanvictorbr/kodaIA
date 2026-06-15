// src/events/ready.js

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`\n🔥 [KodaAI] Tá online, pai! Logado como: ${client.user.tag}`);
    
    try {
      const commandsArray = client.commands.map(cmd => cmd.data.toJSON());
      
      console.log('🔄 [Discord API] Sincronizando Slash Commands...');
      
      const testGuildId = process.env.TEST_GUILD_ID;

      if (testGuildId) {
        // Sincroniza apenas no servidor de testes (Atualização imediata)
        await client.application.commands.set(commandsArray, testGuildId);
        console.log(`✅ [Discord API] Comandos registrados LOCALMENTE no servidor: ${testGuildId}`);
      } else {
        // Sincroniza globalmente
        await client.application.commands.set(commandsArray);
        console.log(`✅ [Discord API] Comandos registrados GLOBALMENTE com sucesso!`);
      }
      
      console.log(`🛡️  Segurança Multi-Guild operante e aguardando chamadas.\n`);
    } catch (error) {
      console.error('🚨 [Erro Fatal] Falha ao sincronizar comandos com o Discord:', error);
    }
  }
};