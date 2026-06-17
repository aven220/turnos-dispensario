import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authMiddleware, getClientIp, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { paramId } from '../utils/params.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true' && req.user!.role === UserRole.ADMIN;
  const priorities = await prisma.priority.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { _count: { select: { tickets: true } } },
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  });
  res.json(priorities);
});

const prioritySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(5),
  sortOrder: z.coerce.number().int().positive('El acomodo debe ser 1 o mayor'),
});

router.post('/', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = prioritySchema.parse({
      ...req.body,
      name: typeof req.body.name === 'string' ? req.body.name.trim() : req.body.name,
      code: typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : req.body.code,
    });

    const existing = await prisma.priority.findUnique({ where: { code: body.code } });
    if (existing) {
      res.status(400).json({ error: `El código ${body.code} ya está registrado` });
      return;
    }

    const priority = await prisma.priority.create({ data: body });
    await logAudit({ userId: req.user!.sub, action: 'PRIORIDAD_CREADA', details: priority.name, ipAddress: getClientIp(req) });
    res.status(201).json(priority);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const priorityId = paramId(req);
    const raw = {
      ...req.body,
      name: typeof req.body.name === 'string' ? req.body.name.trim() : req.body.name,
      code: typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : req.body.code,
    };
    const body = prioritySchema.partial().extend({ isActive: z.boolean().optional() }).parse(raw);

    const current = await prisma.priority.findUniqueOrThrow({ where: { id: priorityId } });

    if (body.code && body.code !== current.code) {
      const taken = await prisma.priority.findFirst({ where: { code: body.code, id: { not: priorityId } } });
      if (taken) {
        res.status(400).json({ error: `El código ${body.code} ya está en uso` });
        return;
      }
    }

    const priority = await prisma.priority.update({ where: { id: priorityId }, data: body });
    await logAudit({ userId: req.user!.sub, action: 'PRIORIDAD_EDITADA', details: priority.name, ipAddress: getClientIp(req) });
    res.json(priority);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const priorityId = paramId(req);
    const priority = await prisma.priority.findUniqueOrThrow({
      where: { id: priorityId },
      include: { _count: { select: { tickets: true } } },
    });

    if (priority._count.tickets > 0) {
      res.status(400).json({
        error: `No se puede eliminar: tiene ${priority._count.tickets} turno(s) asociado(s). Desactívela si ya no la usa.`,
      });
      return;
    }

    await prisma.windowPriority.deleteMany({ where: { priorityId } });
    await prisma.priority.delete({ where: { id: priorityId } });
    await logAudit({
      userId: req.user!.sub,
      action: 'PRIORIDAD_ELIMINADA',
      details: `${priority.name} (${priority.code})`,
      ipAddress: getClientIp(req),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
