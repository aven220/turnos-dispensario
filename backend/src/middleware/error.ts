import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('. ');
    res.status(400).json({ error: message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[] | undefined)?.[0] ?? 'campo';
      const labels: Record<string, string> = { username: 'nombre de usuario', code: 'código' };
      res.status(400).json({ error: `El ${labels[field] ?? field} ya está en uso` });
      return;
    }
  }

  const message = err instanceof Error ? err.message : 'Error interno';
  const status = message.includes('no encontrad') || message.includes('No hay') ? 404 : 400;
  res.status(status).json({ error: message });
}
