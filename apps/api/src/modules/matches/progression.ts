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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

function calculateGrowth(input: ProgressionPlayerInput) {
  const s = input.stats;
  const native = s.sportStats || {};
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

  return {
    pace: touchdowns > 0 || yards >= 80 ? ratingBoost : 0,
    shooting: passingTouchdowns > 0 || fieldGoals > 0 ? ratingBoost : 0,
    passing: s.assists > 0 || passingTouchdowns > 0 || s.passes >= 3 ? ratingBoost : 0,
    dribbling: yards >= 60 || s.shots >= 2 ? ratingBoost : 0,
    defending: turnovers > 0 || s.tackles >= 3 ? ratingBoost : 0,
    physical: s.tackles >= 2 || s.shots >= 2 || yards >= 50 ? ratingBoost : 0,
    fatigueGain,
    moraleDelta,
    formDelta,
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

    const growth = calculateGrowth(player);
    const current = await tx.player.findUnique({ where: { id: player.playerId } });
    if (!current) continue;

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
      lastProgression: {
        matchId: input.matchId,
        rating: s.rating,
        deltas: growth,
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
        attributes,
      },
    });
  }
}
