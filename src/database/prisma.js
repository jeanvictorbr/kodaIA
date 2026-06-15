// src/database/prisma.js
import { PrismaClient } from '@prisma/client';

// Padrão Singleton: Evita abrir centenas de conexões se o bot reiniciar rápido
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;