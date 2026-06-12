import { prisma } from '../config/prisma.js';

const SETTINGS_ID = 'default';

export async function getTvSettings() {
  const settings = await prisma.tvSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, upcomingCount: 3, welcomeMessage: 'BIENVENIDOS A CENCOIC' },
    update: {},
  });
  return settings;
}

export async function updateTvSettings(data: { upcomingCount?: number; welcomeMessage?: string }) {
  return prisma.tvSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      upcomingCount: data.upcomingCount ?? 3,
      welcomeMessage: data.welcomeMessage ?? 'BIENVENIDOS A CENCOIC',
    },
    update: data,
  });
}
