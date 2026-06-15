// start.js
import { execSync } from 'node:child_process';

console.log('🔍 [DIAGNÓSTICO DE API KEYS]');
// Aqui ele lê direto do ambiente da Discloud, sem precisar de arquivo .env
console.log('Gemini Key:', process.env.GEMINI_API_KEY ? '✅ Presente' : '❌ VAZIA');
console.log('Groq Key:', process.env.LLAMA_API_KEY ? '✅ Presente' : '❌ VAZIA');

console.log('🔄 [Discloud] Preparando Banco de Dados...');

try {
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });
  console.log('✅ [2/2] Banco sincronizado!');
} catch (error) {
  console.error('🚨 Erro crítico no banco:', error);
  process.exit(1);
}

console.log('🚀 [KodaAI] Iniciando bot...');
import('./src/index.js');