import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import prioritiesRoutes from './routes/priorities.routes.js';
import statsRoutes from './routes/stats.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import tvRoutes from './routes/tv.routes.js';
import usersRoutes from './routes/users.routes.js';
import windowsRoutes from './routes/windows.routes.js';
import { ensureDailyOperations } from './services/daily-reset.service.js';
import { setupSocketIO } from './sockets/index.js';

const app = express();
const server = http.createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'connected',
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/windows', windowsRoutes);
app.use('/api/priorities', prioritiesRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/stats', statsRoutes);

if (env.isProduction) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler);

setupSocketIO(server);

const DAILY_CHECK_MS = 60 * 60 * 1000;

async function bootstrap() {
  await connectDatabase();
  await ensureDailyOperations().catch((err) => console.error('Reinicio diario inicial:', err));

  setInterval(() => {
    ensureDailyOperations().catch((err) => console.error('Reinicio diario programado:', err));
  }, DAILY_CHECK_MS);

  server.listen(env.PORT, env.HOST, () => {
    const hostLabel = env.HOST === '0.0.0.0' ? 'todas las interfaces' : env.HOST;
    console.log(`Servidor listo en puerto ${env.PORT} (${hostLabel})`);
    if (env.isProduction) {
      const pub = env.PUBLIC_SERVER_IP;
      console.log(`Acceso local:   http://localhost:${env.PORT}`);
      if (pub) {
        console.log(`Red interna:    http://${pub}:${env.PORT}`);
        console.log(`Pantalla TV:    http://${pub}:${env.PORT}/tv`);
        console.log(`Salud:          http://${pub}:${env.PORT}/api/health`);
      } else {
        console.log(`Pantalla TV:    http://localhost:${env.PORT}/tv`);
      }
    }
  });
}

function shutdown(signal: string) {
  console.log(`\nRecibido ${signal}. Cerrando servidor...`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  console.error('No se pudo iniciar la aplicación:', err);
  process.exit(1);
});
