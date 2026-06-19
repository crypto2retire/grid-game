import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { execSync } from 'child_process';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, prisma } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { teamRouter } from './modules/teams/team.routes';
import { playerRouter } from './modules/players/player.routes';
import { matchRouter } from './modules/matches/match.routes';
import { matchesListRouter } from './modules/matches/matches-list.routes';
import { economyRouter } from './modules/economy/economy.routes';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes';
import { marketplaceRouter } from './modules/economy/marketplace.routes';
import { initializeSocketHandlers } from './websocket/socket.handlers';

const app = express();
const server = createServer(app);

// Configure Socket.io with CORS
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

// Root route - Railway may check this for health
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'GRID API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

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
app.use('/api/matches', matchesListRouter);
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
  try {
    await disconnectRedis();
  } catch {
    // Redis may not be connected
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  // Log environment status
  console.log('======================================');
  console.log('GRID API Starting...');
  console.log('======================================');
  console.log(`NODE_ENV: ${env.NODE_ENV}`);
  console.log(`PORT: ${env.PORT}`);
  console.log(`DATABASE_URL: ${env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`REDIS_URL: ${env.REDIS_URL ? 'SET' : 'NOT SET'}`);
  console.log(`JWT_SECRET: ${env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
  console.log('======================================');

  // Check critical env vars
  if (!env.DATABASE_URL) {
    console.error('CRITICAL: DATABASE_URL is not set. Please add it in Railway Variables tab.');
    console.error('Railway should auto-set this when you add a PostgreSQL database.');
  }
  if (!env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET is not set. Please add it in Railway Variables tab.');
    console.error('Generate one with: openssl rand -base64 32');
  }

  try {
    // Connect to database if available
    if (env.DATABASE_URL) {
      try {
        await connectDatabase();
        console.log('Database connected');

        // Auto-run migrations on startup
        try {
          console.log('Running database migrations...');
          execSync('npx prisma migrate deploy', {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
          console.log('Migrations complete');
        } catch (migrateErr) {
          console.warn('Migration warning (may already be current):', migrateErr);
        }

        // Auto-seed if database is empty
        try {
          const playerCount = await prisma.player.count();
          if (playerCount === 0) {
            console.log('Database empty, seeding players...');
            execSync('node prisma/seed.js', {
              cwd: process.cwd(),
              stdio: 'inherit',
            });
            console.log('Seeding complete');
          } else {
            console.log(`Database already seeded (${playerCount} players found)`);
          }
        } catch (seedErr) {
          console.error('Seed error:', seedErr);
        }
      } catch (dbErr) {
        console.error('Database connection failed:', dbErr);
      }
    } else {
      console.warn('No DATABASE_URL set - database features will not work');
    }

    // Connect to Redis if available (optional)
    try {
      await connectRedis();
      console.log('Redis connected');
    } catch (redisErr) {
      console.warn('Redis connection failed (optional):', redisErr);
    }

    const port = env.PORT;
    server.listen(port, '0.0.0.0', () => {
      console.log('======================================');
      console.log(`GRID API server running on port ${port}`);
      console.log(`Environment: ${env.NODE_ENV}`);
      console.log('======================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };
