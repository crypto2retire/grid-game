import { prisma } from '../../config/database';
import { generatePlayerData } from '../players/player.generator';

const AI_OWNER_ID = 'ai-system-owner-001';
const footballPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const AI_TEAM_NAMES: Record<string, string[]> = {
  STATE_COLLEGE: ['JV Strikers', 'Freshman Raptors', 'Sophomore Cobras', 'Prep Vanguards', 'Rookie Griffins'],
  MID_COLLEGE: ['CC Phoenix', 'Division II Renegades', 'Conference Thunderbolts', 'Mid-Major Spartans', 'Regional Falcons'],
  TOP_COLLEGE: ['FCS Comets', 'FBS Centurions', 'National Paladins', 'Conference Monarchs', 'Blue Chip Marauders'],
  REGIONAL_PRO: ['Semi-Pro Outlaws', 'Xtreme Vipers', 'Alliance Express', 'Regional Wolves', 'Pro Prospect Stallions'],
  PRO_ENTRY: ['Pro Grid Expansion', 'Gridiron Invaders', 'United Gamblers', 'Pro Debut Coyotes', 'Entry-level Goliaths'],
  PRO_ELITE: ['Dynasty Sentinels', 'Legendary Miners', 'Hall of Fame Merchants', 'Championship Ironworks', 'Elite Wranglers'],
};

const AI_DIFFICULTY_MULTIPLIERS: Record<string, { minOvr: number; maxOvr: number }> = {
  rookie: { minOvr: 55, maxOvr: 70 },
  veteran: { minOvr: 65, maxOvr: 80 },
  elite: { minOvr: 75, maxOvr: 90 },
  legend: { minOvr: 85, maxOvr: 99 },
};

export async function ensureAIOwner(): Promise<string> {
  let owner = await prisma.user.findUnique({ where: { id: AI_OWNER_ID } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { id: AI_OWNER_ID, email: 'ai@grid-game.system', username: 'ai-system', password: 'AI_SYSTEM_PASSWORD_HASH_NOT_USED_FOR_LOGIN', displayName: 'AI System', role: 'ADMIN' },
    });
    await prisma.wallet.create({ data: { userId: AI_OWNER_ID, cash: 0, gridTokens: 0, solBalance: 0 } });
  }
  return owner.id;
}

export async function generateAIPlayers(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { teamPlayers: true } });
  if (!team || team.teamPlayers.length > 0) return;
  const difficulty = AI_DIFFICULTY_MULTIPLIERS[team.aiDifficulty] || AI_DIFFICULTY_MULTIPLIERS.rookie;
  // Age ranges by tier: college 18-23, pro 22-35
  const tierAgeRanges: Record<string, [number, number]> = {
    STATE_COLLEGE: [18, 20],
    MID_COLLEGE: [19, 21],
    TOP_COLLEGE: [20, 23],
    REGIONAL_PRO: [22, 27],
    PRO_ENTRY: [24, 29],
    PRO_ELITE: [27, 35],
  };
  const [ageMin, ageMax] = tierAgeRanges[team.tier] || [18, 35];
  for (let i = 0; i < 43; i++) {
    const pos = footballPositions[i % footballPositions.length];
    const data = generatePlayerData({ sportId: 'american-football', position: pos });
    const targetOverall = randomInt(difficulty.minOvr, difficulty.maxOvr);
    const spread = targetOverall - 50;
    const adjusted = { ...data, age: randomInt(ageMin, ageMax), pace: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))), shooting: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))), passing: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))), dribbling: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))), defending: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))), physical: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))) };
    adjusted.overall = Math.round((adjusted.pace + adjusted.shooting + adjusted.passing + adjusted.dribbling + adjusted.defending + adjusted.physical) / 6);
    adjusted.basePrice = adjusted.overall * 100;
    const player = await prisma.player.create({ data: { ...adjusted, health: 100, injuryStatus: 'HEALTHY', injuryWeeks: 0, attributes: { ...adjusted.attributes, legacy: { pace: adjusted.pace, shooting: adjusted.shooting, passing: adjusted.passing, dribbling: adjusted.dribbling, defending: adjusted.defending, physical: adjusted.physical, goalkeeping: 0 } } } as any });
    await prisma.teamPlayer.create({ data: { teamId, playerId: player.id, isStarter: i < 11 } });
  }
}

export async function generateAllAITeams() {
  const ownerId = await ensureAIOwner();
  const tierOrder = ['STATE_COLLEGE', 'MID_COLLEGE', 'TOP_COLLEGE', 'REGIONAL_PRO', 'PRO_ENTRY', 'PRO_ELITE'];
  const difficulties = ['rookie', 'veteran', 'elite', 'legend'];
  for (const tier of tierOrder) {
    const names = AI_TEAM_NAMES[tier] || [];
    const count = tier === 'STATE_COLLEGE' ? 3 : tier === 'TOP_COLLEGE' ? 4 : tier === 'PRO_ENTRY' ? 4 : tier === 'PRO_ELITE' ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const name = names[i] || `${tier} AI Team ${i + 1}`;
      const difficulty = difficulties[i % difficulties.length];
      let team = await prisma.team.findFirst({ where: { name, isAI: true } });
      if (!team) {
        const gridPrice = getTierPrice(tier, difficulty);
        team = await prisma.team.create({
          data: { name, sportId: 'american-football', ownerId, tier, isFree: tier === 'STATE_COLLEGE', isAI: true, aiDifficulty: difficulty, aiStrategy: getRandomStrategy(), purchasePrice: tier === 'STATE_COLLEGE' ? 0 : gridPrice, purchaseCurrency: tier === 'STATE_COLLEGE' ? 'FREE' : 'GRID', formation: '4-3-3', tactics: { formation: '4-3-3', sportId: 'american-football' } },
        });
        await prisma.venue.create({ data: { teamId: team.id, ownerId: AI_OWNER_ID, sportId: 'american-football', name: `${name} Stadium`, tier: getStadiumTier(tier), capacity: getStadiumCapacity(tier), ticketPrice: 15, condition: 80, prestige: getStadiumPrestige(tier), leaseRate: 0.10, purchasePrice: getVenuePurchasePrice(tier) } });
        await prisma.transportationAsset.create({ data: { teamId: team.id, ownerId: AI_OWNER_ID, tier: getTransportTier(tier), name: getTransportName(tier), operatingCost: getTransportCost(tier), fatigueReduction: getTransportFatigue(tier), prestige: getTransportPrestige(tier), purchasePrice: getTransportPurchasePrice(tier) } });
        await prisma.teamLeagueMembership.upsert({
          where: { teamId_leagueId_season: { teamId: team.id, leagueId: 'local-rec-football', season: 'beta' } },
          create: { teamId: team.id, leagueId: 'local-rec-football', season: 'beta', status: 'ACTIVE' },
          update: {},
        });
      }
      await generateAIPlayers(team.id);
    }
  }
}

function getTierPrice(tier: string, difficulty: string): number {
  const basePrices: Record<string, number> = { STATE_COLLEGE: 0, MID_COLLEGE: 15000, TOP_COLLEGE: 50000, REGIONAL_PRO: 200000, PRO_ENTRY: 1000000, PRO_ELITE: 5000000 };
  const diffMult: Record<string, number> = { rookie: 0.8, veteran: 1.0, elite: 1.3, legend: 1.8 };
  return Math.round(basePrices[tier] * (diffMult[difficulty] || 1));
}

function getRandomStrategy(): string { return ['balanced', 'runHeavy', 'passHeavy', 'aggressive', 'conservative'][Math.floor(Math.random() * 5)]; }
function getStadiumTier(tier: string): string { return { STATE_COLLEGE: 'PARK_FIELD', MID_COLLEGE: 'COMMUNITY', TOP_COLLEGE: 'SMALL_STADIUM', REGIONAL_PRO: 'REGIONAL', PRO_ENTRY: 'PRO', PRO_ELITE: 'ELITE' }[tier] || 'PARK_FIELD'; }
function getStadiumCapacity(tier: string): number { return { STATE_COLLEGE: 5000, MID_COLLEGE: 12000, TOP_COLLEGE: 35000, REGIONAL_PRO: 25000, PRO_ENTRY: 65000, PRO_ELITE: 100000 }[tier] || 5000; }
function getStadiumPrestige(tier: string): number { return { STATE_COLLEGE: 10, MID_COLLEGE: 25, TOP_COLLEGE: 40, REGIONAL_PRO: 50, PRO_ENTRY: 65, PRO_ELITE: 85 }[tier] || 10; }
function getTransportTier(tier: string): string { return { STATE_COLLEGE: 'CARPOOL', MID_COLLEGE: 'BUS', TOP_COLLEGE: 'BUS', REGIONAL_PRO: 'CHARTER', PRO_ENTRY: 'CHARTER', PRO_ELITE: 'LUXURY' }[tier] || 'BUS'; }
function getTransportName(tier: string): string { return { STATE_COLLEGE: 'Carpool / Rental Vans', MID_COLLEGE: 'Team Bus', TOP_COLLEGE: 'Team Bus', REGIONAL_PRO: 'Team Charter', PRO_ENTRY: 'Team Charter', PRO_ELITE: 'Private Jet' }[tier] || 'Team Bus'; }
function getTransportCost(tier: string): number { return { STATE_COLLEGE: 100, MID_COLLEGE: 300, TOP_COLLEGE: 500, REGIONAL_PRO: 1000, PRO_ENTRY: 2000, PRO_ELITE: 5000 }[tier] || 500; }
function getTransportFatigue(tier: string): number { return { STATE_COLLEGE: 0, MID_COLLEGE: 10, TOP_COLLEGE: 10, REGIONAL_PRO: 20, PRO_ENTRY: 20, PRO_ELITE: 30 }[tier] || 10; }
function getTransportPrestige(tier: string): number { return { STATE_COLLEGE: 0, MID_COLLEGE: 5, TOP_COLLEGE: 10, REGIONAL_PRO: 20, PRO_ENTRY: 30, PRO_ELITE: 50 }[tier] || 10; }
function getVenuePurchasePrice(tier: string): number { return { STATE_COLLEGE: 5000, MID_COLLEGE: 25000, TOP_COLLEGE: 100000, REGIONAL_PRO: 500000, PRO_ENTRY: 2000000, PRO_ELITE: 10000000 }[tier] || 5000; }
function getTransportPurchasePrice(tier: string): number { return { STATE_COLLEGE: 1000, MID_COLLEGE: 5000, TOP_COLLEGE: 15000, REGIONAL_PRO: 50000, PRO_ENTRY: 200000, PRO_ELITE: 1000000 }[tier] || 1000; }

export async function getAIOpponents(userTeamId: string, tier: string) {
  const existingMatches = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: userTeamId, status: { not: 'COMPLETED' } }, { awayTeamId: userTeamId, status: { not: 'COMPLETED' } }] },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const busyTeamIds = new Set<string>();
  existingMatches.forEach((m) => { busyTeamIds.add(m.homeTeamId); busyTeamIds.add(m.awayTeamId); });
  return prisma.team.findMany({
    where: { isAI: true, tier, id: { notIn: Array.from(busyTeamIds) }, isForSale: false },
    include: { teamPlayers: { include: { player: true } }, venue: true },
    orderBy: { aiDifficulty: 'asc' },
  });
}

export async function getLiveOpponents(userTeamId: string, tier: string) {
  const existingMatches = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: userTeamId, status: { not: 'COMPLETED' } }, { awayTeamId: userTeamId, status: { not: 'COMPLETED' } }] },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const busyTeamIds = new Set<string>();
  existingMatches.forEach((m) => { busyTeamIds.add(m.homeTeamId); busyTeamIds.add(m.awayTeamId); });
  return prisma.team.findMany({
    where: { isAI: false, tier, id: { not: userTeamId, notIn: Array.from(busyTeamIds) }, isForSale: false },
    include: { owner: { select: { id: true, username: true, displayName: true } }, teamPlayers: { include: { player: true } }, venue: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function scheduleAIMatch(userTeamId: string, aiTeamId: string) {
  const aiTeam = await prisma.team.findUnique({ where: { id: aiTeamId } });
  if (!aiTeam || aiTeam.isAI !== true) throw new Error('Selected team is not an AI opponent');
  return prisma.match.create({
    data: { sportId: 'american-football', homeTeamId: userTeamId, awayTeamId: aiTeamId, status: 'SCHEDULED', scheduledAt: new Date(), homeTactics: { formation: '4-3-3', sportId: 'american-football' }, awayTactics: { formation: '4-3-3', sportId: 'american-football' }, seed: Math.random().toString(36).substring(2), metadata: { matchType: 'AI_OPPONENT', aiDifficulty: aiTeam.aiDifficulty } },
  });
}

export async function scheduleLiveMatch(homeTeamId: string, awayTeamId: string) {
  const homeTeam = await prisma.team.findUnique({ where: { id: homeTeamId } });
  const awayTeam = await prisma.team.findUnique({ where: { id: awayTeamId } });
  if (!homeTeam || !awayTeam) throw new Error('Team not found');
  if (homeTeam.isAI || awayTeam.isAI) throw new Error('Cannot use AI team in live match scheduling');
  return prisma.match.create({
    data: { sportId: 'american-football', homeTeamId, awayTeamId, status: 'SCHEDULED', scheduledAt: new Date(), homeTactics: { formation: '4-3-3', sportId: 'american-football' }, awayTactics: { formation: '4-3-3', sportId: 'american-football' }, seed: Math.random().toString(36).substring(2), metadata: { matchType: 'LIVE_OPPONENT' } },
  });
}

export async function getMatchmakingOptions(userTeamId: string) {
  const userTeam = await prisma.team.findUnique({ where: { id: userTeamId }, include: { leagueMemberships: { include: { league: true } } } });
  if (!userTeam) throw new Error('Team not found');
  const liveOpponents = await getLiveOpponents(userTeamId, userTeam.tier);
  const aiOpponents = await getAIOpponents(userTeamId, userTeam.tier);
  return {
    userTeam: { id: userTeam.id, name: userTeam.name, tier: userTeam.tier, wins: userTeam.wins, losses: userTeam.losses },
    liveOpponents: liveOpponents.map((t) => ({ id: t.id, name: t.name, tier: t.tier, owner: t.owner, wins: t.wins, losses: t.losses, overall: t.teamPlayers.length > 0 ? Math.round(t.teamPlayers.reduce((sum, tp) => sum + tp.player.overall, 0) / t.teamPlayers.length) : 0 })),
    aiOpponents: aiOpponents.map((t) => ({ id: t.id, name: t.name, tier: t.tier, aiDifficulty: t.aiDifficulty, aiStrategy: t.aiStrategy, wins: t.wins, losses: t.losses, overall: t.teamPlayers.length > 0 ? Math.round(t.teamPlayers.reduce((sum, tp) => sum + tp.player.overall, 0) / t.teamPlayers.length) : 0, purchasePrice: t.purchasePrice, purchaseCurrency: t.purchaseCurrency })),
  };
}
