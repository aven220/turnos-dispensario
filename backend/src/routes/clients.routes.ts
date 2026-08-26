import { UserRole } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authMiddleware, getClientIp, requireRoles } from '../middleware/auth.js';
import {
  confirmClientImport,
  createClient,
  listClients,
  parseClientImportBuffer,
  previewClientImport,
  searchClientByDocument,
} from '../services/client.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const router = Router();
router.use(authMiddleware);

router.get('/search', requireRoles(UserRole.FILTER, UserRole.ADMIN), async (req, res, next) => {
  try {
    const document = String(req.query.document ?? '').trim();
    if (!document) {
      res.status(400).json({ error: 'Indique el documento' });
      return;
    }
    const client = await searchClientByDocument(document);
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireRoles(UserRole.ADMIN, UserRole.FILTER), async (req, res, next) => {
  try {
    const q = req.query.q as string | undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
    res.json(await listClients({ q, page, pageSize }));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles(UserRole.FILTER, UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = z
      .object({
        documentNumber: z.string().min(3).max(40),
        fullName: z.string().min(2).max(120),
      })
      .parse({
        documentNumber: typeof req.body.documentNumber === 'string' ? req.body.documentNumber.trim() : req.body.documentNumber,
        fullName: typeof req.body.fullName === 'string' ? req.body.fullName.trim() : req.body.fullName,
      });
    const client = await createClient({
      ...body,
      userId: req.user!.sub,
      ipAddress: getClientIp(req),
    });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/import/preview',
  requireRoles(UserRole.ADMIN),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Seleccione un archivo CSV o Excel' });
        return;
      }
      const { rows, parseErrors } = await parseClientImportBuffer(req.file.buffer, req.file.originalname);
      const preview = await previewClientImport(rows, parseErrors);
      res.json({
        totalFound: preview.totalFound,
        nuevos: preview.nuevos,
        yaExistentes: preview.yaExistentes,
        conErrores: preview.conErrores,
        errors: preview.errors,
        rows: preview.rows,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/import/confirm', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const body = z
      .object({
        rows: z
          .array(
            z.object({
              row: z.number().int().optional(),
              documentNumber: z.string().min(3),
              fullName: z.string().min(2),
            })
          )
          .min(1)
          .max(50000),
      })
      .parse(req.body);

    const rows = body.rows.map((r, i) => ({
      row: r.row ?? i + 1,
      documentNumber: r.documentNumber,
      fullName: r.fullName,
    }));

    const result = await confirmClientImport(rows, req.user!.sub, getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
