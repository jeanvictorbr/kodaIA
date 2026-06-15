// src/database/prisma.js

// 👈 Importando o PrismaClient diretamente da pasta blindada que geramos, 
// bypassando o node_modules completamente.
import { PrismaClient } from './client/index.js'; 

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;