import { TicketStatus, UserRole } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, getClientIp, requireRoles } from '../middleware/auth.js';
import { getTicketPrintSettings, updateTicketPrintSettings } from '../services/ticket-print-settings.service.js';
import { ticketService } from '../services/ticket.service.js';
import { getIO } from '../sockets/index.js';
import { paramId } from '../utils/params.js';

const router = Router();
router.use(authMiddleware);

function emitTicketUpdate(event: string, ticket: unknown) {
  const io = getIO();
  io.emit(event, ticket);
  io.to('tv').emit(event, ticket);
  io.to('admin').emit(event, ticket);
}

router.post('/generate', requireRoles(UserRole.FILTER, UserRole.ADMIN), async (req, res, next) => {
  try {
    const { priorityId } = z.object({ priorityId: z.string() }).parse(req.body);
    const ticket = await ticketService.createTicket(priorityId, req.user!.sub, getClientIp(req));
    emitTicketUpdate('ticket:created', ticket);
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

router.get('/today', requireRoles(UserRole.FILTER, UserRole.ADMIN), async (req, res) => {
  const status = req.query.status as TicketStatus | undefined;
  const priorityId = req.query.priorityId as string | undefined;
  const tickets = await ticketService.getTodayTickets({ status, priorityId });
  res.json(tickets);
});

router.get('/print-settings', requireRoles(UserRole.FILTER, UserRole.ADMIN), async (_req, res) => {
  const settings = await getTicketPrintSettings();
  res.json(settings);
});

router.patch('/print-settings', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = z
      .object({
        headerTitle: z.string().min(1).max(80).optional(),
        showHeader: z.boolean().optional(),
        showPriority: z.boolean().optional(),
        showDisplayCode: z.boolean().optional(),
        showUniqueCode: z.boolean().optional(),
        showDateTime: z.boolean().optional(),
        showFooter: z.boolean().optional(),
        footerMessage: z.string().min(1).max(200).optional(),
      })
      .parse({
        ...req.body,
        headerTitle: typeof req.body.headerTitle === 'string' ? req.body.headerTitle.trim() : req.body.headerTitle,
        footerMessage: typeof req.body.footerMessage === 'string' ? req.body.footerMessage.trim() : req.body.footerMessage,
      });

    const settings = await updateTicketPrintSettings(body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reprint', requireRoles(UserRole.FILTER, UserRole.ADMIN), async (req, res, next) => {
  try {
    const { prisma } = await import('../config/prisma.js');
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: paramId(req) },
      include: { priority: true },
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/take-next', requireRoles(UserRole.WINDOW), async (req, res, next) => {
  try {
    const { windowId } = z.object({ windowId: z.string() }).parse(req.body);
    const ticket = await ticketService.takeNextTicket(windowId, req.user!.sub, getClientIp(req));
    emitTicketUpdate('ticket:called', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/repeat', requireRoles(UserRole.WINDOW), async (req, res, next) => {
  try {
    const { windowId } = z.object({ windowId: z.string() }).parse(req.body);
    const ticket = await ticketService.repeatCall(paramId(req), windowId, req.user!.sub, getClientIp(req));
    emitTicketUpdate('ticket:repeated', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start', requireRoles(UserRole.WINDOW), async (req, res, next) => {
  try {
    const { windowId } = z.object({ windowId: z.string() }).parse(req.body);
    const ticket = await ticketService.startAttention(paramId(req), windowId, req.user!.sub, getClientIp(req));
    emitTicketUpdate('ticket:attending', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/finish', requireRoles(UserRole.WINDOW), async (req, res, next) => {
  try {
    const { windowId } = z.object({ windowId: z.string() }).parse(req.body);
    const ticket = await ticketService.finishAttention(paramId(req), windowId, req.user!.sub, getClientIp(req));
    emitTicketUpdate('ticket:finished', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/absent', requireRoles(UserRole.WINDOW), async (req, res, next) => {
  try {
    const { windowId } = z.object({ windowId: z.string() }).parse(req.body);
    const ticket = await ticketService.markAbsent(paramId(req), windowId, req.user!.sub, getClientIp(req));
    emitTicketUpdate('ticket:absent', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.get('/window/:windowId/state', requireRoles(UserRole.WINDOW, UserRole.ADMIN), async (req, res) => {
  const state = await ticketService.getWindowState(paramId(req, 'windowId'));
  res.json(state);
});

router.patch('/window/:windowId/availability', requireRoles(UserRole.WINDOW), async (req, res, next) => {
  try {
    const windowId = paramId(req, 'windowId');
    const { available } = z.object({ available: z.boolean() }).parse(req.body);
    const session = await ticketService.setSessionAvailability(
      windowId,
      req.user!.sub,
      available,
      getClientIp(req)
    );
    const io = getIO();
    const payload = { windowId, available: session.availableForService };
    io.to(`window:${windowId}`).emit('window:availability-changed', payload);
    io.to('admin').emit('window:availability-changed', payload);
    io.to('windows').emit('window:availability-changed', payload);
    res.json({ available: session.availableForService });
  } catch (err) {
    next(err);
  }
});

export default router;
