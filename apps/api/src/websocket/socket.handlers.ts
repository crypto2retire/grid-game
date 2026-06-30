import jwt from 'jsonwebtoken';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { createChatMessage, getRecentChatMessages } from '../modules/chat/chat.service';
import { getOnlinePlayers, markAvatarOffline, upsertAvatarPresence } from '../modules/world/world.service';

type SocketUser = {
  id: string;
  email: string;
  username: string;
  role: string;
};

const WORLD_ROOM = 'world:grid-city';
const userSockets = new Map<string, Set<string>>();

async function authenticateSocket(socket: Socket): Promise<SocketUser | null> {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true, role: true },
    });
    return user;
  } catch {
    return null;
  }
}

function rememberSocket(userId: string, socketId: string): void {
  const sockets = userSockets.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  userSockets.set(userId, sockets);
}

function forgetSocket(userId: string, socketId: string): boolean {
  const sockets = userSockets.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
    return true;
  }
  return false;
}

export const initializeSocketHandlers = (io: SocketIOServer): void => {
  io.on('connection', async (socket) => {
    logger.info('Client connected:', socket.id);
    const socketUser = await authenticateSocket(socket);

    if (socketUser) {
      rememberSocket(socketUser.id, socket.id);
      socket.join(WORLD_ROOM);
      const player = await upsertAvatarPresence({ userId: socketUser.id, username: socketUser.username });
      socket.emit('world:avatar:self', player);
      socket.emit('world:players', await getOnlinePlayers(socketUser.id));
      socket.to(WORLD_ROOM).emit('world:avatar:joined', player);
    }

    socket.on('chat:history', async (input: { channel?: string; limit?: number } = {}) => {
      if (!socketUser) {
        socket.emit('chat:error', { message: 'Authentication required' });
        return;
      }
      const messages = await getRecentChatMessages(input.channel, input.limit ?? 50);
      socket.emit('chat:history', messages);
    });

    socket.on('chat:send', async (input: { channel?: string; message?: string }, ack?: (response: object) => void) => {
      if (!socketUser) {
        const response = { status: 'error', message: 'Authentication required' };
        ack?.(response);
        socket.emit('chat:error', response);
        return;
      }
      try {
        const message = await createChatMessage({
          userId: socketUser.id,
          username: socketUser.username,
          channel: input.channel,
          message: input.message ?? '',
        });
        io.to(WORLD_ROOM).emit('chat:message', message);
        ack?.({ status: 'success', data: message });
      } catch (error) {
        const response = { status: 'error', message: error instanceof Error ? error.message : 'Unable to send message' };
        ack?.(response);
        socket.emit('chat:error', response);
      }
    });

    socket.on('world:avatar:move', async (input: { x: number; y: number; targetX?: number; targetY?: number; facing?: 'left' | 'right' | 'up' | 'down' }) => {
      if (!socketUser) {
        socket.emit('world:error', { message: 'Authentication required' });
        return;
      }
      const x = Math.max(-900, Math.min(900, Number(input.x)));
      const y = Math.max(-650, Math.min(650, Number(input.y)));
      const targetX = input.targetX === undefined ? x : Math.max(-900, Math.min(900, Number(input.targetX)));
      const targetY = input.targetY === undefined ? y : Math.max(-650, Math.min(650, Number(input.targetY)));
      const player = await upsertAvatarPresence({
        userId: socketUser.id,
        username: socketUser.username,
        x,
        y,
        targetX,
        targetY,
        facing: input.facing,
      });
      socket.to(WORLD_ROOM).emit('world:avatar:move', player);
    });

    socket.on('match:subscribe', async ({ matchId }: { matchId: string }) => {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        socket.emit('error', { message: 'Match not found' });
        return;
      }

      socket.join(`match:${matchId}`);
      socket.emit('match:subscribed', { matchId });

      // Send current match state
      if (match.status === 'COMPLETED') {
        const events = await prisma.matchEvent.findMany({
          where: { matchId },
          orderBy: { tick: 'asc' },
        });
        socket.emit('match:events', { matchId, events });
      }
    });

    socket.on('match:unsubscribe', ({ matchId }: { matchId: string }) => {
      socket.leave(`match:${matchId}`);
      socket.emit('match:unsubscribed', { matchId });
    });

    socket.on('disconnect', async () => {
      if (socketUser) {
        const isLastSocket = forgetSocket(socketUser.id, socket.id);
        if (isLastSocket) {
          await markAvatarOffline(socketUser.id);
          socket.to(WORLD_ROOM).emit('world:avatar:left', { userId: socketUser.id });
        }
      }
      logger.info('Client disconnected:', socket.id);
    });
  });
};

export const broadcastMatchEvent = (io: SocketIOServer, matchId: string, event: object): void => {
  io.to(`match:${matchId}`).emit('match:event', event);
};

export const broadcastMatchResult = (io: SocketIOServer, matchId: string, result: object): void => {
  io.to(`match:${matchId}`).emit('match:result', result);
};
