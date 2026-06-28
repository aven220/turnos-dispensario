import { Prisma, TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { datePrefixToLabel, todayPrefix } from '../utils/date.js';

export interface WindowHistorySummary {
  windowId: string;
  windowName: string;
  windowNumber: number;
  attended: number;
  absent: number;
  cancelled: number;
}

async function buildDaySummary(datePrefix: string) {
  const tickets = await prisma.ticket.findMany({
    where: { datePrefix },
    select: {
      status: true,
      windowId: true,
      window: { select: { id: true, name: true, number: true } },
    },
  });

  const generated = tickets.filter((t) => t.status !== TicketStatus.CANCELADO).length;
  const attended = tickets.filter((t) => t.status === TicketStatus.FINALIZADO).length;
  const absent = tickets.filter((t) => t.status === TicketStatus.AUSENTE).length;
  const cancelled = tickets.filter((t) => t.status === TicketStatus.CANCELADO).length;
  const pending = tickets.filter((t) => t.status === TicketStatus.GENERADO).length;

  const byWindow = new Map<string, WindowHistorySummary>();

  for (const t of tickets) {
    if (!t.windowId || !t.window) continue;
    const existing = byWindow.get(t.windowId) ?? {
      windowId: t.window.id,
      windowName: t.window.name,
      windowNumber: t.window.number,
      attended: 0,
      absent: 0,
      cancelled: 0,
    };
    if (t.status === TicketStatus.FINALIZADO) existing.attended += 1;
    if (t.status === TicketStatus.AUSENTE) existing.absent += 1;
    if (t.status === TicketStatus.CANCELADO) existing.cancelled += 1;
    byWindow.set(t.windowId, existing);
  }

  const windowSummary = [...byWindow.values()].sort((a, b) => a.windowNumber - b.windowNumber);

  return { generated, attended, absent, cancelled, pending, windowSummary };
}

export async function syncDailyHistoryForDate(datePrefix: string) {
  const summary = await buildDaySummary(datePrefix);
  if (summary.generated === 0 && summary.cancelled === 0) return null;

  return prisma.dailyHistory.upsert({
    where: { datePrefix },
    create: {
      datePrefix,
      generated: summary.generated,
      attended: summary.attended,
      absent: summary.absent,
      cancelled: summary.cancelled,
      pending: summary.pending,
      windowSummary: summary.windowSummary as unknown as Prisma.InputJsonValue,
    },
    update: {
      generated: summary.generated,
      attended: summary.attended,
      absent: summary.absent,
      cancelled: summary.cancelled,
      pending: summary.pending,
      windowSummary: summary.windowSummary as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Sincroniza historial de todos los días con turnos (incluye hoy). */
export async function syncAllDailyHistory(): Promise<number> {
  const groups = await prisma.ticket.groupBy({
    by: ['datePrefix'],
    _count: { _all: true },
    orderBy: { datePrefix: 'desc' },
  });

  let synced = 0;
  for (const g of groups) {
    await syncDailyHistoryForDate(g.datePrefix);
    synced += 1;
  }
  return synced;
}

export async function listDailyHistory(limit = 90) {
  await syncDailyHistoryForDate(todayPrefix());

  const existing = await prisma.dailyHistory.count();
  if (existing === 0) {
    await syncAllDailyHistory();
  }

  const rows = await prisma.dailyHistory.findMany({
    orderBy: { datePrefix: 'desc' },
    take: limit,
  });

  return rows.map((r) => ({
    datePrefix: r.datePrefix,
    dateLabel: datePrefixToLabel(r.datePrefix),
    generated: r.generated,
    attended: r.attended,
    absent: r.absent,
    cancelled: r.cancelled,
    pending: r.pending,
    windowSummary: (r.windowSummary as WindowHistorySummary[] | null) ?? [],
    archivedAt: r.archivedAt,
    isToday: r.datePrefix === todayPrefix(),
  }));
}

export async function getDispensationsForDay(datePrefix: string) {
  const tickets = await prisma.ticket.findMany({
    where: {
      datePrefix,
      status: { in: [TicketStatus.FINALIZADO, TicketStatus.AUSENTE] },
    },
    include: {
      priority: true,
      window: true,
      createdBy: { select: { fullName: true } },
    },
    orderBy: [{ finishedAt: 'asc' }, { createdAt: 'asc' }],
  });

  const history = await prisma.dailyHistory.findUnique({ where: { datePrefix } });

  return {
    datePrefix,
    dateLabel: datePrefixToLabel(datePrefix),
    summary: history ?? (await buildDaySummary(datePrefix)),
    dispensations: tickets.map((t) => ({
      id: t.id,
      displayCode: t.displayCode,
      uniqueCode: t.uniqueCode,
      status: t.status,
      priority: t.priority.name,
      priorityCode: t.priority.code,
      windowName: t.window?.name ?? null,
      windowNumber: t.window?.number ?? null,
      createdAt: t.createdAt,
      calledAt: t.calledAt,
      attendingAt: t.attendingAt,
      finishedAt: t.finishedAt,
      waitSeconds:
        t.calledAt && t.createdAt
          ? Math.round((t.calledAt.getTime() - t.createdAt.getTime()) / 1000)
          : null,
      attentionSeconds:
        t.attendingAt && t.finishedAt
          ? Math.round((t.finishedAt.getTime() - t.attendingAt.getTime()) / 1000)
          : null,
    })),
  };
}
