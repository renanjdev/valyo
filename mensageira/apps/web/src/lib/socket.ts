import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket?.connected) return socket;

  socket = io('/', {
    path: '/ws',
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => console.log('WS connected'));
  socket.on('disconnect', () => console.log('WS disconnected'));

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
