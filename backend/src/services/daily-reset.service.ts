import { TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { todayPrefix } from '../utils/date.js';
import { syncAllDailyHistory, syncDailyHistoryForDate } from './daily-history.service.js';

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
  await closePreviousDayTickets();
  await syncDailyHistoryForDate(todayPrefix());
}
