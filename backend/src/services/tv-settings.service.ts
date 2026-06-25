import { prisma } from '../config/prisma.js';

const SETTINGS_ID = 'default';

export async function getTvSettings() {
  const settings = await prisma.tvSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      upcomingCount: 3,
      windowQueueCount: 3,
      welcomeMessage: 'BIENVENIDOS A CENCOIC',
      welcomeFontScale: 1,
      tickerFontScale: 1,
      speechRate: 0.9,
      speechVoice: '',
      speechLang: 'es-ES',
    },
    update: {},
  });
  return settings;
}

export async function updateTvSettings(data: {
  upcomingCount?: number;
  windowQueueCount?: number;
  welcomeMessage?: string;
  welcomeFontScale?: number;
  tickerFontScale?: number;
  speechRate?: number;
  speechVoice?: string;
  speechLang?: string;
}) {
  return prisma.tvSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      upcomingCount: data.upcomingCount ?? 3,
      windowQueueCount: data.windowQueueCount ?? 3,
      welcomeMessage: data.welcomeMessage ?? 'BIENVENIDOS A CENCOIC',
      welcomeFontScale: data.welcomeFontScale ?? 1,
      tickerFontScale: data.tickerFontScale ?? 1,
      speechRate: data.speechRate ?? 0.9,
      speechVoice: data.speechVoice ?? '',
      speechLang: data.speechLang ?? 'es-ES',
    },
    update: data,
  });
}
