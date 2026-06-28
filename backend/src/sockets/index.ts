import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import type { AuthPayload } from '../middleware/auth.js';

let io: Server;

export function setupSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      socket.data.isPublic = true;
      socket.join('tv');
      next();
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      socket.data.user = payload;
      socket.join(`user:${payload.sub}`);
      socket.join(`role:${payload.role}`);
      if (payload.role === 'ADMIN') socket.join('admin');
      if (payload.role === 'AREA_MANAGER') socket.join('admin');
      if (payload.role === 'AUDITOR') socket.join('admin');
      if (payload.role === 'WINDOW') socket.join('windows');
      if (payload.role === 'FILTER') socket.join('filter');
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:tv', () => socket.join('tv'));
    socket.on('join:window', (windowId: string) => socket.join(`window:${windowId}`));
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO no inicializado');
  return io;
}
