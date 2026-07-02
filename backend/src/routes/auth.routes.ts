import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { authMiddleware, getClientIp } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  windowId: z.string().optional(),
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse({
      ...req.body,
      username: typeof req.body.username === 'string' ? req.body.username.trim() : req.body.username,
      password: typeof req.body.password === 'string' ? req.body.password.trim() : req.body.password,
    });
    const user = await prisma.user.findFirst({
      where: { username: { equals: body.username, mode: 'insensitive' } },
    });

    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(401).json({ error: 'Usuario inactivo. Contacte al administrador.' });
      return;
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    let resolvedWindowId: string | undefined;

    if (user.role === 'WINDOW') {
      const assignment = await prisma.windowOperator.findUnique({
        where: { userId: user.id },
      });

      if (!assignment) {
        res.status(403).json({ error: 'No tiene una ventanilla asignada. Contacte al administrador.' });
        return;
      }

      if (body.windowId && body.windowId !== assignment.windowId) {
        res.status(403).json({ error: 'Solo puede operar su ventanilla asignada' });
        return;
      }

      resolvedWindowId = assignment.windowId;

      const now = new Date();
      await prisma.operatorSession.updateMany({
        where: {
          endedAt: null,
          OR: [{ userId: user.id }, { windowId: resolvedWindowId }],
        },
        data: { endedAt: now },
      });

      await prisma.operatorSession.create({
        data: {
          userId: user.id,
          windowId: resolvedWindowId,
          availableForService: true,
        },
      });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, fullName: user.fullName },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      details: resolvedWindowId ? `Ventanilla ${resolvedWindowId}` : undefined,
      windowId: resolvedWindowId,
      ipAddress: getClientIp(req),
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
      windowId: resolvedWindowId,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  const userId = req.user!.sub;

  if (req.user!.role === 'WINDOW') {
    await prisma.operatorSession.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  await logAudit({
    userId,
    action: 'LOGOUT',
    ipAddress: getClientIp(req),
  });

  res.status(204).send();
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, username: true, role: true, fullName: true, status: true },
  });
  res.json(user);
});

const profileSchema = z.object({
  username: z.string().min(3).optional(),
  fullName: z.string().min(2).optional(),
  password: z.string().min(6).optional(),
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const raw = {
      ...req.body,
      username: typeof req.body.username === 'string' ? req.body.username.trim() : req.body.username,
      fullName: typeof req.body.fullName === 'string' ? req.body.fullName.trim() : req.body.fullName,
    };
    const body = profileSchema.parse(raw);
    const userId = req.user!.sub;

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
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, role: true, fullName: true, status: true },
    });

    await logAudit({
      userId,
      action: body.password ? 'PERFIL_CONTRASEÑA' : 'PERFIL_ACTUALIZADO',
      details: user.username,
      ipAddress: getClientIp(req),
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
