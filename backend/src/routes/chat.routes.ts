import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import {
  getChatSettings,
  getUnreadForUser,
  listChatMessages,
  listChatParticipants,
  markChatRead,
  markMessageDelivered,
  sendChatMessage,
  updateChatSettings,
} from '../services/chat.service.js';
import { paramId } from '../utils/params.js';

const ALL_ROLES = [
  UserRole.ADMIN,
  UserRole.WINDOW,
  UserRole.FILTER,
  UserRole.AREA_MANAGER,
  UserRole.AUDITOR,
] as const;

const router = Router();
router.use(authMiddleware);

router.get('/settings', requireRoles(...ALL_ROLES), async (_req, res) => {
  const settings = await getChatSettings();
  res.json(settings);
});

router.patch('/settings', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = z
      .object({
        chatEnabled: z.boolean().optional(),
        chatSoundEnabled: z.boolean().optional(),
      })
      .parse(req.body);
    const settings = await updateChatSettings(body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.get('/unread', requireRoles(...ALL_ROLES), async (req, res) => {
  const counts = await getUnreadForUser(req.user!.sub, req.user!.role);
  res.json(counts);
});

router.get('/participants', requireRoles(UserRole.ADMIN), async (_req, res) => {
  const participants = await listChatParticipants();
  res.json(participants);
});

router.get('/threads/:userId', requireRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    const userId = paramId(req, 'userId');
    if (req.user!.role !== UserRole.ADMIN && req.user!.sub !== userId) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }
    const data = await listChatMessages(userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/threads/:userId', requireRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    const userId = paramId(req, 'userId');
    const { body } = z.object({ body: z.string().min(1).max(1000) }).parse(req.body);

    if (req.user!.role !== UserRole.ADMIN && req.user!.sub !== userId) {
      res.status(403).json({ error: 'Solo puede chatear con el administrador' });
      return;
    }

    const message = await sendChatMessage({
      participantId: userId,
      senderId: req.user!.sub,
      senderRole: req.user!.role,
      body,
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.post('/threads/:userId/read', requireRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    const userId = paramId(req, 'userId');
    if (req.user!.role !== UserRole.ADMIN && req.user!.sub !== userId) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }
    await markChatRead(userId, req.user!.sub, req.user!.role);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/messages/:messageId/delivered', requireRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    const messageId = paramId(req, 'messageId');
    const updated = await markMessageDelivered(messageId, req.user!.sub, req.user!.role);
    res.json(updated ?? { ok: true });
  } catch (err) {
    next(err);
  }
});

// Compatibilidad: rutas antiguas por ventanilla → redirigen a hilo del operador asignado
router.get('/windows/:windowId', requireRoles(UserRole.ADMIN, UserRole.WINDOW), async (req, res, next) => {
  try {
    const { prisma } = await import('../config/prisma.js');
    const windowId = paramId(req, 'windowId');
    const op = await prisma.windowOperator.findFirst({ where: { windowId } });
    if (!op) {
      res.json({ messages: [], relatedTicket: null, participantId: null });
      return;
    }
    if (req.user!.role === UserRole.WINDOW && req.user!.sub !== op.userId) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }
    const data = await listChatMessages(op.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
