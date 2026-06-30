import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export const initializeSocketHandlers = (io: SocketIOServer): void => {
  io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);

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

    socket.on('disconnect', () => {
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
