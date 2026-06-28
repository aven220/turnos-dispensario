import { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authMiddleware, getClientIp, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { paramId } from '../utils/params.js';

const router = Router();
router.use(authMiddleware, requireRoles(UserRole.ADMIN));

const userSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6).optional(),
  fullName: z.string().min(2),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).optional(),
});

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      status: true,
      createdAt: true,
      windowAssignments: { include: { window: true } },
    },
    orderBy: { fullName: 'asc' },
  });
  res.json(users);
});

router.post('/', async (req, res, next) => {
  try {
    const raw = {
      ...req.body,
      username: typeof req.body.username === 'string' ? req.body.username.trim() : req.body.username,
      fullName: typeof req.body.fullName === 'string' ? req.body.fullName.trim() : req.body.fullName,
      password: typeof req.body.password === 'string' ? req.body.password.trim() : req.body.password,
    };
    const body = userSchema.parse(raw);
    if (!body.password) {
      res.status(400).json({ error: 'La contraseña es requerida' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) {
      res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await bcrypt.hash(body.password.trim(), 10),
        fullName: body.fullName,
        role: body.role,
      },
      select: { id: true, username: true, fullName: true, role: true, status: true },
    });

    await logAudit({ userId: req.user!.sub, action: 'USUARIO_CREADO', details: user.username, ipAddress: getClientIp(req) });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const userId = paramId(req);
    const raw = {
      ...req.body,
      username: typeof req.body.username === 'string' ? req.body.username.trim() : req.body.username,
      fullName: typeof req.body.fullName === 'string' ? req.body.fullName.trim() : req.body.fullName,
      password: typeof req.body.password === 'string' ? req.body.password.trim() : req.body.password,
    };
    const body = userSchema.partial().parse(raw);

    const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (body.username && body.username !== current.username) {
      const taken = await prisma.user.findUnique({ where: { username: body.username } });
      if (taken) {
        res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
        return;
      }
    }

    const data: Record<string, unknown> = {};
    if (body.username !== undefined) data.username = body.username;
    if (body.fullName !== undefined) data.fullName = body.fullName;
    if (body.role !== undefined) data.role = body.role;
    if (body.status !== undefined) data.status = body.status;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password.trim(), 10);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, fullName: true, role: true, status: true },
    });

    const actions: string[] = [];
    if (body.password) actions.push('contraseña restablecida');
    if (body.username && body.username !== current.username) actions.push(`usuario: ${current.username} → ${body.username}`);
    if (body.fullName && body.fullName !== current.fullName) actions.push('nombre actualizado');
    if (body.role && body.role !== current.role) actions.push(`rol: ${current.role} → ${body.role}`);
    if (body.status && body.status !== current.status) actions.push(body.status === 'ACTIVE' ? 'reactivado' : 'desactivado');

    await logAudit({
      userId: req.user!.sub,
      action: body.password ? 'CONTRASEÑA_RESTABLECIDA' : 'USUARIO_EDITADO',
      details: actions.join(', ') || user.username,
      ipAddress: getClientIp(req),
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/deactivate', async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: paramId(req) },
      data: { status: UserStatus.INACTIVE },
      select: { id: true, username: true, fullName: true, role: true, status: true },
    });
    await logAudit({ userId: req.user!.sub, action: 'USUARIO_DESACTIVADO', details: user.username, ipAddress: getClientIp(req) });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
