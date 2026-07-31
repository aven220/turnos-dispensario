import { TicketStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getIO } from '../sockets/index.js';

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, fullName: true, role: true } },
} as const;

export async function getChatSettings() {
  return prisma.chatSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', chatEnabled: true, chatSoundEnabled: true },
    update: {},
  });
}

export async function updateChatSettings(data: { chatEnabled?: boolean; chatSoundEnabled?: boolean }) {
  const settings = await prisma.chatSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      chatEnabled: data.chatEnabled ?? true,
      chatSoundEnabled: data.chatSoundEnabled ?? true,
    },
    update: {
      ...(data.chatEnabled !== undefined && { chatEnabled: data.chatEnabled }),
      ...(data.chatSoundEnabled !== undefined && { chatSoundEnabled: data.chatSoundEnabled }),
    },
  });

  try {
    getIO().to('admin').emit('chat:settings-updated', settings);
    getIO().to('windows').emit('chat:settings-updated', settings);
  } catch {
    // socket no listo
  }

  return settings;
}

async function assertChatEnabled() {
  const settings = await getChatSettings();
  if (!settings.chatEnabled) {
    const err = new Error('El chat interno está desactivado') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return settings;
}

async function relatedTicketForWindow(windowId: string) {
  return prisma.ticket.findFirst({
    where: { windowId, status: TicketStatus.ATENDIENDO },
    select: { id: true, displayCode: true },
  });
}

export async function listChatMessages(windowId: string, limit = 100) {
  const messages = await prisma.chatMessage.findMany({
    where: { windowId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: Math.min(limit, 200),
  });
  const relatedTicket = await relatedTicketForWindow(windowId);
  return { messages, relatedTicket };
}

export async function sendChatMessage(params: {
  windowId: string;
  senderId: string;
  senderRole: UserRole;
  body: string;
}) {
  await assertChatEnabled();

  const text = params.body.trim();
  if (!text) {
    const err = new Error('El mensaje no puede estar vacío') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  if (text.length > 1000) {
    const err = new Error('El mensaje es demasiado largo (máx. 1000)') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const window = await prisma.window.findUnique({ where: { id: params.windowId } });
  if (!window) {
    const err = new Error('Ventanilla no encontrada') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const related = await relatedTicketForWindow(params.windowId);

  const created = await prisma.chatMessage.create({
    data: {
      windowId: params.windowId,
      senderId: params.senderId,
      body: text,
      ticketId: related?.id,
      ticketDisplayCode: related?.displayCode,
    },
    include: MESSAGE_INCLUDE,
  });

  try {
    const io = getIO();
    io.to(`window:${params.windowId}`).emit('chat:message', created);
    io.to('admin').emit('chat:message', { ...created, windowId: params.windowId });
  } catch {
    // ignore
  }

  return created;
}

export async function markChatRead(windowId: string, readerRole: UserRole) {
  // Marca como leídos los mensajes del otro lado
  const otherRoles =
    readerRole === UserRole.ADMIN
      ? [UserRole.WINDOW]
      : [UserRole.ADMIN];

  await prisma.chatMessage.updateMany({
    where: {
      windowId,
      readAt: null,
      sender: { role: { in: otherRoles } },
    },
    data: { readAt: new Date() },
  });

  try {
    const io = getIO();
    io.to(`window:${windowId}`).emit('chat:read', { windowId, readerRole });
    io.to('admin').emit('chat:read', { windowId, readerRole });
  } catch {
    // ignore
  }
}

export async function getUnreadCounts(forRole: UserRole) {
  const settings = await getChatSettings();
  if (!settings.chatEnabled) {
    return { total: 0, byWindow: [] as { windowId: string; count: number }[] };
  }

  const otherRole = forRole === UserRole.ADMIN ? UserRole.WINDOW : UserRole.ADMIN;

  const unread = await prisma.chatMessage.groupBy({
    by: ['windowId'],
    where: {
      readAt: null,
      sender: { role: otherRole },
    },
    _count: { _all: true },
  });

  const byWindow = unread.map((u) => ({ windowId: u.windowId, count: u._count._all }));
  const total = byWindow.reduce((s, w) => s + w.count, 0);
  return { total, byWindow };
}

export async function getUnreadForWindow(windowId: string) {
  const settings = await getChatSettings();
  if (!settings.chatEnabled) return 0;

  return prisma.chatMessage.count({
    where: {
      windowId,
      readAt: null,
      sender: { role: UserRole.ADMIN },
    },
  });
}
