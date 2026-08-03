import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let boundToken: string | undefined;

export function getSocket(token?: string): Socket {
  // Si el token cambió (o pasamos de anónimo → autenticado), reconectar con auth
  if (socket && token && token !== boundToken) {
    boundToken = token;
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
    return socket;
  }

  if (!socket) {
    boundToken = token;
    socket = io('/', {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    return socket;
  }

  if (token && !socket.connected) {
    socket.auth = { token };
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  boundToken = undefined;
}
