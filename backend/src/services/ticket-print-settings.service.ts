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
  return prisma.ticketPrintSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...defaults, ...data },
    update: data,
  });
}
