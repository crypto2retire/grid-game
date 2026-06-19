import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { exec } from 'child_process';
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

const io = new SocketIOServer(server, {
  cors: {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

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

// Root route - quick response for Railway health check
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'GRID API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

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

app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

app.use(errorHandler);

initializeSocketHandlers(io);

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down...`);
  server.close(() => {
    console.log('HTTP server closed');
  });
  await disconnectDatabase();
  try { await disconnectRedis(); } catch { /* Redis optional */ }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server FIRST - respond to HTTP immediately, then handle migrations in background
const startServer = async () => {
  const port = env.PORT;

  // Start server immediately so Railway health check passes
  server.listen(port, '0.0.0.0', () => {
    console.log(`GRID API server running on port ${port}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Database URL: ${env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`JWT Secret: ${env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
  });

  // Background: connect to database and run migrations
  if (env.DATABASE_URL) {
    try {
      await connectDatabase();
      console.log('Database connected');

      // Run migrations in background (non-blocking)
      exec('npx prisma migrate deploy', { cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) {
          console.log('Migration may already be current or failed:', stderr || err.message);
        } else {
          console.log('Migrations complete:', stdout?.trim() || 'OK');
        }

        // After migrations, check if seeding is needed
        prisma.player.count().then((count) => {
          if (count === 0) {
            console.log('Database empty, seeding players...');
            exec('node prisma/seed.js', { cwd: process.cwd() }, (seedErr, seedOut, seedStderr) => {
              if (seedErr) {
                console.error('Seed error:', seedStderr || seedErr.message);
              } else {
                console.log('Seeding complete:', seedOut?.trim() || 'OK');
              }
            });
          } else {
            console.log(`Database ready (${count} players)`);
          }
        }).catch((countErr) => {
          console.error('Failed to check player count:', countErr);
        });
      });
    } catch (dbErr) {
      console.error('Database connection failed:', dbErr);
    }
  } else {
    console.warn('No DATABASE_URL - database features unavailable');
  }

  // Background: connect to Redis (optional)
  try {
    await connectRedis();
    console.log('Redis connected');
  } catch (redisErr) {
    console.warn('Redis unavailable (optional):', redisErr);
  }
};

startServer();

export { io };
