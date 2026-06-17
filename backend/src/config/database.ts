import { prisma } from './prisma.js';

const MAX_ATTEMPTS = 15;
const RETRY_MS = 2000;

export async function connectDatabase(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('Base de datos conectada');
      return;
    } catch (err) {
      lastError = err;
      console.warn(`Esperando base de datos (${attempt}/${MAX_ATTEMPTS})...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo conectar a la base de datos');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
