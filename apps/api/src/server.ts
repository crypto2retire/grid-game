import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
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
import { sportsRouter } from './modules/sports/sports.routes';
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

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Root route - serve the frontend app
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
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
app.use('/api/sports', sportsRouter);
app.use('/api/leaderboard', leaderboardRouter);

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler for API routes
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

const startServer = async () => {
  const port = env.PORT;

  server.listen(port, '0.0.0.0', () => {
    console.log(`GRID server running on port ${port}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Database: ${env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`JWT: ${env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
  });

  if (env.DATABASE_URL) {
    try {
      await connectDatabase();
      console.log('Database connected');

      exec('npx prisma migrate deploy', { cwd: process.cwd() }, (err, stdout) => {
        if (err) {
          console.log('Migration status:', err.message);
        } else {
          console.log('Migrations:', stdout?.trim() || 'OK');
        }

        prisma.player.count().then((count: number) => {
          if (count === 0) {
            console.log('Seeding database...');
            exec('node prisma/seed.js', { cwd: process.cwd() }, (seedErr: any, seedOut: any) => {
              if (seedErr) console.error('Seed error:', seedErr.message);
              else console.log('Seeded:', seedOut?.trim() || 'OK');
            });
          } else {
            console.log(`Database ready (${count} players)`);
          }
        }).catch((countErr: any) => console.error('Count error:', countErr));
      });
    } catch (dbErr) {
      console.error('Database failed:', dbErr);
    }
  } else {
    console.warn('No DATABASE_URL - database unavailable');
  }

  try {
    const redisConnected = await connectRedis();
    console.log(redisConnected ? 'Redis connected' : 'Redis not configured - optional cache disabled');
  } catch {
    console.warn('Redis unavailable');
  }
};

startServer();

export { io };
