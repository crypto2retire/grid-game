import { prisma } from '../src/config/database';

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect and clean up
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up test data before each test
  const tables = ['MatchParticipant', 'PlayerMatchStats', 'MatchEvent', 'Match', 'MarketplaceListing', 'TeamPlayer', 'Wallet', 'Player', 'Team', 'User'];
  
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
});
