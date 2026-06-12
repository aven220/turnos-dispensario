import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import prioritiesRoutes from './routes/priorities.routes.js';
import statsRoutes from './routes/stats.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import tvRoutes from './routes/tv.routes.js';
import usersRoutes from './routes/users.routes.js';
import windowsRoutes from './routes/windows.routes.js';
import { setupSocketIO } from './sockets/index.js';

const app = express();
const server = http.createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/windows', windowsRoutes);
app.use('/api/priorities', prioritiesRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/stats', statsRoutes);

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler);

setupSocketIO(server);

server.listen(env.PORT, env.HOST, () => {
  console.log(`Servidor en http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`);
});
