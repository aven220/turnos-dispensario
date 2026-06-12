import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { exportService } from '../services/export.service.js';
import { ticketService } from '../services/ticket.service.js';
import { parseDatePrefix } from '../utils/date.js';

const router = Router();
router.use(authMiddleware, requireRoles(UserRole.ADMIN));

function parseDates(req: { query: Record<string, unknown> }) {
  const dateFrom = req.query.from ? new Date(req.query.from as string) : undefined;
  const dateTo = req.query.to ? new Date(req.query.to as string) : undefined;
  return { dateFrom, dateTo };
}

function filenameDate(req: { query: Record<string, unknown> }) {
  return parseDatePrefix(req.query.date as string | undefined);
}

router.get('/', async (req, res) => {
  const { dateFrom, dateTo } = parseDates(req);
  const stats = await ticketService.getStats(dateFrom, dateTo);
  res.json(stats);
});

router.get('/audit', async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? '100', 10);
  const logs = await prisma.auditLog.findMany({
    include: {
      user: { select: { fullName: true } },
      window: { select: { name: true, number: true } },
      ticket: { select: { displayCode: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(logs);
});

router.get('/export/excel', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = parseDates(req);
    const buffer = await exportService.generateExcel(dateFrom, dateTo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-turnos.xlsx');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/export/pdf', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = parseDates(req);
    const buffer = await exportService.generatePdf(dateFrom, dateTo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-turnos.pdf');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/daily', async (req, res) => {
  const report = await ticketService.getDailyReport(req.query.date as string | undefined);
  res.json(report);
});

router.get('/export/daily-excel', async (req, res, next) => {
  try {
    const date = filenameDate(req);
    const buffer = await exportService.generateDailyExcel(req.query.date as string | undefined);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=informe-ventanillas-${date}.xlsx`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/export/daily-pdf', async (req, res, next) => {
  try {
    const date = filenameDate(req);
    const buffer = await exportService.generateDailyPdf(req.query.date as string | undefined);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=informe-ventanillas-${date}.pdf`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
