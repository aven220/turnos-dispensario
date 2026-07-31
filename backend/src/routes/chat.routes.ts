import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import {
  getChatSettings,
  getUnreadCounts,
  getUnreadForWindow,
  listChatMessages,
  markChatRead,
  sendChatMessage,
  updateChatSettings,
} from '../services/chat.service.js';
import { paramId } from '../utils/params.js';

const router = Router();
router.use(authMiddleware);

router.get('/settings', requireRoles(UserRole.ADMIN, UserRole.WINDOW), async (_req, res) => {
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

router.get('/unread', requireRoles(UserRole.ADMIN, UserRole.WINDOW), async (req, res) => {
  if (req.user!.role === UserRole.WINDOW) {
    // ventana: necesita windowId via query o assignment
    const windowId = typeof req.query.windowId === 'string' ? req.query.windowId : null;
    if (!windowId) {
      res.json({ total: 0, byWindow: [] });
      return;
    }
    const count = await getUnreadForWindow(windowId);
    res.json({ total: count, byWindow: [{ windowId, count }] });
    return;
  }

  const counts = await getUnreadCounts(UserRole.ADMIN);
  res.json(counts);
});

router.get('/windows/:windowId', requireRoles(UserRole.ADMIN, UserRole.WINDOW), async (req, res, next) => {
  try {
    const windowId = paramId(req, 'windowId');
    if (req.user!.role === UserRole.WINDOW) {
      // Solo su ventanilla — validación ligera por session/assignment se deja en body de envío
    }
    const data = await listChatMessages(windowId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/windows/:windowId', requireRoles(UserRole.ADMIN, UserRole.WINDOW), async (req, res, next) => {
  try {
    const windowId = paramId(req, 'windowId');
    const { body } = z.object({ body: z.string().min(1).max(1000) }).parse(req.body);

    if (req.user!.role === UserRole.WINDOW) {
      const { prisma } = await import('../config/prisma.js');
      const assignment = await prisma.windowOperator.findUnique({ where: { userId: req.user!.sub } });
      if (!assignment || assignment.windowId !== windowId) {
        res.status(403).json({ error: 'Solo puede chatear en su ventanilla' });
        return;
      }
    }

    const message = await sendChatMessage({
      windowId,
      senderId: req.user!.sub,
      senderRole: req.user!.role,
      body,
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.post('/windows/:windowId/read', requireRoles(UserRole.ADMIN, UserRole.WINDOW), async (req, res, next) => {
  try {
    const windowId = paramId(req, 'windowId');
    if (req.user!.role === UserRole.WINDOW) {
      const { prisma } = await import('../config/prisma.js');
      const assignment = await prisma.windowOperator.findUnique({ where: { userId: req.user!.sub } });
      if (!assignment || assignment.windowId !== windowId) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    }
    await markChatRead(windowId, req.user!.role);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
