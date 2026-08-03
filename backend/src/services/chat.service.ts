import { TicketStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getIO } from '../sockets/index.js';
import { getOnlineUserIds, isUserOnline } from '../utils/chat-presence.js';

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, fullName: true, role: true } },
} as const;

function emitChatSettings(settings: { chatEnabled: boolean; chatSoundEnabled: boolean }) {
  try {
    const io = getIO();
    io.emit('chat:settings-updated', settings);
  } catch {
    // socket no listo
  }
}

function toChatPayload(msg: {
  id: string;
  participantId: string;
  windowId?: string | null;
  senderId: string;
  body: string;
  ticketId?: string | null;
  ticketDisplayCode?: string | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
  sender: { id: string; fullName: string; role: UserRole };
}) {
  return {
    id: msg.id,
    participantId: msg.participantId,
    windowId: msg.windowId ?? null,
    senderId: msg.senderId,
    body: msg.body,
    ticketId: msg.ticketId ?? null,
    ticketDisplayCode: msg.ticketDisplayCode ?? null,
    deliveredAt: msg.deliveredAt,
    readAt: msg.readAt,
    createdAt: msg.createdAt,
    sender: msg.sender,
  };
}

function emitChatMessage(
  msg: {
    id: string;
    participantId: string;
    windowId?: string | null;
    senderId: string;
    body: string;
    ticketId?: string | null;
    ticketDisplayCode?: string | null;
    deliveredAt?: Date | null;
    readAt?: Date | null;
    createdAt: Date;
    sender: { id: string; fullName: string; role: UserRole };
  },
  participantRole: UserRole
) {
  try {
    const io = getIO();
    const payload = toChatPayload(msg);
    // Destinatario directo + sala de rol (por si el socket no está en user:id)
    io.to(`user:${msg.participantId}`).emit('chat:message', payload);
    if (participantRole !== UserRole.ADMIN) {
      io.to(`role:${participantRole}`).emit('chat:message', payload);
    }
    io.to('chat:admins').emit('chat:message', payload);
    // También al remitente no-admin por si envía y tiene otra pestaña
    if (msg.senderId !== msg.participantId) {
      io.to(`user:${msg.senderId}`).emit('chat:message', payload);
    }
  } catch {
    // ignore
  }
}

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
  emitChatSettings(settings);
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

async function relatedTicketForUser(userId: string) {
  const assignment = await prisma.windowOperator.findUnique({ where: { userId } });
  if (!assignment) return null;
  return prisma.ticket.findFirst({
    where: { windowId: assignment.windowId, status: TicketStatus.ATENDIENDO },
    select: { id: true, displayCode: true },
  });
}

async function windowIdForUser(userId: string) {
  const assignment = await prisma.windowOperator.findUnique({ where: { userId } });
  return assignment?.windowId ?? null;
}

export async function listChatParticipants() {
  const users = await prisma.user.findMany({
    where: { role: { not: UserRole.ADMIN }, status: 'ACTIVE' },
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      windowAssignments: { include: { window: { select: { id: true, name: true, number: true } } } },
    },
    orderBy: { fullName: 'asc' },
  });

  const unread = await prisma.chatMessage.groupBy({
    by: ['participantId'],
    where: { readAt: null, sender: { role: { not: UserRole.ADMIN } } },
    _count: { _all: true },
  });
  const unreadMap = new Map(unread.map((u) => [u.participantId, u._count._all]));

  const lastMessages = await prisma.chatMessage.findMany({
    where: { participantId: { in: users.map((u) => u.id) } },
    orderBy: { createdAt: 'desc' },
    distinct: ['participantId'],
    select: { participantId: true, body: true, createdAt: true },
  });
  const lastMap = new Map(lastMessages.map((m) => [m.participantId, m]));

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    role: u.role,
    window: u.windowAssignments[0]?.window ?? null,
    unread: unreadMap.get(u.id) ?? 0,
    lastMessage: lastMap.get(u.id) ?? null,
    online: isUserOnline(u.id),
  }));
}

export async function listChatMessages(participantId: string, limit = 100) {
  const messages = await prisma.chatMessage.findMany({
    where: { participantId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: Math.min(limit, 200),
  });
  const relatedTicket = await relatedTicketForUser(participantId);
  return { messages, relatedTicket, participantId };
}

export async function sendChatMessage(params: {
  participantId: string;
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

  const participant = await prisma.user.findUnique({ where: { id: params.participantId } });
  if (!participant || participant.role === UserRole.ADMIN) {
    const err = new Error('Conversación no válida') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Solo Admin ↔ Usuario: el remitente debe ser admin o el propio participante
  if (params.senderRole !== UserRole.ADMIN && params.senderId !== params.participantId) {
    const err = new Error('Solo puede chatear con el administrador') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  if (params.senderRole === UserRole.ADMIN && params.senderId === params.participantId) {
    const err = new Error('Conversación no válida') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const windowId = await windowIdForUser(params.participantId);
  const related = await relatedTicketForUser(params.participantId);

  const created = await prisma.chatMessage.create({
    data: {
      participantId: params.participantId,
      windowId,
      senderId: params.senderId,
      body: text,
      ticketId: related?.id,
      ticketDisplayCode: related?.displayCode,
    },
    include: MESSAGE_INCLUDE,
  });

  emitChatMessage(created, participant.role);
  return created;
}

export async function markChatRead(participantId: string, readerId: string, readerRole: UserRole) {
  if (readerRole === UserRole.ADMIN) {
    await prisma.chatMessage.updateMany({
      where: {
        participantId,
        readAt: null,
        senderId: { not: readerId },
        sender: { role: { not: UserRole.ADMIN } },
      },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.chatMessage.updateMany({
      where: {
        participantId,
        readAt: null,
        sender: { role: UserRole.ADMIN },
      },
      data: { readAt: new Date() },
    });
  }

  try {
    const io = getIO();
    const payload = { participantId, readerRole };
    io.to(`user:${participantId}`).emit('chat:read', payload);
    io.to('chat:admins').emit('chat:read', payload);
  } catch {
    // ignore
  }
}

export async function markMessageDelivered(messageId: string, receiverId: string, receiverRole: UserRole) {
  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.deliveredAt) return msg;

  const fromAdmin = msg.senderId !== msg.participantId;
  const allowed =
    (fromAdmin && receiverId === msg.participantId) ||
    (!fromAdmin && receiverRole === UserRole.ADMIN);

  if (!allowed) return msg;

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deliveredAt: new Date() },
    include: MESSAGE_INCLUDE,
  });

  try {
    const io = getIO();
    const payload = {
      id: updated.id,
      participantId: updated.participantId,
      deliveredAt: updated.deliveredAt,
    };
    io.to(`user:${msg.senderId}`).emit('chat:delivered', payload);
    io.to('chat:admins').emit('chat:delivered', payload);
  } catch {
    // ignore
  }
  return updated;
}

export async function getUnreadForUser(userId: string, role: UserRole) {
  const settings = await getChatSettings();
  if (!settings.chatEnabled) {
    return { total: 0, byParticipant: [] as { participantId: string; count: number }[] };
  }

  if (role === UserRole.ADMIN) {
    const unread = await prisma.chatMessage.groupBy({
      by: ['participantId'],
      where: { readAt: null, sender: { role: { not: UserRole.ADMIN } } },
      _count: { _all: true },
    });
    const byParticipant = unread.map((u) => ({ participantId: u.participantId, count: u._count._all }));
    return { total: byParticipant.reduce((s, x) => s + x.count, 0), byParticipant };
  }

  const count = await prisma.chatMessage.count({
    where: {
      participantId: userId,
      readAt: null,
      sender: { role: UserRole.ADMIN },
    },
  });
  return { total: count, byParticipant: count > 0 ? [{ participantId: userId, count }] : [] };
}

export function listOnlineUserIds() {
  return getOnlineUserIds();
}
