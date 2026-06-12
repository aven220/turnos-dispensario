import { prisma } from '../config/prisma.js';

interface AuditParams {
  userId?: string;
  action: string;
  details?: string;
  windowId?: string;
  ticketId?: string;
  ipAddress?: string;
}

export async function logAudit(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      details: params.details,
      windowId: params.windowId,
      ticketId: params.ticketId,
      ipAddress: params.ipAddress,
    },
  });
}
