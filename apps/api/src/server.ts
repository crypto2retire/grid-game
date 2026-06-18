import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { teamRouter } from './modules/teams/team.routes';
import { playerRouter } from './modules/players/player.routes';
import { matchRouter } from './modules/matches/match.routes';
import { economyRouter } from './modules/economy/economy.routes';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes';
import { marketplaceRouter } from './modules/economy/marketplace.routes';
import { initializeSocketHandlers } from './websocket/socket.handlers';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

// Security middleware
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/teams', teamRouter);
app.use('/api/players', playerRouter);
app.use('/api/matches', matchRouter);
app.use('/api/economy', economyRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/leaderboard', leaderboardRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Socket.io
initializeSocketHandlers(io);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
  });
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    await connectRedis();

    const port = env.PORT;
    server.listen(port, () => {
      console.log(`GRID API server running on port ${port}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };
