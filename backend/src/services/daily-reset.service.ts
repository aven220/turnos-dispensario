import { TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { startOfToday, todayPrefix } from '../utils/date.js';
import { syncDailyHistoryForDate } from './daily-history.service.js';
import { logAudit } from './audit.service.js';

import { getIO } from '../sockets/index.js';

/** Cierra sesiones de ventanilla abiertas desde el día anterior (o antes). */
export async function closeStaleOperatorSessions(): Promise<number> {
  const dayStart = startOfToday();

  const stale = await prisma.operatorSession.findMany({
    where: { endedAt: null, startedAt: { lt: dayStart } },
    select: { id: true, windowId: true, userId: true },
  });

  if (stale.length === 0) return 0;

  const now = new Date();
  await prisma.operatorSession.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { endedAt: now },
  });

  for (const session of stale) {
    await logAudit({
      userId: session.userId,
      action: 'SESION_CERRADA_DIA',
      details: 'Cierre automático al iniciar nueva jornada',
      windowId: session.windowId,
    });
  }

  try {
    const io = getIO();
    for (const session of stale) {
      io.to('admin').emit('window:session-ended', { windowId: session.windowId });
      io.to(`window:${session.windowId}`).emit('window:session-ended', { windowId: session.windowId });
    }
  } catch {
    // Socket no inicializado en migraciones/tests
  }

  return stale.length;
}

export async function closePreviousDayTickets(): Promise<number> {
  const today = todayPrefix();

  const staleDays = await prisma.ticket.findMany({
    where: {
      datePrefix: { not: today },
      status: { in: [TicketStatus.GENERADO, TicketStatus.LLAMADO, TicketStatus.ATENDIENDO] },
    },
    select: { datePrefix: true },
    distinct: ['datePrefix'],
  });

  const result = await prisma.ticket.updateMany({
    where: {
      datePrefix: { not: today },
      status: { in: [TicketStatus.GENERADO, TicketStatus.LLAMADO, TicketStatus.ATENDIENDO] },
    },
    data: {
      status: TicketStatus.CANCELADO,
      finishedAt: new Date(),
    },
  });

  for (const { datePrefix } of staleDays) {
    await syncDailyHistoryForDate(datePrefix);
  }

  return result.count;
}

export async function ensureDailyOperations(): Promise<void> {
  await closeStaleOperatorSessions();
  await closePreviousDayTickets();
  await syncDailyHistoryForDate(todayPrefix());
}
