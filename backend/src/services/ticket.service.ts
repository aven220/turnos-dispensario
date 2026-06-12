import { Prisma, TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { datePrefixToLabel, formatDisplayCode, formatUniqueCode, parseDatePrefix, todayPrefix } from '../utils/date.js';
import { ensureDailyOperations } from './daily-reset.service.js';
import { logAudit } from './audit.service.js';

const MAX_CALLS = 3;

export class TicketService {
  async createTicket(priorityId: string, createdById: string, ipAddress?: string) {
    await ensureDailyOperations();
    const datePrefix = todayPrefix();

    const ticket = await prisma.$transaction(async (tx) => {
      const priority = await tx.priority.findUniqueOrThrow({ where: { id: priorityId } });

      const counter = await tx.dailyCounter.upsert({
        where: { datePrefix_priorityId: { datePrefix, priorityId } },
        create: { datePrefix, priorityId, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });

      const sequenceNum = counter.lastNumber;
      const displayCode = formatDisplayCode(priority.code, sequenceNum);
      const uniqueCode = formatUniqueCode(datePrefix, priority.code, sequenceNum);

      return tx.ticket.create({
        data: {
          uniqueCode,
          displayCode,
          priorityId,
          createdById,
          sequenceNum,
          datePrefix,
          status: TicketStatus.GENERADO,
        },
        include: { priority: true, createdBy: { select: { id: true, fullName: true } } },
      });
    });

    await logAudit({
      userId: createdById,
      action: 'TURNO_GENERADO',
      details: ticket.displayCode,
      ticketId: ticket.id,
      ipAddress,
    });

    return ticket;
  }

  async takeNextTicket(windowId: string, userId: string, ipAddress?: string) {
    await ensureDailyOperations();
    const datePrefix = todayPrefix();

    const activeTicket = await prisma.ticket.findFirst({
      where: {
        windowId,
        status: { in: [TicketStatus.LLAMADO, TicketStatus.ATENDIENDO] },
      },
    });

    if (activeTicket) {
      throw new Error('La ventanilla ya tiene un turno activo');
    }

    const window = await prisma.window.findUniqueOrThrow({
      where: { id: windowId },
      include: {
        priorities: {
          include: { priority: true },
          orderBy: { priority: { sortOrder: 'asc' } },
        },
      },
    });

    const priorityIds = window.priorities.map((wp) => wp.priorityId);
    if (priorityIds.length === 0) {
      throw new Error('La ventanilla no tiene prioridades configuradas');
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const activeCheck = await tx.ticket.findFirst({
        where: {
          windowId,
          status: { in: [TicketStatus.LLAMADO, TicketStatus.ATENDIENDO] },
        },
      });
      if (activeCheck) throw new Error('La ventanilla ya tiene un turno activo');

      for (const priorityId of priorityIds) {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT t.id
          FROM tickets t
          WHERE t.status = 'GENERADO'
            AND t.priority_id = ${priorityId}
            AND t.date_prefix = ${datePrefix}
          ORDER BY t.created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;

        if (rows.length === 0) continue;

        const ticketId = rows[0].id;
        const now = new Date();

        return tx.ticket.update({
          where: { id: ticketId },
          data: {
            windowId,
            status: TicketStatus.LLAMADO,
            callCount: 1,
            calledAt: now,
          },
          include: {
            priority: true,
            window: true,
          },
        });
      }

      return null;
    });

    if (!ticket) {
      throw new Error('No hay turnos pendientes para esta ventanilla');
    }

    await logAudit({
      userId,
      action: 'TURNO_LLAMADO',
      details: ticket.displayCode,
      windowId,
      ticketId: ticket.id,
      ipAddress,
    });

    return ticket;
  }

  async repeatCall(ticketId: string, windowId: string, userId: string, ipAddress?: string) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    if (ticket.windowId !== windowId) {
      throw new Error('El turno no pertenece a esta ventanilla');
    }
    if (ticket.status !== TicketStatus.LLAMADO) {
      throw new Error('Solo se puede repetir un turno en estado LLAMADO');
    }
    if (ticket.callCount >= MAX_CALLS) {
      throw new Error('Se alcanzó el máximo de llamados (3)');
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { callCount: { increment: 1 } },
      include: { priority: true, window: true },
    });

    await logAudit({
      userId,
      action: 'TURNO_REPETIDO',
      details: `${updated.displayCode} (llamada ${updated.callCount})`,
      windowId,
      ticketId,
      ipAddress,
    });

    return updated;
  }

  async startAttention(ticketId: string, windowId: string, userId: string, ipAddress?: string) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    if (ticket.windowId !== windowId) throw new Error('El turno no pertenece a esta ventanilla');
    if (ticket.status !== TicketStatus.LLAMADO) throw new Error('El turno debe estar en estado LLAMADO');

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.ATENDIENDO, attendingAt: new Date() },
      include: { priority: true, window: true },
    });

    await logAudit({
      userId,
      action: 'ATENCION_INICIADA',
      details: updated.displayCode,
      windowId,
      ticketId,
      ipAddress,
    });

    return updated;
  }

  async finishAttention(ticketId: string, windowId: string, userId: string, ipAddress?: string) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    if (ticket.windowId !== windowId) throw new Error('El turno no pertenece a esta ventanilla');
    if (ticket.status !== TicketStatus.ATENDIENDO) throw new Error('El turno debe estar en estado ATENDIENDO');

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.FINALIZADO, finishedAt: now },
        include: { priority: true, window: true },
      });

      const session = await tx.operatorSession.findFirst({
        where: { userId, windowId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

      if (session) {
        await tx.operatorSession.update({
          where: { id: session.id },
          data: { ticketsServed: { increment: 1 } },
        });
      }

      return result;
    });

    await logAudit({
      userId,
      action: 'ATENCION_FINALIZADA',
      details: updated.displayCode,
      windowId,
      ticketId,
      ipAddress,
    });

    return updated;
  }

  async markAbsent(ticketId: string, windowId: string, userId: string, ipAddress?: string) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    if (ticket.windowId !== windowId) throw new Error('El turno no pertenece a esta ventanilla');
    if (ticket.status !== TicketStatus.LLAMADO) throw new Error('Solo se puede marcar ausente un turno LLAMADO');
    if (ticket.callCount < MAX_CALLS) {
      throw new Error('Debe realizar 3 llamados antes de marcar ausente');
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.AUSENTE, finishedAt: new Date() },
      include: { priority: true, window: true },
    });

    await logAudit({
      userId,
      action: 'TURNO_AUSENTE',
      details: updated.displayCode,
      windowId,
      ticketId,
      ipAddress,
    });

    return updated;
  }

  async getTodayTickets(filters?: { status?: TicketStatus; priorityId?: string }) {
    const datePrefix = todayPrefix();
    return prisma.ticket.findMany({
      where: {
        datePrefix,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priorityId && { priorityId: filters.priorityId }),
      },
      include: {
        priority: true,
        window: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecentCalls(limit = 10) {
    return prisma.ticket.findMany({
      where: {
        datePrefix: todayPrefix(),
        status: { in: [TicketStatus.LLAMADO, TicketStatus.ATENDIENDO, TicketStatus.FINALIZADO, TicketStatus.AUSENTE] },
      },
      include: { priority: true, window: true },
      orderBy: { calledAt: 'desc' },
      take: limit,
    });
  }

  async getAttendingTickets() {
    return prisma.ticket.findMany({
      where: {
        datePrefix: todayPrefix(),
        status: TicketStatus.ATENDIENDO,
        windowId: { not: null },
      },
      include: { priority: true, window: true },
      orderBy: { window: { number: 'asc' } },
    });
  }

  async getCurrentCall() {
    return prisma.ticket.findFirst({
      where: { datePrefix: todayPrefix(), status: TicketStatus.LLAMADO },
      include: { priority: true, window: true },
      orderBy: { calledAt: 'desc' },
    });
  }

  async getUpcomingTickets(limit = 3) {
    if (limit <= 0) return [];

    const datePrefix = todayPrefix();
    return prisma.ticket.findMany({
      where: { status: TicketStatus.GENERADO, datePrefix },
      include: { priority: true },
      orderBy: [{ priority: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
      take: limit,
    });
  }

  async getWindowState(windowId: string) {
    const activeTicket = await prisma.ticket.findFirst({
      where: {
        windowId,
        status: { in: [TicketStatus.LLAMADO, TicketStatus.ATENDIENDO] },
      },
      include: { priority: true },
    });

    const session = await prisma.operatorSession.findFirst({
      where: { windowId, endedAt: null },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { startedAt: 'desc' },
    });

    const todayServed = await prisma.ticket.count({
      where: {
        windowId,
        status: TicketStatus.FINALIZADO,
        datePrefix: todayPrefix(),
      },
    });

    return { activeTicket, session, todayServed };
  }

  async getStats(dateFrom?: Date, dateTo?: Date) {
    await ensureDailyOperations();

    const useDateRange = !!(dateFrom || dateTo);
    const where: Prisma.TicketWhereInput = useDateRange
      ? {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
      : { datePrefix: todayPrefix() };

    const [generated, attended, absent, cancelled] = await Promise.all([
      prisma.ticket.count({ where: { ...where, status: { not: TicketStatus.CANCELADO } } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.FINALIZADO } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.AUSENTE } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.CANCELADO } }),
    ]);

    const ticketWindowFilter: Prisma.TicketWhereInput = useDateRange
      ? {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
      : { datePrefix: todayPrefix() };

    const windows = await prisma.window.findMany({
      where: { isActive: true },
      include: {
        operators: { include: { user: { select: { fullName: true } } } },
        tickets: {
          where: ticketWindowFilter,
          select: { status: true, attendingAt: true, finishedAt: true, calledAt: true },
        },
      },
      orderBy: { number: 'asc' },
    });

    const windowStats = windows.map((w) => {
      const finalized = w.tickets.filter((t) => t.status === TicketStatus.FINALIZADO);
      const durations = finalized
        .filter((t) => t.attendingAt && t.finishedAt)
        .map((t) => (t.finishedAt!.getTime() - t.attendingAt!.getTime()) / 1000);

      const avgSeconds =
        durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

      return {
        windowId: w.id,
        windowName: w.name,
        windowNumber: w.number,
        totalAttended: finalized.length,
        totalAbsent: w.tickets.filter((t) => t.status === TicketStatus.AUSENTE).length,
        totalCalled: w.tickets.filter((t) => t.calledAt).length,
        avgAttentionSeconds: avgSeconds,
        assignedUser: w.operators[0]?.user.fullName ?? null,
      };
    });

    windowStats.sort((a, b) => b.totalAttended - a.totalAttended);

    return { generated, attended, absent, cancelled, windowStats, datePrefix: useDateRange ? undefined : todayPrefix() };
  }

  async getDailyReport(dateInput?: string) {
    await ensureDailyOperations();
    const datePrefix = parseDatePrefix(dateInput);

    const [windows, tickets] = await Promise.all([
      prisma.window.findMany({
        where: { isActive: true },
        include: { operators: { include: { user: { select: { fullName: true } } } } },
        orderBy: { number: 'asc' },
      }),
      prisma.ticket.findMany({
        where: { datePrefix },
        include: {
          priority: true,
          window: true,
          createdBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const windowReports = windows.map((w) => {
      const windowTickets = tickets.filter((t) => t.windowId === w.id);
      const finalized = windowTickets.filter((t) => t.status === TicketStatus.FINALIZADO);
      const durations = finalized
        .filter((t) => t.attendingAt && t.finishedAt)
        .map((t) => (t.finishedAt!.getTime() - t.attendingAt!.getTime()) / 1000);
      const avgSeconds =
        durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

      return {
        windowId: w.id,
        windowName: w.name,
        windowNumber: w.number,
        operator: w.operators[0]?.user.fullName ?? 'Sin asignar',
        totalHandled: windowTickets.length,
        attended: finalized.length,
        absent: windowTickets.filter((t) => t.status === TicketStatus.AUSENTE).length,
        pending: windowTickets.filter((t) => t.status === TicketStatus.GENERADO).length,
        avgAttentionSeconds: avgSeconds,
        tickets: windowTickets,
      };
    });

    const unassigned = tickets.filter((t) => !t.windowId);

    return {
      datePrefix,
      dateLabel: datePrefixToLabel(datePrefix),
      summary: {
        generated: tickets.filter((t) => t.status !== TicketStatus.CANCELADO).length,
        attended: tickets.filter((t) => t.status === TicketStatus.FINALIZADO).length,
        absent: tickets.filter((t) => t.status === TicketStatus.AUSENTE).length,
        cancelled: tickets.filter((t) => t.status === TicketStatus.CANCELADO).length,
        pending: tickets.filter((t) => t.status === TicketStatus.GENERADO).length,
      },
      windowReports,
      unassigned,
      tickets,
    };
  }
}

export const ticketService = new TicketService();
