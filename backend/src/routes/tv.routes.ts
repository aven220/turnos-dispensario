import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { authMiddleware, getClientIp, requireRoles } from '../middleware/auth.js';
import { mediaTypeFromMime, uploadTvMedia } from '../middleware/upload.js';
import { logAudit } from '../services/audit.service.js';
import { ensureDailyOperations } from '../services/daily-reset.service.js';
import { ticketService } from '../services/ticket.service.js';
import { getTvSettings, updateTvSettings } from '../services/tv-settings.service.js';
import { getIO } from '../sockets/index.js';
import { paramId } from '../utils/params.js';

const router = Router();

router.get('/display', async (_req, res) => {
  await ensureDailyOperations();
  const settings = await getTvSettings();
  const [currentCall, attending, media, ticker, upcoming] = await Promise.all([
    ticketService.getCurrentCall(),
    ticketService.getAttendingTickets(),
    prisma.tvMedia.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.tickerMessage.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ticketService.getUpcomingTickets(settings.upcomingCount),
  ]);

  res.json({ currentCall, attending, media, ticker, upcoming, settings });
});

router.use(authMiddleware, requireRoles(UserRole.ADMIN));

router.get('/settings', async (_req, res) => {
  const settings = await getTvSettings();
  res.json(settings);
});

router.patch('/settings', async (req, res, next) => {
  try {
    const body = z
      .object({
        upcomingCount: z.number().int().min(0).max(10).optional(),
        welcomeMessage: z.string().min(1).max(120).optional(),
      })
      .parse({
        ...req.body,
        welcomeMessage: typeof req.body.welcomeMessage === 'string' ? req.body.welcomeMessage.trim() : req.body.welcomeMessage,
      });
    const settings = await updateTvSettings(body);
    getIO().to('tv').emit('tv:settings-updated');
    await logAudit({
      userId: req.user!.sub,
      action: 'TV_CONFIG_ACTUALIZADA',
      details: `Próximos turnos: ${upcomingCount}`,
      ipAddress: getClientIp(req),
    });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.get('/media', async (_req, res) => {
  const media = await prisma.tvMedia.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(media);
});

router.post('/media/upload', uploadTvMedia.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Debe seleccionar un archivo' });
      return;
    }

    const title = (req.body.title as string)?.trim() || req.file.originalname;
    const url = `/uploads/tv/${req.file.filename}`;
    const type = mediaTypeFromMime(req.file.mimetype);

    const media = await prisma.tvMedia.create({
      data: { title, url, type },
    });

    getIO().to('tv').emit('tv:media-updated');
    await logAudit({ userId: req.user!.sub, action: 'TV_MEDIA_SUBIDO', details: media.title, ipAddress: getClientIp(req) });
    res.status(201).json(media);
  } catch (err) {
    next(err);
  }
});

router.post('/media', async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(1),
        url: z.string().url(),
        type: z.enum(['VIDEO', 'IMAGE']).optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body);

    const lower = body.url.toLowerCase();
    const type =
      body.type ??
      (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.endsWith('.mp4') || lower.endsWith('.webm')
        ? 'VIDEO'
        : 'IMAGE');

    const media = await prisma.tvMedia.create({ data: { ...body, type } });
    getIO().to('tv').emit('tv:media-updated');
    await logAudit({ userId: req.user!.sub, action: 'TV_MEDIA_CREADO', details: media.title, ipAddress: getClientIp(req) });
    res.status(201).json(media);
  } catch (err) {
    next(err);
  }
});

router.delete('/media/:id', async (req, res, next) => {
  try {
    await prisma.tvMedia.update({ where: { id: paramId(req) }, data: { isActive: false } });
    getIO().to('tv').emit('tv:media-updated');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/ticker', async (_req, res) => {
  const messages = await prisma.tickerMessage.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(messages);
});

router.post('/ticker', async (req, res, next) => {
  try {
    const body = z.object({ message: z.string().min(1), sortOrder: z.number().int().optional() }).parse({
      ...req.body,
      message: typeof req.body.message === 'string' ? req.body.message.trim() : req.body.message,
    });
    const msg = await prisma.tickerMessage.create({ data: body });
    getIO().to('tv').emit('tv:ticker-updated');
    await logAudit({ userId: req.user!.sub, action: 'TICKER_CREADO', details: msg.message, ipAddress: getClientIp(req) });
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

router.patch('/ticker/:id', async (req, res, next) => {
  try {
    const body = z
      .object({
        message: z.string().min(1).optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
      .parse({
        ...req.body,
        message: typeof req.body.message === 'string' ? req.body.message.trim() : req.body.message,
      });

    const msg = await prisma.tickerMessage.update({
      where: { id: paramId(req) },
      data: body,
    });

    getIO().to('tv').emit('tv:ticker-updated');
    await logAudit({ userId: req.user!.sub, action: 'TICKER_EDITADO', details: msg.message, ipAddress: getClientIp(req) });
    res.json(msg);
  } catch (err) {
    next(err);
  }
});

router.delete('/ticker/:id', async (req, res, next) => {
  try {
    await prisma.tickerMessage.update({ where: { id: paramId(req) }, data: { isActive: false } });
    getIO().to('tv').emit('tv:ticker-updated');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
