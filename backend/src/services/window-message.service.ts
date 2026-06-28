import { WindowMessageStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getIO } from '../sockets/index.js';

export const windowMessageService = {
  async getPendingForWindow(windowId: string) {
    return prisma.windowMessage.findFirst({
      where: { windowId, status: WindowMessageStatus.PENDING },
      orderBy: { sentAt: 'desc' },
      include: {
        sentBy: { select: { fullName: true } },
      },
    });
  },

  async assertNoPendingMessage(windowId: string) {
    const pending = await this.getPendingForWindow(windowId);
    if (pending) {
      const err = new Error('Debe aceptar el mensaje del administrador antes de continuar') as Error & {
        statusCode?: number;
      };
      err.statusCode = 403;
      throw err;
    }
  },

  async sendMessage(windowId: string, message: string, sentById: string) {
    const window = await prisma.window.findUnique({ where: { id: windowId } });
    if (!window) {
      const err = new Error('Ventanilla no encontrada') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    await prisma.windowMessage.updateMany({
      where: { windowId, status: WindowMessageStatus.PENDING },
      data: {
        status: WindowMessageStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedById: sentById,
      },
    });

    const created = await prisma.windowMessage.create({
      data: {
        windowId,
        message: message.trim(),
        sentById,
      },
      include: {
        sentBy: { select: { fullName: true } },
        window: { select: { id: true, name: true, number: true } },
      },
    });

    getIO().to(`window:${windowId}`).emit('window:message', created);
    getIO().to('admin').emit('window:message-sent', created);

    return created;
  },

  async acknowledge(messageId: string, userId: string, windowId: string) {
    const msg = await prisma.windowMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.windowId !== windowId) {
      const err = new Error('Mensaje no encontrado') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    if (msg.status !== WindowMessageStatus.PENDING) {
      const err = new Error('El mensaje ya fue atendido') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const updated = await prisma.windowMessage.update({
      where: { id: messageId },
      data: {
        status: WindowMessageStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
      include: {
        sentBy: { select: { fullName: true } },
        acknowledgedBy: { select: { fullName: true } },
        window: { select: { id: true, name: true, number: true } },
      },
    });

    getIO().to('admin').emit('window:message-acknowledged', updated);

    return updated;
  },

  async listRecent(limit = 50) {
    return prisma.windowMessage.findMany({
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        sentBy: { select: { fullName: true } },
        acknowledgedBy: { select: { fullName: true } },
        window: { select: { id: true, name: true, number: true } },
      },
    });
  },
};
