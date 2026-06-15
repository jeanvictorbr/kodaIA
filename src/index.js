// src/index.js
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config();

// Truque de Mestre pra ES Modules lidarem com caminhos de pastas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection(); // Nosso cache O(1) de comandos na RAM

// ==========================================
// 🚀 HANDLER DE COMANDOS (Dinâmico)
// ==========================================
const commandsPath = path.join(__dirname, 'commands');
// Cria a pasta se não existir pra não dar crash
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath, { recursive: true });

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // Importação dinâmica usando URL (obrigatório em ES Modules)
  const { default: command } = await import(pathToFileURL(filePath).href);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ [Handler] Comando /${command.data.name} carregado.`);
  } else {
    console.log(`⚠️ [Handler] Aviso: O comando em ${file} tá sem "data" ou "execute".`);
  }
}

// ==========================================
// 📡 HANDLER DE EVENTOS (Dinâmico)
// ==========================================
const eventsPath = path.join(__dirname, 'events');
if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath, { recursive: true });

const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const { default: event } = await import(pathToFileURL(filePath).href);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`📡 [Handler] Evento ${event.name} na escuta.`);
}

// ==========================================
// 🔥 LIGANDO OS MOTORES
// ==========================================
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log(`\n🔥 [KodaAI] Tá online, pai! Logado no Discord.\n`))
  .catch(err => console.error('❌ [KodaAI] Erro fatal no login:', err));