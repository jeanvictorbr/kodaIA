// src/database/prisma.js

// Importação compatível com ES Modules e CommonJS
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Padrão Singleton: Evita abrir centenas de conexões se o bot reiniciar rápido
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;