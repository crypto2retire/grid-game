import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { creditCurrency, debitCurrency, processCurrencySink } from '../economy/currency.service';
import { processTreasuryOutflow } from '../treasury/treasury.service';
import { ensureDefaultDailyQuests, recordDailyQuestProgress } from '../daily-quests/daily-quests.service';

export type MiniGameType = 'TEAM_DRILL' | 'SCOUTING' | 'STADIUM_MATCH';

interface MiniGameConfig {
  type: MiniGameType;
  label: string;
  category: string;
  costCash: number;
  difficulty: number;
  description: string;
  cooldownSeconds: number;
  dailyCap: number;
  fatiguePerAttempt: number;
  baseLossChance: number;
  maxRewardCash: number;
  dailyRewardBudget: number;
}

const MINI_GAME_TOTAL_DAILY_CAP = 10;

const MINI_GAMES: Record<MiniGameType, MiniGameConfig> = {
  TEAM_DRILL: {
    type: 'TEAM_DRILL',
    label: 'Team Drill Challenge',
    category: 'TEAM_DRILL',
    costCash: 50,
    difficulty: 55,
    cooldownSeconds: 120,
    dailyCap: 6,
    fatiguePerAttempt: 7,
    baseLossChance: 0.18,
    maxRewardCash: 90,
    dailyRewardBudget: 450,
    description: 'Server-resolved football drill. Strong rosters can earn small stat bumps, but fatigue and cooldowns stop grinding.',
  },
  SCOUTING: {
    type: 'SCOUTING',
    label: 'Prospect Combine Scan',
    category: 'SCOUTING',
    costCash: 80,
    difficulty: 58,
    cooldownSeconds: 180,
    dailyCap: 5,
    fatiguePerAttempt: 8,
    baseLossChance: 0.20,
    maxRewardCash: 140,
    dailyRewardBudget: 500,
    description: 'Read athletic signals, uncover a prospect profile, and advance scouting quests with capped reward-pool payouts.',
  },
  STADIUM_MATCH: {
    type: 'STADIUM_MATCH',
    label: 'Stadium Scrimmage',
    category: 'STADIUM_MATCH',
    costCash: 250,
    difficulty: 63,
    cooldownSeconds: 300,
    dailyCap: 3,
    fatiguePerAttempt: 12,
    baseLossChance: 0.24,
    maxRewardCash: 420,
    dailyRewardBudget: 900,
    description: 'A four-drive scrimmage with server-generated plays, attendance, revenue, stadium wear, and limited daily reward budget.',
  },
};

const STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function normalizeMiniGameType(value: string): MiniGameType {
  const normalized = value.toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'DRILL' || normalized === 'TRAINING') return 'TEAM_DRILL';
  if (normalized === 'SCRIMMAGE' || normalized === 'MATCH') return 'STADIUM_MATCH';
  if (normalized === 'SCOUT' || normalized === 'SCOUT_COMBINE') return 'SCOUTING';
  if (normalized in MINI_GAMES) return normalized as MiniGameType;
  throw new AppError(400, 'Unknown mini-game type');
}

function scoreFromRoster(rosterAverage: number, difficulty: number, fatigue: number): number {
  const skillSignal = rosterAverage - difficulty - fatigue * 0.25;
  const variance = Math.round(Math.random() * 34 - 10);
  return clamp(Math.round(62 + skillSignal * 0.9 + variance), 15, 100);
}

function resolveAttemptOutcome(config: MiniGameConfig, score: number, fatigue: number) {
  const skillProtection = Math.max(0, score - 60) * 0.004;
  const fatiguePressure = fatigue * 0.006;
  const lossChance = clamp(config.baseLossChance + fatiguePressure - skillProtection, 0.05, 0.78);
  const success = Math.random() >= lossChance;
  return { success, lossChance };
}

function outcomeFromScore(score: number, success: boolean): string {
  if (!success) return 'LOSS';
  if (score >= 90) return 'LEGENDARY';
  if (score >= 78) return 'GREAT';
  if (score >= 62) return 'SOLID';
  if (score >= 45) return 'SCRAPPY';
  return 'ROUGH';
}

function cashReward(config: MiniGameConfig, score: number, success: boolean, fatigue: number): number {
  if (!success) return 0;
  const performanceMultiplier = 0.35 + (score / 100) * 0.95 - fatigue * 0.004;
  return clamp(Math.round(config.costCash * performanceMultiplier), 0, config.maxRewardCash);
}

function secondsRemaining(lastAttempt: { createdAt: Date } | null, cooldownSeconds: number, now: Date): number {
  if (!lastAttempt) return 0;
  const elapsedSeconds = Math.floor((now.getTime() - new Date(lastAttempt.createdAt).getTime()) / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}

function generateScrimmage(score: number, success: boolean) {
  const driveCount = 4;
  let homeScore = 0;
  let awayScore = success ? 0 : 7;
  const drives = Array.from({ length: driveCount }, (_unused, index) => {
    const chance = score + Math.random() * 30 - 15;
    let result = 'PUNT';
    let points = 0;
    if (success && chance > 88) { result = 'TOUCHDOWN'; points = 7; }
    else if (success && chance > 70) { result = 'FIELD_GOAL'; points = 3; }
    else if (chance < 42) { result = 'TURNOVER'; }
    homeScore += points;
    if (Math.random() > (success ? 0.66 : 0.48)) awayScore += Math.random() > 0.55 ? 7 : 3;
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

function generateProspect(score: number, success: boolean) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'];
  const traits = ['high-motor', 'quick release', 'elite burst', 'sure hands', 'coverage instincts', 'film-room leader'];
  return {
    position: positions[Math.floor(Math.random() * positions.length)],
    projectedOverall: success ? clamp(Math.round(score * 0.72 + 22 + Math.random() * 10), 45, 99) : clamp(Math.round(score * 0.55 + 18), 38, 72),
    trait: success ? traits[Math.floor(Math.random() * traits.length)] : 'uncertain signal',
    confidence: success ? clamp(Math.round(48 + score * 0.45), 50, 96) : clamp(Math.round(25 + score * 0.25), 25, 55),
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
    cooldownSeconds: game.cooldownSeconds,
    dailyCap: game.dailyCap,
    description: game.description,
  }));
}

export async function playMiniGame(userId: string, rawType: string) {
  const miniGameType = normalizeMiniGameType(rawType);
  const config = MINI_GAMES[miniGameType];
  const now = new Date();
  const dayStart = startOfUtcDay(now);

  const [team, wallet, typeAttemptsToday, totalAttemptsToday, lastAttempt] = await Promise.all([
    getPrimaryTeam(userId),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.miniGameAttempt.count({ where: { userId, miniGameType, createdAt: { gte: dayStart } } }),
    prisma.miniGameAttempt.count({ where: { userId, createdAt: { gte: dayStart } } }),
    prisma.miniGameAttempt.findFirst({ where: { userId, miniGameType }, orderBy: { createdAt: 'desc' } }),
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

  const cooldownRemaining = secondsRemaining(lastAttempt, config.cooldownSeconds, now);
  if (cooldownRemaining > 0) {
    throw new AppError(429, `${config.label} is cooling down. Try again in ${cooldownRemaining} seconds.`);
  }
  if (typeAttemptsToday >= config.dailyCap) {
    throw new AppError(429, `${config.label} daily cap reached (${config.dailyCap}/day).`);
  }
  if (totalAttemptsToday >= MINI_GAME_TOTAL_DAILY_CAP) {
    throw new AppError(429, `Daily sports mini-game cap reached (${MINI_GAME_TOTAL_DAILY_CAP}/day).`);
  }

  await ensureDefaultDailyQuests();

  const avg = rosterAverage(team);
  const fatigue = clamp(typeAttemptsToday * config.fatiguePerAttempt + totalAttemptsToday * 2, 0, 80);
  const score = scoreFromRoster(avg, config.difficulty, fatigue);
  const { success, lossChance } = resolveAttemptOutcome(config, score, fatigue);
  const outcome = outcomeFromScore(score, success);
  const proposedRewardCash = cashReward(config, score, success, fatigue);
  const baseMetadata: Record<string, unknown> = {
    teamId: team.id,
    teamName: team.name,
    rosterAverage: Math.round(avg),
    costCash: config.costCash,
    cooldownSeconds: config.cooldownSeconds,
    dailyCap: config.dailyCap,
    typeAttemptsTodayBefore: typeAttemptsToday,
    totalAttemptsTodayBefore: totalAttemptsToday,
    fatigue,
    lossChance: Number(lossChance.toFixed(3)),
    success,
    proposedRewardCash,
  };

  let development: Record<string, unknown> | null = null;
  if (miniGameType === 'TEAM_DRILL') {
    const players = team.teamPlayers.map((tp: any) => tp.player);
    const player = players[Math.floor(Math.random() * players.length)];
    if (success && player && score >= 62) {
      const stat = STATS[Math.floor(Math.random() * STATS.length)];
      development = { playerId: player.id, playerName: player.name, stat, amount: score >= 85 ? 2 : 1 };
      baseMetadata.development = development;
    }
  }

  if (miniGameType === 'SCOUTING') {
    baseMetadata.prospect = generateProspect(score, success);
  }

  if (miniGameType === 'STADIUM_MATCH') {
    baseMetadata.scrimmage = generateScrimmage(score, success);
    baseMetadata.attendance = clamp(Math.round((team.venue?.capacity ?? 5000) * (0.08 + score / 650)), 50, team.venue?.capacity ?? 5000);
    baseMetadata.stadiumWear = success && score > 80 ? 1 : 2;
  }

  return prisma.$transaction(async (tx: any) => {
    const currentTypeAttemptsToday = await tx.miniGameAttempt.count({ where: { userId, miniGameType, createdAt: { gte: dayStart } } });
    const currentTotalAttemptsToday = await tx.miniGameAttempt.count({ where: { userId, createdAt: { gte: dayStart } } });
    const currentLastAttempt = await tx.miniGameAttempt.findFirst({ where: { userId, miniGameType }, orderBy: { createdAt: 'desc' } });
    const currentCooldownRemaining = secondsRemaining(currentLastAttempt, config.cooldownSeconds, now);

    if (currentCooldownRemaining > 0) {
      throw new AppError(429, `${config.label} is cooling down. Try again in ${currentCooldownRemaining} seconds.`);
    }
    if (currentTypeAttemptsToday >= config.dailyCap) {
      throw new AppError(429, `${config.label} daily cap reached (${config.dailyCap}/day).`);
    }
    if (currentTotalAttemptsToday >= MINI_GAME_TOTAL_DAILY_CAP) {
      throw new AppError(429, `Daily sports mini-game cap reached (${MINI_GAME_TOTAL_DAILY_CAP}/day).`);
    }

    const attempt = await tx.miniGameAttempt.create({
      data: {
        userId,
        miniGameType,
        score,
        outcome,
        rewardCash: 0,
        rewardDyn: 0,
        questProgress: [],
        metadata: { ...baseMetadata, settlement: 'PENDING' },
      },
    });

    let walletAfter = (await debitCurrency(tx, {
      userId,
      currency: 'CASH',
      amount: config.costCash,
      reason: 'MINI_GAME_ENTRY',
      sourceType: 'MINI_GAME',
      sourceId: attempt.id,
      metadata: { miniGameType, score, outcome },
    })).wallet;
    await processCurrencySink(tx, 'CASH', config.costCash, 'MINI_GAME_ENTRY', 'MINI_GAME', attempt.id, {
      miniGameType,
      score,
      outcome,
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
        data: { condition: { decrement: Number(baseMetadata.stadiumWear) } },
      });
    }

    const paidToday = await tx.miniGameAttempt.aggregate({
      where: { miniGameType, createdAt: { gte: dayStart }, id: { not: attempt.id } },
      _sum: { rewardCash: true },
    });
    const rewardPaidToday = Number(paidToday._sum.rewardCash ?? 0);
    const dailyRewardRemaining = Math.max(0, config.dailyRewardBudget - rewardPaidToday);
    const treasury = await tx.gameTreasury.findUnique({ where: { currency: 'CASH' } });
    const treasuryCashAvailable = Math.max(0, Math.floor(Number(treasury?.balance ?? 0)));
    const rewardCash = Math.min(proposedRewardCash, dailyRewardRemaining, treasuryCashAvailable);

    if (rewardCash > 0) {
      await processTreasuryOutflow(tx, 'CASH', rewardCash, 'MINI_GAME_REWARD', attempt.id, 'MINI_GAME', {
        miniGameType,
        score,
        outcome,
        rewardPaidToday,
        dailyRewardBudget: config.dailyRewardBudget,
      });
      walletAfter = (await creditCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: rewardCash,
        reason: 'MINI_GAME_REWARD',
        sourceType: 'MINI_GAME',
        sourceId: attempt.id,
        metadata: { miniGameType, score, outcome, proposedRewardCash },
      })).wallet;
    }

    const questProgress = await recordDailyQuestProgress(tx, userId, config.category, 1, {
      miniGameType,
      score,
      outcome,
      rewardCash,
      fatigue,
    });

    const metadata = {
      ...baseMetadata,
      rewardCash,
      rewardCappedByBudget: rewardCash < proposedRewardCash,
      rewardPaidToday,
      dailyRewardBudget: config.dailyRewardBudget,
      dailyRewardRemainingBeforeAttempt: dailyRewardRemaining,
      treasuryCashAvailableBeforeReward: treasuryCashAvailable,
      settlement: 'COMPLETE',
    };

    const updatedAttempt = await tx.miniGameAttempt.update({
      where: { id: attempt.id },
      data: {
        rewardCash,
        questProgress,
        metadata,
      },
    });

    return {
      attempt: updatedAttempt,
      miniGame: { type: miniGameType, label: config.label },
      score,
      outcome,
      rewardCash,
      proposedRewardCash,
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
