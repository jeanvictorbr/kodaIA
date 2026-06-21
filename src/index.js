// src/index.js
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// 🛡️ SISTEMA ANTI-CRASH (Evita que o bot desligue por erros inesperados)
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 [Anti-Crash] Rejeição não tratada:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('🚨 [Anti-Crash] Exceção não capturada:', error);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicialização do Client com os Intents necessários
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,   
    ],
});

client.commands = new Collection();
const commandsArray = [];

// ==========================================
// 1. CARREGAR COMANDOS (Slash Commands)
// ==========================================
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(`file://${filePath}`)).default;
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsArray.push(command.data.toJSON());
    }
}

// ==========================================
// 2. CARREGAR EVENTOS
// ==========================================
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = (await import(`file://${filePath}`)).default;
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// ==========================================
// 3. REGISTRAR COMANDOS (SISTEMA INTELIGENTE)
// ==========================================
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        // Se a variável GUILD_ID existir e não estiver vazia -> Registra Localmente (Instantâneo)
        if (process.env.GUILD_ID) {
            console.log(`🔄 [API] GUILD_ID detectado. Registrando ${commandsArray.length} comandos LOCALMENTE no servidor...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), 
                { body: commandsArray },
            );
            console.log('✅ [API] Comandos (/) sincronizados LOCALMENTE com sucesso!');
        } 
        // Se a variável GUILD_ID não existir -> Registra Globalmente (Leva até 1h no Discord)
        else {
            console.log(`🔄 [API] Nenhum GUILD_ID configurado. Registrando ${commandsArray.length} comandos GLOBALMENTE...`);
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID), 
                { body: commandsArray },
            );
            console.log('✅ [API] Comandos (/) sincronizados GLOBALMENTE com sucesso!');
        }
    } catch (error) {
        console.error('🚨 [API] Erro ao sincronizar comandos:', error);
    }
});

// Ligar o bot
client.login(process.env.DISCORD_TOKEN);