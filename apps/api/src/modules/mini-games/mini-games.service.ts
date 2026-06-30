import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordCurrencyLedger } from '../economy/ledger';
import { ensureDefaultDailyQuests, recordDailyQuestProgress } from '../daily-quests/daily-quests.service';

export type MiniGameType = 'TEAM_DRILL' | 'SCOUTING' | 'STADIUM_MATCH';

interface MiniGameConfig {
  type: MiniGameType;
  label: string;
  category: string;
  costCash: number;
  difficulty: number;
  description: string;
}

const MINI_GAMES: Record<MiniGameType, MiniGameConfig> = {
  TEAM_DRILL: {
    type: 'TEAM_DRILL',
    label: 'Team Drill Challenge',
    category: 'TEAM_DRILL',
    costCash: 50,
    difficulty: 55,
    description: 'Server-resolved football drill. Strong rosters score higher and may earn a small stat bump.',
  },
  SCOUTING: {
    type: 'SCOUTING',
    label: 'Prospect Combine Scan',
    category: 'SCOUTING',
    costCash: 80,
    difficulty: 58,
    description: 'Read athletic signals, uncover a prospect profile, and advance scouting quests.',
  },
  STADIUM_MATCH: {
    type: 'STADIUM_MATCH',
    label: 'Stadium Scrimmage',
    category: 'STADIUM_MATCH',
    costCash: 250,
    difficulty: 63,
    description: 'A four-drive scrimmage with server-generated plays, attendance, revenue, and stadium wear.',
  },
};

const STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeMiniGameType(value: string): MiniGameType {
  const normalized = value.toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'DRILL' || normalized === 'TRAINING') return 'TEAM_DRILL';
  if (normalized === 'SCRIMMAGE' || normalized === 'MATCH') return 'STADIUM_MATCH';
  if (normalized === 'SCOUT' || normalized === 'SCOUT_COMBINE') return 'SCOUTING';
  if (normalized in MINI_GAMES) return normalized as MiniGameType;
  throw new AppError(400, 'Unknown mini-game type');
}

function scoreFromRoster(rosterAverage: number, difficulty: number): number {
  const skillSignal = rosterAverage - difficulty;
  const variance = Math.round(Math.random() * 34 - 10);
  return clamp(Math.round(62 + skillSignal * 0.9 + variance), 15, 100);
}

function outcomeFromScore(score: number): string {
  if (score >= 90) return 'LEGENDARY';
  if (score >= 78) return 'GREAT';
  if (score >= 62) return 'SOLID';
  if (score >= 45) return 'SCRAPPY';
  return 'ROUGH';
}

function cashReward(type: MiniGameType, score: number): number {
  if (type === 'STADIUM_MATCH') return Math.round(500 + score * 16);
  if (type === 'TEAM_DRILL') return Math.round(150 + score * 7);
  return Math.round(120 + score * 5);
}

function generateScrimmage(score: number) {
  const driveCount = 4;
  let homeScore = 0;
  let awayScore = 0;
  const drives = Array.from({ length: driveCount }, (_unused, index) => {
    const chance = score + Math.random() * 30 - 15;
    let result = 'PUNT';
    let points = 0;
    if (chance > 88) { result = 'TOUCHDOWN'; points = 7; }
    else if (chance > 70) { result = 'FIELD_GOAL'; points = 3; }
    else if (chance < 35) { result = 'TURNOVER'; }
    homeScore += points;
    if (Math.random() > 0.64) awayScore += Math.random() > 0.55 ? 7 : 3;
    return {
      drive: index + 1,
      result,
      yards: clamp(Math.round(chance - 18 + Math.random() * 25), -8, 95),
      points,
      call: ['Tempo Sweep', 'Slot Fade', 'Power Counter', 'Play-Action Cross'][index],
    };
  });
  return { homeScore, awayScore, drives };
}

function generateProspect(score: number) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'];
  const traits = ['high-motor', 'quick release', 'elite burst', 'sure hands', 'coverage instincts', 'film-room leader'];
  return {
    position: positions[Math.floor(Math.random() * positions.length)],
    projectedOverall: clamp(Math.round(score * 0.72 + 22 + Math.random() * 10), 45, 99),
    trait: traits[Math.floor(Math.random() * traits.length)],
    confidence: clamp(Math.round(48 + score * 0.45), 50, 96),
  };
}

async function getPrimaryTeam(userId: string) {
  return prisma.team.findFirst({
    where: { ownerId: userId },
    include: {
      venue: true,
      teamPlayers: { include: { player: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function rosterAverage(team: Awaited<ReturnType<typeof getPrimaryTeam>>): number {
  const players = team?.teamPlayers?.map((tp: any) => tp.player) ?? [];
  if (players.length === 0) return 58;
  return players.reduce((sum: number, player: any) => sum + (player.overall ?? 58), 0) / players.length;
}

export function getMiniGameCatalog() {
  return Object.values(MINI_GAMES).map((game) => ({
    type: game.type,
    label: game.label,
    category: game.category,
    costCash: game.costCash,
    description: game.description,
  }));
}

export async function playMiniGame(userId: string, rawType: string) {
  const miniGameType = normalizeMiniGameType(rawType);
  const config = MINI_GAMES[miniGameType];
  const [team, wallet] = await Promise.all([
    getPrimaryTeam(userId),
    prisma.wallet.findUnique({ where: { userId } }),
  ]);

  if (!team) {
    throw new AppError(400, 'Create or buy a team before playing sports mini-games.');
  }
  if (!wallet) {
    throw new AppError(404, 'Wallet not found');
  }
  if (wallet.cash < config.costCash) {
    throw new AppError(400, `Need ${config.costCash.toLocaleString()} CASH for this mini-game.`);
  }

  await ensureDefaultDailyQuests();

  const avg = rosterAverage(team);
  const score = scoreFromRoster(avg, config.difficulty);
  const outcome = outcomeFromScore(score);
  const rewardCash = cashReward(miniGameType, score);
  const metadata: Record<string, unknown> = {
    teamId: team.id,
    teamName: team.name,
    rosterAverage: Math.round(avg),
    costCash: config.costCash,
  };

  let development: Record<string, unknown> | null = null;
  if (miniGameType === 'TEAM_DRILL') {
    const players = team.teamPlayers.map((tp: any) => tp.player);
    const player = players[Math.floor(Math.random() * players.length)];
    if (player && score >= 62) {
      const stat = STATS[Math.floor(Math.random() * STATS.length)];
      development = { playerId: player.id, playerName: player.name, stat, amount: score >= 85 ? 2 : 1 };
      metadata.development = development;
    }
  }

  if (miniGameType === 'SCOUTING') {
    metadata.prospect = generateProspect(score);
  }

  if (miniGameType === 'STADIUM_MATCH') {
    metadata.scrimmage = generateScrimmage(score);
    metadata.attendance = clamp(Math.round((team.venue?.capacity ?? 5000) * (0.12 + score / 500)), 100, team.venue?.capacity ?? 5000);
    metadata.stadiumWear = score > 80 ? 1 : 2;
  }

  return prisma.$transaction(async (tx: any) => {
    let walletAfter = await tx.wallet.update({
      where: { userId },
      data: { cash: { decrement: config.costCash } },
    });
    await recordCurrencyLedger(tx, {
      userId,
      currency: 'CASH',
      amount: -config.costCash,
      balanceAfter: walletAfter.cash,
      reason: 'MINI_GAME_ENTRY',
      sourceType: 'MINI_GAME',
      metadata: { miniGameType },
    });

    if (development) {
      const stat = String(development.stat);
      const amount = Number(development.amount);
      await tx.player.update({
        where: { id: String(development.playerId) },
        data: {
          [stat]: { increment: amount },
          overall: { increment: amount >= 2 ? 1 : 0 },
          morale: { increment: 1 },
        },
      });
    }

    if (miniGameType === 'STADIUM_MATCH' && team.venue) {
      await tx.venue.update({
        where: { id: team.venue.id },
        data: { condition: { decrement: Number(metadata.stadiumWear) } },
      });
    }

    walletAfter = await tx.wallet.update({
      where: { userId },
      data: { cash: { increment: rewardCash } },
    });
    await recordCurrencyLedger(tx, {
      userId,
      currency: 'CASH',
      amount: rewardCash,
      balanceAfter: walletAfter.cash,
      reason: 'MINI_GAME_REWARD',
      sourceType: 'MINI_GAME',
      metadata: { miniGameType, score, outcome },
    });

    const questProgress = await recordDailyQuestProgress(tx, userId, config.category, 1, {
      miniGameType,
      score,
      outcome,
    });

    const attempt = await tx.miniGameAttempt.create({
      data: {
        userId,
        miniGameType,
        score,
        outcome,
        rewardCash,
        rewardDyn: 0,
        questProgress,
        metadata,
      },
    });

    return {
      attempt,
      miniGame: { type: miniGameType, label: config.label },
      score,
      outcome,
      rewardCash,
      costCash: config.costCash,
      netCash: rewardCash - config.costCash,
      questProgress,
      metadata,
      wallet: walletAfter,
    };
  });
}

export async function getMiniGameHistory(userId: string) {
  return prisma.miniGameAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}
