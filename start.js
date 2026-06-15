// start.js
import { execSync } from 'node:child_process';

console.log('🔄 [Discloud] Hackeando a Matrix: Forçando a geração do Prisma...');

try {
  // Isso trava o servidor e obriga ele a gerar o banco antes de qualquer coisa
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ [Discloud] Prisma gerado com sucesso no coração do servidor!');
} catch (error) {
  console.error('🚨 [Discloud] Erro crítico ao gerar:', error);
}

console.log('🚀 [KodaAI] Iniciando a nave principal...');
// Só agora, com o banco pronto, a gente liga o seu código
import('./src/index.js');