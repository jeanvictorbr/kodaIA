// start.js
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

// O override: true força o sistema a usar as variáveis do sistema/painel 
// mesmo que o dotenv ache algo conflitante
dotenv.config({ override: true }); 

console.log('🔍 [DIAGNÓSTICO DE API KEYS]');
// Agora ele vai mostrar se enxergou o que você colocou no painel da Discloud
console.log('Gemini Key:', process.env.GEMINI_API_KEY ? '✅ Presente' : '❌ VAZIA');
console.log('Groq Key:', process.env.LLAMA_API_KEY ? '✅ Presente' : '❌ VAZIA');

// ... resto do seu código de start.js ...
dotenv.config();

console.log('🔄 [Discloud] Hackeando a Matrix: Preparando Banco de Dados...');

try {
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
  console.log('✅ [1/2] Prisma Client gerado com sucesso.');

  // Aqui é a hora da verdade. Se o banco rejeitar, ele morre aqui.
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });
  console.log('✅ [2/2] Tabelas sincronizadas com sucesso no PostgreSQL!');
  
} catch (error) {
  console.error('\n🚨🚨🚨 [ERRO FATAL NO BANCO DE DADOS] 🚨🚨🚨');
  console.error('O Prisma não conseguiu conectar no seu PostgreSQL.');
  console.error('Verifique se a sua DATABASE_URL está correta no painel da Discloud!');
  console.error('A nave foi abortada para evitar corromper o sistema.');
  process.exit(1); // Mata o bot na hora
}

console.log('🚀 [KodaAI] Banco conectado! Iniciando a nave principal...');
import('./src/index.js');