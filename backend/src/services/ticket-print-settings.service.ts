import { prisma } from '../config/prisma.js';

const SETTINGS_ID = 'default';

const defaults = {
  headerTitle: 'CENCOIC',
  showHeader: true,
  showPriority: true,
  showDisplayCode: true,
  showUniqueCode: false,
  showDateTime: true,
  showFooter: true,
  footerMessage: 'Espere a ser llamado en pantalla',
  messageFontScale: 1,
  maxFormulas: 1,
};

export async function getTicketPrintSettings() {
  return prisma.ticketPrintSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...defaults },
    update: {},
  });
}

export type TicketPrintSettingsUpdate = Partial<typeof defaults>;

export async function updateTicketPrintSettings(data: TicketPrintSettingsUpdate) {
  const patch = { ...data };
  if (patch.maxFormulas !== undefined) {
    const n = Math.floor(Number(patch.maxFormulas));
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      const err = new Error('El máximo de fórmulas debe estar entre 1 y 50') as Error & {
        statusCode?: number;
      };
      err.statusCode = 400;
      throw err;
    }
    patch.maxFormulas = n;
  }
  return prisma.ticketPrintSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...defaults, ...patch },
    update: patch,
  });
}
