import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import { exec } from 'child_process';
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
import { matchesListRouter } from './modules/matches/matches-list.routes';
import { economyRouter } from './modules/economy/economy.routes';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes';
import { marketplaceRouter } from './modules/economy/marketplace.routes';
import { sportsRouter } from './modules/sports/sports.routes';
import { sponsorshipRouter } from './modules/sponsorships/sponsorship.routes';
import { promotionRouter } from './modules/promotion/promotion.routes';
import { trainingRouter } from './modules/training/training.routes';
import { equipmentRouter } from './modules/equipment/equipment.routes';
import { treasuryRouter } from './modules/treasury/treasury.routes';
import { solanaRouter } from './modules/solana/solana.routes';
import { stakingRouter } from './modules/staking/staking.routes';
import { teamCatalogRouter } from './modules/team-catalog/team-catalog.routes';
import { teamMarketplaceRouter } from './modules/team-marketplace/team-marketplace.routes';
import { playGameRouter } from './modules/play-game/play-game.routes';
import { aiTeamsRouter } from './modules/ai-teams/ai-teams.routes';
import { initializeSocketHandlers } from './websocket/socket.handlers';

const app = express();
app.set('trust proxy', 1);
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Also keep root health for backward compatibility
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
app.use('/api/sponsorships', sponsorshipRouter);
app.use('/api/promotion', promotionRouter);
app.use('/api/training', trainingRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/treasury', treasuryRouter);
app.use('/api/solana', solanaRouter);
app.use('/api/staking', stakingRouter);
app.use('/api/teams/catalog', teamCatalogRouter);
app.use('/api/team-marketplace', teamMarketplaceRouter);
app.use('/api/play-game', playGameRouter);
app.use('/api/ai-teams', aiTeamsRouter);

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

        // Only seed if no players exist (first deploy or after reset)
        import('./config/database').then(({ prisma }) => {
          prisma.player.count().then((count: number) => {
            if (count === 0) {
              console.log('Database empty, seeding players...');
              exec('node prisma/seed.js', { cwd: process.cwd() }, (seedErr: any, seedOut: any) => {
                if (seedErr) console.error('Seed error:', seedErr.message);
                else {
                  console.log('Seeded:', seedOut?.trim() || 'OK');
                  // Generate AI teams after seed
                  import('./modules/ai-teams/ai-teams.service').then(({ generateAllAITeams }) => {
                    generateAllAITeams().catch((e: any) => console.error('AI team generation error:', e));
                  });
                }
              });
            } else {
              const footballPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];
              const oldSoccerPositions = ['GK', 'DEF', 'MID', 'FWD'];
              prisma.player.count({ where: { position: { in: oldSoccerPositions } } }).then(async (legacyCount: number) => {
                if (legacyCount > 0) {
                  console.log(`Converting ${legacyCount} legacy soccer-position players to American football positions...`);
                  const players = await prisma.player.findMany({ orderBy: { id: 'asc' }, select: { id: true } });
                  await Promise.all(players.map((player: { id: string }, index: number) =>
                    prisma.player.update({
                      where: { id: player.id },
                      data: { position: footballPositions[index % footballPositions.length] },
                    })
                  ));
                  console.log('American football position conversion complete');
                  // Generate AI teams after conversion
                  import('./modules/ai-teams/ai-teams.service').then(({ generateAllAITeams }) => {
                    generateAllAITeams().catch((e: any) => console.error('AI team generation error:', e));
                  });
                } else {
                  console.log(`Database ready (${count} players)`);
                  // Generate AI teams
                  import('./modules/ai-teams/ai-teams.service').then(({ generateAllAITeams }) => {
                    generateAllAITeams().catch((e: any) => console.error('AI team generation error:', e));
                  });
                }
              }).catch((convertErr: any) => console.error('Football conversion error:', convertErr));
            }
          }).catch((countErr: any) => console.error('Count error:', countErr));
        });
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
