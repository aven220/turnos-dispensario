import { TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { todayPrefix } from '../utils/date.js';

export async function closePreviousDayTickets(): Promise<number> {
  const today = todayPrefix();
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
  return result.count;
}

export async function ensureDailyOperations(): Promise<void> {
  await closePreviousDayTickets();
}
