import fs from 'fs';
import path from 'path';
import { TicketStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  absoluteChatImagePath,
  chatImageExt,
  chatImageRelativePath,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_UPLOADS_DIR,
  ensureParticipantChatDir,
  sniffChatImageMime,
} from '../middleware/chat-upload.js';
import { getIO } from '../sockets/index.js';
import { getOnlineUserIds, isUserOnline } from '../utils/chat-presence.js';

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, fullName: true, role: true } },
} as const;

type ChatMsgRow = {
  id: string;
  participantId: string;
  windowId?: string | null;
  senderId: string;
  body: string;
  ticketId?: string | null;
  ticketDisplayCode?: string | null;
  imagePath?: string | null;
  imageMime?: string | null;
  imageBytes?: number | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
  sender: { id: string; fullName: string; role: UserRole };
};

function emitChatSettings(settings: { chatEnabled: boolean; chatSoundEnabled: boolean }) {
  try {
    const io = getIO();
    io.emit('chat:settings-updated', settings);
  } catch {
    // socket no listo
  }
}

function toChatPayload(msg: ChatMsgRow) {
  return {
    id: msg.id,
    participantId: msg.participantId,
    windowId: msg.windowId ?? null,
    senderId: msg.senderId,
    body: msg.body,
    ticketId: msg.ticketId ?? null,
    ticketDisplayCode: msg.ticketDisplayCode ?? null,
    hasImage: Boolean(msg.imagePath),
    imageMime: msg.imagePath ? msg.imageMime ?? null : null,
    imageBytes: msg.imagePath ? msg.imageBytes ?? null : null,
    deliveredAt: msg.deliveredAt,
    readAt: msg.readAt,
    createdAt: msg.createdAt,
    sender: msg.sender,
  };
}

function emitChatMessage(msg: ChatMsgRow, participantRole: UserRole) {
  try {
    const io = getIO();
    const payload = toChatPayload(msg);
    io.to(`user:${msg.participantId}`).emit('chat:message', payload);
    if (participantRole !== UserRole.ADMIN) {
      io.to(`role:${participantRole}`).emit('chat:message', payload);
    }
    io.to('chat:admins').emit('chat:message', payload);
    if (msg.senderId !== msg.participantId) {
      io.to(`user:${msg.senderId}`).emit('chat:message', payload);
    }
  } catch {
    // ignore
  }
}

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
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
    throw httpError('El chat interno está desactivado', 403);
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

async function assertCanAccessThread(
  participantId: string,
  senderId: string,
  senderRole: UserRole
) {
  const participant = await prisma.user.findUnique({ where: { id: participantId } });
  if (!participant || participant.role === UserRole.ADMIN) {
    throw httpError('Conversación no válida', 404);
  }
  if (senderRole !== UserRole.ADMIN && senderId !== participantId) {
    throw httpError('Solo puede chatear con el administrador', 403);
  }
  if (senderRole === UserRole.ADMIN && senderId === participantId) {
    throw httpError('Conversación no válida', 400);
  }
  return participant;
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
    select: { participantId: true, body: true, imagePath: true, createdAt: true },
  });
  const lastMap = new Map(lastMessages.map((m) => [m.participantId, m]));

  return users.map((u) => {
    const last = lastMap.get(u.id);
    return {
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      window: u.windowAssignments[0]?.window ?? null,
      unread: unreadMap.get(u.id) ?? 0,
      lastMessage: last
        ? {
            body: last.imagePath ? 'Imagen' : last.body,
            createdAt: last.createdAt,
            hasImage: Boolean(last.imagePath),
          }
        : null,
      online: isUserOnline(u.id),
    };
  });
}

export async function listChatMessages(participantId: string, limit = 100) {
  const messages = await prisma.chatMessage.findMany({
    where: { participantId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: Math.min(limit, 200),
  });
  const relatedTicket = await relatedTicketForUser(participantId);
  return {
    messages: messages.map((m) => toChatPayload(m)),
    relatedTicket,
    participantId,
  };
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
    throw httpError('El mensaje no puede estar vacío', 400);
  }
  if (text.length > 1000) {
    throw httpError('El mensaje es demasiado largo (máx. 1000)', 400);
  }

  const participant = await assertCanAccessThread(
    params.participantId,
    params.senderId,
    params.senderRole
  );

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
  return toChatPayload(created);
}

export async function sendChatImageMessage(params: {
  participantId: string;
  senderId: string;
  senderRole: UserRole;
  caption?: string;
  file: Express.Multer.File;
}) {
  await assertChatEnabled();

  const mime = sniffChatImageMime(params.file.buffer, params.file.mimetype);
  if (!mime) {
    throw httpError('Formato no permitido. Use JPG, PNG o WEBP.', 400);
  }
  if (params.file.size > CHAT_IMAGE_MAX_BYTES) {
    throw httpError('La imagen supera el tamaño permitido.', 400);
  }

  const caption = (params.caption ?? '').trim();
  if (caption.length > 1000) {
    throw httpError('El mensaje es demasiado largo (máx. 1000)', 400);
  }

  const participant = await assertCanAccessThread(
    params.participantId,
    params.senderId,
    params.senderRole
  );

  const windowId = await windowIdForUser(params.participantId);
  const related = await relatedTicketForUser(params.participantId);

  const created = await prisma.chatMessage.create({
    data: {
      participantId: params.participantId,
      windowId,
      senderId: params.senderId,
      body: caption || '[imagen]',
      ticketId: related?.id,
      ticketDisplayCode: related?.displayCode,
    },
    include: MESSAGE_INCLUDE,
  });

  const dir = ensureParticipantChatDir(params.participantId);
  const filename = `${created.id}${chatImageExt(mime)}`;
  const absolute = path.join(dir, filename);
  const relative = chatImageRelativePath(params.participantId, filename);

  try {
    fs.writeFileSync(absolute, params.file.buffer);
  } catch {
    await prisma.chatMessage.delete({ where: { id: created.id } });
    throw httpError('No se pudo guardar la imagen', 500);
  }

  const updated = await prisma.chatMessage.update({
    where: { id: created.id },
    data: {
      imagePath: relative,
      imageMime: mime,
      imageBytes: params.file.size,
    },
    include: MESSAGE_INCLUDE,
  });

  emitChatMessage(updated, participant.role);
  return toChatPayload(updated);
}

export async function assertCanViewChatImage(
  messageId: string,
  userId: string,
  userRole: UserRole
) {
  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!msg?.imagePath) {
    throw httpError('Imagen no encontrada', 404);
  }
  const allowed =
    userRole === UserRole.ADMIN || userId === msg.participantId;
  if (!allowed) {
    throw httpError('Acceso denegado', 403);
  }
  const absolute = absoluteChatImagePath(msg.imagePath);
  if (!fs.existsSync(absolute)) {
    throw httpError('Imagen no encontrada', 404);
  }
  return { msg, absolute, mime: msg.imageMime ?? 'application/octet-stream' };
}

export async function deleteChatThread(participantId: string) {
  const participant = await prisma.user.findUnique({ where: { id: participantId } });
  if (!participant || participant.role === UserRole.ADMIN) {
    throw httpError('Conversación no válida', 404);
  }

  const withImages = await prisma.chatMessage.findMany({
    where: { participantId, imagePath: { not: null } },
    select: { imagePath: true },
  });

  for (const row of withImages) {
    if (!row.imagePath) continue;
    try {
      const absolute = absoluteChatImagePath(row.imagePath);
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    } catch {
      // continuar limpiando
    }
  }

  const participantDir = path.join(CHAT_UPLOADS_DIR, participantId);
  try {
    if (fs.existsSync(participantDir)) {
      for (const name of fs.readdirSync(participantDir)) {
        fs.unlinkSync(path.join(participantDir, name));
      }
      fs.rmdirSync(participantDir);
    }
  } catch {
    // ignore
  }

  const result = await prisma.chatMessage.deleteMany({ where: { participantId } });

  try {
    const io = getIO();
    const payload = { participantId };
    io.to(`user:${participantId}`).emit('chat:thread-deleted', payload);
    io.to('chat:admins').emit('chat:thread-deleted', payload);
  } catch {
    // ignore
  }

  return { deleted: result.count };
}

function dirSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

export async function getChatStorageUsage() {
  const bytesOnDisk = dirSizeBytes(CHAT_UPLOADS_DIR);
  const agg = await prisma.chatMessage.aggregate({
    where: { imageBytes: { not: null } },
    _sum: { imageBytes: true },
    _count: { _all: true },
  });
  const imageCount = await prisma.chatMessage.count({ where: { imagePath: { not: null } } });
  return {
    bytes: bytesOnDisk,
    bytesLabel: formatBytes(bytesOnDisk),
    imageCount,
    messageCountWithSize: agg._count._all,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
