// start.js
import { execSync } from 'node:child_process';

console.log('🔄 [Discloud] Hackeando a Matrix: Preparando Banco de Dados...');

try {
  // O "generate" cria o cliente JS. O "db push" cria as tabelas no PostgreSQL real.
  execSync('npx prisma generate && npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log('✅ [Discloud] Tabelas e Prisma gerados com sucesso!');
} catch (error) {
  console.error('🚨 [Discloud] Erro crítico no banco de dados:', error);
}

console.log('🚀 [KodaAI] Iniciando a nave principal...');
import('./src/index.js');