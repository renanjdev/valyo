import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { WS_EVENTS } from '@mensageira/contracts';
import { logger } from '../lib/logger.js';

let io: Server;

export function getIO(): Server {
  return io;
}

export async function setupWebSocket(app: FastifyInstance) {
  io = new Server(app.server, {
    cors: { origin: '*' },
    path: '/ws',
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = app.jwt.verify<{ userId: string; accountId: string }>(token);
      socket.data.userId = payload.userId;
      socket.data.accountId = payload.accountId;
      socket.join(`account:${payload.accountId}`);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ userId: socket.data.userId }, 'WebSocket connected');

    socket.on(WS_EVENTS.CONVERSATION_JOIN, (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on(WS_EVENTS.CONVERSATION_LEAVE, (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(WS_EVENTS.NOTIFICATION_READ, (notificationId: string) => {
      // Mark notification as read (future implementation)
    });

    socket.on('disconnect', () => {
      logger.info({ userId: socket.data.userId }, 'WebSocket disconnected');
    });
  });

  return io;
}

// Helper to emit to account room
export function emitToAccount(accountId: string, event: string, data: any) {
  io?.to(`account:${accountId}`).emit(event, data);
}

// Helper to emit to conversation room
export function emitToConversation(conversationId: string, event: string, data: any) {
  io?.to(`conversation:${conversationId}`).emit(event, data);
}
