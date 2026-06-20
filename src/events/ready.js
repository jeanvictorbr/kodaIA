// src/events/ready.js
import prisma from '../database/prisma.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ [Bot] Conectado como ${client.user.tag}`);
    client.user.setActivity('Protegendo servidores | /painel', { type: 3 });

    // ⏳ O CEIFADOR DE VIPS (Verifica expirações a cada 1 Hora)
    setInterval(async () => {
      try {
        const now = new Date();
        const expiredGuilds = await prisma.guild.findMany({
          where: { vip: true, vipExpiration: { lte: now } }
        });

        if (expiredGuilds.length > 0) {
          for (const guild of expiredGuilds) {
            await prisma.guild.update({
              where: { id: guild.id },
              data: { vip: false, vipExpiration: null }
            });
            console.log(`🗑️ [VIP Expirado Automático] O servidor ${guild.id} foi rebaixado para FREE.`);
          }
        }
      } catch (error) {
        console.error('🚨 Erro no Ceifador VIP:', error);
      }
    }, 60 * 60 * 1000); // 1 Hora em milissegundos

    // Roda uma verificação imediata assim que o bot liga
    try {
        const now = new Date();
        await prisma.guild.updateMany({
          where: { vip: true, vipExpiration: { lte: now } },
          data: { vip: false, vipExpiration: null }
        });
    } catch(e) { console.error('Erro no Ceifador inicial:', e); }
  }
};