import { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type ProgressionPlayerInput = {
  playerId: string;
  teamId: string;
  position?: string;
  stats: {
    goals: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    passes: number;
    tackles: number;
    saves: number;
    rating: number;
    sportStats?: Record<string, any>;
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function calculateMvpDelta(input: ProgressionPlayerInput): number {
  const s = input.stats;
  const native = s.sportStats || {};
  const touchdowns = num(native.touchdowns) || s.goals;
  return (
    s.rating * 2 +
    touchdowns * 8 +
    s.assists * 5 +
    num(native.passingTouchdowns) * 6 +
    Math.floor(num(native.yards) / 25) +
    s.tackles * 1.5 +
    num(native.turnoversForced) * 7 +
    num(native.fieldGoals) * 4 +
    s.saves * 2
  );
}

// ─── Age-Based Growth Curve ───
// 18-21: Fast growth (+2 base, +3 with good rating)
// 22-25: Normal growth (+1 base, +2 with good rating)
// 26-29: Slow growth (+1 base, +1 with good rating)
// 30-33: Maintenance (0 base, +1 with excellent rating, small decline chance)
// 34+: Decline (-1 base, small growth chance with excellent rating)
function getAgeGrowthFactor(age: number): number {
  if (age <= 21) return 2;
  if (age <= 25) return 1;
  if (age <= 29) return 1;
  if (age <= 33) return 0;
  return -1; // Decline after 33
}

function getDeclineChance(age: number): number {
  if (age <= 29) return 0;
  if (age <= 33) return 0.15; // 15% chance of -1 per game
  return 0.35; // 35% decline chance after 33
}

// ─── Injury System ───
// Chance based on: position, fatigue, physical stat, age
function calculateInjuryChance(player: any): number {
  const positionRisk: Record<string, number> = {
    RB: 0.035, QB: 0.025, WR: 0.03, TE: 0.025, // High contact
    OL: 0.025, DL: 0.03, LB: 0.035, CB: 0.025,  // Moderate contact
    S: 0.02, K: 0.005, P: 0.005, // Low contact
  };
  const baseChance = positionRisk[player.position] || 0.02;
  const fatigueMult = player.fatigue > 70 ? 2.0 : player.fatigue > 50 ? 1.5 : 1.0;
  const physicalMult = player.physical < 50 ? 1.5 : player.physical < 70 ? 1.2 : 0.9;
  const ageMult = player.age > 30 ? 1.3 : player.age > 25 ? 1.1 : 1.0;
  return baseChance * fatigueMult * physicalMult * ageMult;
}

function rollInjury(player: any): { occurred: boolean; type?: string; severity?: string; weeks?: number; healthLoss?: number } {
  const chance = calculateInjuryChance(player);
  const roll = Math.random();
  if (roll > chance) return { occurred: false };

  const severityRoll = Math.random();
  const types = ['Sprained Ankle', 'Hamstring Strain', 'Concussion', 'Shoulder Injury', 'Knee Sprain', 'Fractured Rib', 'Groin Pull'];
  const type = types[Math.floor(Math.random() * types.length)];

  if (severityRoll < 0.5) {
    return { occurred: true, type, severity: 'MINOR', weeks: 1, healthLoss: 10 };
  } else if (severityRoll < 0.85) {
    return { occurred: true, type, severity: 'MODERATE', weeks: 2, healthLoss: 25 };
  } else if (severityRoll < 0.95) {
    return { occurred: true, type, severity: 'MAJOR', weeks: 4, healthLoss: 40 };
  } else {
    return { occurred: true, type, severity: 'SEASON_ENDING', weeks: 12, healthLoss: 60 };
  }
}

function calculateGrowth(input: ProgressionPlayerInput, age: number) {
  const s = input.stats;
  const native = s.sportStats || {};
  const ageFactor = getAgeGrowthFactor(age);
  const declineChance = getDeclineChance(age);
  const ratingBoost = s.rating >= 8.2 ? 2 : s.rating >= 7.2 ? 1 : 0;
  const heavyUse = s.shots + s.passes + s.tackles + s.saves;
  const fatigueGain = clamp(Math.round(3 + heavyUse / 3), 2, 12);
  const moraleDelta = s.rating >= 7.5 ? 3 : s.rating >= 6.5 ? 1 : s.rating < 5.8 ? -3 : -1;
  const formDelta = s.rating >= 7.5 ? 4 : s.rating >= 6.5 ? 2 : s.rating < 5.8 ? -4 : -1;

  const touchdowns = num(native.touchdowns) || s.goals;
  const yards = num(native.yards);
  const turnovers = num(native.turnoversForced);
  const fieldGoals = num(native.fieldGoals);
  const passingTouchdowns = num(native.passingTouchdowns);

  // Apply decline chance for older players
  const isDeclining = age >= 30 && Math.random() < declineChance;

  return {
    pace: isDeclining ? -1 : (touchdowns > 0 || yards >= 80 ? ageFactor : 0) + ratingBoost,
    shooting: isDeclining ? -1 : (passingTouchdowns > 0 || fieldGoals > 0 ? ageFactor : 0) + ratingBoost,
    passing: isDeclining ? -1 : (s.assists > 0 || passingTouchdowns > 0 || s.passes >= 3 ? ageFactor : 0) + ratingBoost,
    dribbling: isDeclining ? -1 : (yards >= 60 || s.shots >= 2 ? ageFactor : 0) + ratingBoost,
    defending: isDeclining ? -1 : (turnovers > 0 || s.tackles >= 3 ? ageFactor : 0) + ratingBoost,
    physical: isDeclining ? -1 : (s.tackles >= 2 || s.shots >= 2 || yards >= 50 ? ageFactor : 0) + ratingBoost,
    fatigueGain,
    moraleDelta,
    formDelta,
    injury: { occurred: false } as any,
  };
}

export async function applyPostGameProgression(
  tx: TransactionClient | any,
  input: {
    sportId: string;
    season?: string;
    matchId: string;
    players: ProgressionPlayerInput[];
  }
) {
  const season = input.season || 'beta';

  for (const player of input.players) {
    const s = player.stats;
    const native = s.sportStats || {};
    const touchdowns = num(native.touchdowns) || s.goals;
    const passingTouchdowns = num(native.passingTouchdowns);
    const fieldGoals = num(native.fieldGoals);
    const yards = num(native.yards);
    const plays = num(native.plays) || s.shots;
    const stops = num(native.stops) || s.saves;
    const turnoversForced = num(native.turnoversForced);
    const mvpDelta = calculateMvpDelta(player);

    const existing = await tx.playerSeasonStats.findUnique({
      where: {
        playerId_sportId_season: {
          playerId: player.playerId,
          sportId: input.sportId,
          season,
        },
      },
    });

    const nextGames = (existing?.gamesPlayed || 0) + 1;
    const nextRatingTotal = (existing?.ratingTotal || 0) + s.rating;
    const nextRatingAverage = Math.round((nextRatingTotal / nextGames) * 100) / 100;
    const nextMvpScore = Math.round(((existing?.mvpScore || 0) + mvpDelta) * 100) / 100;

    await tx.playerSeasonStats.upsert({
      where: {
        playerId_sportId_season: {
          playerId: player.playerId,
          sportId: input.sportId,
          season,
        },
      },
      create: {
        playerId: player.playerId,
        sportId: input.sportId,
        season,
        gamesPlayed: 1,
        starts: 1,
        touchdowns,
        passingTouchdowns,
        fieldGoals,
        yards,
        plays,
        assists: s.assists,
        tackles: s.tackles,
        stops,
        turnoversForced,
        ratingTotal: s.rating,
        ratingAverage: s.rating,
        mvpScore: mvpDelta,
        stats: { lastMatchId: input.matchId, lastRating: s.rating },
      },
      update: {
        gamesPlayed: { increment: 1 },
        starts: { increment: 1 },
        touchdowns: { increment: touchdowns },
        passingTouchdowns: { increment: passingTouchdowns },
        fieldGoals: { increment: fieldGoals },
        yards: { increment: yards },
        plays: { increment: plays },
        assists: { increment: s.assists },
        tackles: { increment: s.tackles },
        stops: { increment: stops },
        turnoversForced: { increment: turnoversForced },
        ratingTotal: { increment: s.rating },
        ratingAverage: nextRatingAverage,
        mvpScore: nextMvpScore,
        stats: { lastMatchId: input.matchId, lastRating: s.rating },
      },
    });

    const current = await tx.player.findUnique({ where: { id: player.playerId } });
    if (!current) continue;

    const growth = calculateGrowth(player, current.age);
    
    // Apply injury if it occurred
    const injury = rollInjury(current);
    
    const nextHealth = clamp(current.health - (injury.healthLoss || 0), 0, 100);
    const nextInjuryStatus = injury.occurred ? (injury.severity === 'SEASON_ENDING' ? 'SEASON_ENDING' : 'WEEK_TO_WEEK') : (current.injuryWeeks > 0 ? current.injuryStatus : 'HEALTHY');
    const nextInjuryType = injury.occurred ? injury.type : current.injuryType;
    const nextInjuryWeeks = injury.occurred ? (injury.weeks || 0) : Math.max(0, (current.injuryWeeks || 0) - 1);

    const nextPace = clamp(current.pace + growth.pace, 1, 99);
    const nextShooting = clamp(current.shooting + growth.shooting, 1, 99);
    const nextPassing = clamp(current.passing + growth.passing, 1, 99);
    const nextDribbling = clamp(current.dribbling + growth.dribbling, 1, 99);
    const nextDefending = clamp(current.defending + growth.defending, 1, 99);
    const nextPhysical = clamp(current.physical + growth.physical, 1, 99);
    const nextOverall = Math.round((nextPace + nextShooting + nextPassing + nextDribbling + nextDefending + nextPhysical) / 6);

    const attributes = {
      ...(typeof current.attributes === 'object' && current.attributes ? current.attributes as Record<string, any> : {}),
      speed: nextPace,
      arm: nextShooting,
      footballIQ: nextPassing,
      agility: nextDribbling,
      tackling: nextDefending,
      strength: nextPhysical,
      health: nextHealth,
      injuryStatus: nextInjuryStatus,
      lastProgression: {
        matchId: input.matchId,
        rating: s.rating,
        deltas: growth,
        injury: injury.occurred ? { type: injury.type, severity: injury.severity, weeks: injury.weeks } : null,
      },
    };

    await tx.player.update({
      where: { id: player.playerId },
      data: {
        pace: nextPace,
        shooting: nextShooting,
        passing: nextPassing,
        dribbling: nextDribbling,
        defending: nextDefending,
        physical: nextPhysical,
        overall: nextOverall,
        form: clamp(current.form + growth.formDelta, 1, 99),
        morale: clamp(current.morale + growth.moraleDelta, 1, 99),
        fatigue: clamp(current.fatigue + growth.fatigueGain, 0, 99),
        health: nextHealth,
        injuryStatus: nextInjuryStatus,
        injuryType: nextInjuryType,
        injuryWeeks: nextInjuryWeeks,
        attributes,
      },
    });

    // Log development and injury
    if (growth.pace !== 0 || growth.shooting !== 0 || growth.passing !== 0 || growth.dribbling !== 0 || growth.defending !== 0 || growth.physical !== 0) {
      await tx.playerDevelopmentLog.create({
        data: {
          playerId: player.playerId,
          matchId: input.matchId,
          statGained: Object.entries(growth).filter(([_, v]) => v !== 0 && typeof v === 'number').map(([k, v]) => `${k}:${v}`).join(',') || 'none',
          amount: Object.values(growth).filter((v) => typeof v === 'number' && v !== 0).reduce((a, b) => a + (b as number), 0),
          reason: `Post-game progression (age ${current.age})`,
        },
      });
    }

    if (injury.occurred) {
      await tx.playerDevelopmentLog.create({
        data: {
          playerId: player.playerId,
          matchId: input.matchId,
          statGained: 'INJURY',
          amount: -(injury.healthLoss || 0),
          reason: `Injury: ${injury.type} (${injury.severity}) - ${injury.weeks} weeks`,
        },
      });
    }
  }
}

// ─── Age Progression (called once per simulated season/year) ───
export async function agePlayers(tx: TransactionClient | any) {
  const players = await tx.player.findMany({
    where: { age: { gte: 18 } },
  });

  for (const player of players) {
    const newAge = player.age + 1;
    
    // Natural health recovery (1% per year off, but age reduces max health)
    const healthDecline = newAge > 30 ? 2 : newAge > 25 ? 1 : 0;
    const newHealth = clamp(player.health + 5 - healthDecline, 0, 100 - healthDecline);

    // Small stat decline for aging players (age 30+)
    const decline = newAge > 30 ? -1 : 0;
    const newPace = clamp(player.pace + decline, 1, 99);
    const newPhysical = clamp(player.physical + decline, 1, 99);
    const newOverall = Math.round((newPace + player.shooting + player.passing + player.dribbling + player.defending + newPhysical) / 6);

    await tx.player.update({
      where: { id: player.id },
      data: {
        age: newAge,
        health: newHealth,
        pace: newPace,
        physical: newPhysical,
        overall: newOverall,
        // Clear minor injuries after a year
        injuryStatus: (player.injuryWeeks || 0) > 0 && player.injuryWeeks <= 4 ? 'HEALTHY' : player.injuryStatus,
        injuryWeeks: Math.max(0, (player.injuryWeeks || 0) - 4),
      },
    });
  }

  return { playersAged: players.length };
}