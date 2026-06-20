import type { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const database = await import('../src/config/database');
  prisma = database.prisma;
  await prisma.$connect();
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
});

beforeEach(async () => {
  if (!prisma) return;
  const tables = ['MatchParticipant', 'PlayerMatchStats', 'MatchEvent', 'Match', 'MarketplaceListing', 'TeamPlayer', 'Wallet', 'Player', 'Team', 'User'];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
});
