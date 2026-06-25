import { UserRole, TicketStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authMiddleware, getClientIp, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { ticketService } from '../services/ticket.service.js';
import { paramId } from '../utils/params.js';

const router = Router();

const windowSchema = z.object({
  name: z.string().min(1),
  number: z.number().int().positive(),
});

router.get('/', async (_req, res) => {
  const windows = await prisma.window.findMany({
    include: {
      operators: { include: { user: { select: { id: true, fullName: true } } } },
      priorities: { include: { priority: true }, orderBy: { sortOrder: 'asc' } },
      sessions: {
        where: { endedAt: null },
        include: { user: { select: { fullName: true } } },
        take: 1,
        orderBy: { startedAt: 'desc' },
      },
    },
    orderBy: { number: 'asc' },
  });

  const enriched = await Promise.all(
    windows.map(async (w) => {
      const state = await ticketService.getWindowState(w.id);
      return {
        ...w,
        currentTicket: state.activeTicket,
        todayServed: state.todayServed,
        activeSession: state.session,
      };
    })
  );

  res.json(enriched);
});

router.get('/mine', authMiddleware, requireRoles(UserRole.WINDOW), async (req, res) => {
  const assignments = await prisma.windowOperator.findMany({
    where: { userId: req.user!.sub },
    include: {
      window: {
        include: {
          priorities: { include: { priority: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });
  res.json(assignments.map((a) => a.window));
});

router.post('/', authMiddleware, requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = windowSchema.parse(req.body);

    const taken = await prisma.window.findUnique({ where: { number: body.number } });
    if (taken) {
      res.status(400).json({ error: `El número ${body.number} ya está en uso por ${taken.name}` });
      return;
    }

    const window = await prisma.window.create({ data: body });
    await logAudit({ userId: req.user!.sub, action: 'VENTANILLA_CREADA', details: window.name, windowId: window.id, ipAddress: getClientIp(req) });
    res.status(201).json(window);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authMiddleware, requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = windowSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
    const windowId = paramId(req);

    const current = await prisma.window.findUniqueOrThrow({ where: { id: windowId } });

    if (body.number !== undefined && body.number !== current.number) {
      const taken = await prisma.window.findFirst({ where: { number: body.number, id: { not: windowId } } });
      if (taken) {
        res.status(400).json({ error: `El número ${body.number} ya está en uso por ${taken.name}` });
        return;
      }
    }

    const window = await prisma.window.update({
      where: { id: windowId },
      data: body,
    });

    const changes: string[] = [];
    if (body.name !== undefined && body.name !== current.name) changes.push(`nombre: ${current.name} → ${body.name}`);
    if (body.number !== undefined && body.number !== current.number) changes.push(`número: ${current.number} → ${body.number}`);
    if (body.isActive !== undefined && body.isActive !== current.isActive) changes.push(body.isActive ? 'activada' : 'desactivada');

    await logAudit({
      userId: req.user!.sub,
      action: 'VENTANILLA_EDITADA',
      details: changes.join(', ') || window.name,
      windowId,
      ipAddress: getClientIp(req),
    });

    res.json(window);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/operators', authMiddleware, requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { userId, force } = z.object({ userId: z.string(), force: z.boolean().optional() }).parse(req.body);
    const windowId = paramId(req);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.WINDOW) {
      res.status(400).json({ error: 'Solo operadores de ventanilla pueden ser asignados' });
      return;
    }

    const existing = await prisma.windowOperator.findUnique({
      where: { userId },
      include: { window: true, user: { select: { fullName: true } } },
    });

    if (existing?.windowId === windowId) {
      res.json(existing);
      return;
    }

    if (existing && !force) {
      res.status(409).json({
        error: `${existing.user.fullName} ya está en ${existing.window.name}. Use reasignar para moverlo.`,
        code: 'OPERATOR_ALREADY_ASSIGNED',
        operator: { id: userId, fullName: existing.user.fullName },
        currentWindow: { id: existing.window.id, name: existing.window.name, number: existing.window.number },
      });
      return;
    }

    const assignment = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.windowOperator.delete({ where: { userId } });
      }
      return tx.windowOperator.create({
        data: { windowId, userId },
        include: { user: { select: { fullName: true } }, window: true },
      });
    });

    const action = existing ? 'OPERADOR_REASIGNADO' : 'OPERADOR_ASIGNADO';
    const details = existing
      ? `${assignment.user.fullName}: ${existing.window.name} → ${assignment.window.name}`
      : `${assignment.user.fullName} → ${assignment.window.name}`;

    await logAudit({
      userId: req.user!.sub,
      action,
      details,
      windowId,
      ipAddress: getClientIp(req),
    });
    res.status(existing ? 200 : 201).json(assignment);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/operators', authMiddleware, requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const windowId = paramId(req);

    const openSession = await prisma.operatorSession.findFirst({
      where: { windowId, endedAt: null },
      include: { user: { select: { fullName: true } } },
    });
    if (openSession) {
      res.status(400).json({
        error: `${openSession.user.fullName} tiene sesión abierta en esta ventanilla. Debe cerrar sesión primero.`,
      });
      return;
    }

    const removed = await prisma.windowOperator.deleteMany({ where: { windowId } });
    if (removed.count === 0) {
      res.status(404).json({ error: 'Esta ventanilla no tiene operador asignado' });
      return;
    }

    const window = await prisma.window.findUnique({ where: { id: windowId } });
    await logAudit({
      userId: req.user!.sub,
      action: 'OPERADOR_DESASIGNADO',
      details: window?.name ?? windowId,
      windowId,
      ipAddress: getClientIp(req),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const windowId = paramId(req);
    const window = await prisma.window.findUniqueOrThrow({ where: { id: windowId } });

    const busyTicket = await prisma.ticket.findFirst({
      where: {
        windowId,
        status: { in: [TicketStatus.LLAMADO, TicketStatus.ATENDIENDO] },
      },
    });
    if (busyTicket) {
      res.status(400).json({
        error: `No se puede eliminar: hay un turno en curso (${busyTicket.displayCode}). Finalícelo o márquelo ausente primero.`,
      });
      return;
    }

    const openSession = await prisma.operatorSession.findFirst({ where: { windowId, endedAt: null } });
    if (openSession) {
      res.status(400).json({ error: 'No se puede eliminar: hay un operador con sesión abierta.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.windowOperator.deleteMany({ where: { windowId } });
      await tx.windowPriority.deleteMany({ where: { windowId } });
      await tx.operatorSession.updateMany({
        where: { windowId, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.ticket.updateMany({ where: { windowId }, data: { windowId: null } });
      await tx.window.delete({ where: { id: windowId } });
    });

    await logAudit({
      userId: req.user!.sub,
      action: 'VENTANILLA_ELIMINADA',
      details: `${window.name} (nº ${window.number})`,
      ipAddress: getClientIp(req),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put('/:id/priorities', authMiddleware, requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { priorityIds } = z.object({ priorityIds: z.array(z.string()) }).parse(req.body);
    const windowId = paramId(req);

    await prisma.$transaction([
      prisma.windowPriority.deleteMany({ where: { windowId } }),
      ...priorityIds.map((priorityId, index) =>
        prisma.windowPriority.create({
          data: { windowId, priorityId, sortOrder: index + 1 },
        })
      ),
    ]);

    const window = await prisma.window.findUnique({
      where: { id: windowId },
      include: { priorities: { include: { priority: true }, orderBy: { sortOrder: 'asc' } } },
    });

    await logAudit({ userId: req.user!.sub, action: 'PRIORIDADES_VENTANILLA', details: window?.name, windowId, ipAddress: getClientIp(req) });
    res.json(window);
  } catch (err) {
    next(err);
  }
});

export default router;
