import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { generateMatchSeed, generateSeedHash } from '../../utils/rng';
import { runMatchSimulation, TeamState } from './simulator';
import { routeParam } from '../../utils/routeParams';
import { recordCurrencyLedger, legacyAttributesFromPlayer } from '../economy/ledger';
import { applyPostGameProgression } from './progression';

const router = Router();

const scheduleMatchSchema = z.object({
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
});

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const input = scheduleMatchSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify home team ownership
    const homeTeam = await prisma.team.findFirst({
      where: { id: input.homeTeamId, ownerId: userId },
      include: { teamPlayers: { include: { player: true } } },
    });

    if (!homeTeam) {
      throw new AppError(403, 'You do not own the home team');
    }

    const awayTeam = await prisma.team.findUnique({
      where: { id: input.awayTeamId },
      include: { teamPlayers: { include: { player: true } } },
    });

    if (!awayTeam) {
      throw new AppError(404, 'Away team not found');
    }

    if (homeTeam.id === awayTeam.id) {
      throw new AppError(400, 'Cannot schedule match against yourself');
    }

    if (homeTeam.sportId !== awayTeam.sportId) {
      throw new AppError(400, `Cannot schedule cross-sport match: ${homeTeam.sportId} vs ${awayTeam.sportId}`);
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date(Date.now() + 60000);
    const seed = generateMatchSeed(
      crypto.randomUUID(),
      scheduledAt.toISOString(),
      homeTeam.teamPlayers.map((tp: any) => tp.player.id).sort().join(''),
      awayTeam.teamPlayers.map((tp: any) => tp.player.id).sort().join(''),
      process.env.DAILY_SALT || 'default-salt'
    );
    const seedHash = generateSeedHash(seed);

    const match = await prisma.match.create({
      data: {
        sportId: homeTeam.sportId,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        scheduledAt,
        seed,
        seedHash,
        homeTactics: {
          formation: homeTeam.formation,
          style: homeTeam.style,
          pressing: homeTeam.pressing,
          mentality: homeTeam.mentality,
        },
        awayTactics: {
          formation: awayTeam.formation,
          style: awayTeam.style,
          pressing: awayTeam.pressing,
          mentality: awayTeam.mentality,
        },
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      status: 'success',
      data: { match, seedHash },
    });
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const matchId = routeParam(req.params.id, 'id');
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            formation: true,
            wins: true,
            draws: true,
            losses: true,
            points: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            formation: true,
            wins: true,
            draws: true,
            losses: true,
            points: true,
          },
        },
        events: {
          orderBy: { tick: 'asc' },
        },
        playerStats: {
          include: { player: { select: { id: true, name: true, position: true } } },
        },
      },
    });

    if (!match) {
      throw new AppError(404, 'Match not found');
    }

    res.json({ status: 'success', data: match });
  })
);

router.post(
  '/:id/simulate',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const matchId = routeParam(req.params.id, 'id');
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { include: { teamPlayers: { include: { player: true } } } },
        awayTeam: { include: { teamPlayers: { include: { player: true } } } },
      },
    }) as any;

    if (!match) {
      throw new AppError(404, 'Match not found');
    }

    if (match.status !== 'SCHEDULED') {
      throw new AppError(400, 'Match has already been simulated');
    }

    // Build team states for simulation
    const buildTeamState = (team: typeof match.homeTeam): TeamState => ({
      teamId: team.id,
      name: team.name,
      players: team.teamPlayers.map((tp: any) => {
        const attributes = legacyAttributesFromPlayer(tp.player);
        return {
        playerId: tp.player.id,
        name: tp.player.name,
        position: tp.player.position,
        stats: {
          pace: attributes.speed,
          shooting: attributes.arm,
          passing: attributes.footballIQ,
          dribbling: attributes.agility,
          defending: attributes.tackling,
          physical: attributes.strength,
          goalkeeping: tp.player.goalkeeping || 0,
        },
        condition: 100 - tp.player.fatigue,
        morale: tp.player.morale,
        isActive: tp.isStarter,
      };
      }),
      formation: team.formation,
      style: 'balanced',
      pressing: 'medium',
      mentality: 'balanced',
      morale: 50,
      fatigue: 0,
      possession: 0,
    });

    const homeState = buildTeamState(match.homeTeam);
    const awayState = buildTeamState(match.awayTeam);

    const result = await runMatchSimulation(match.sportId, match.id, match.seed!, homeState, awayState);

    // Update match with results
    await prisma.$transaction(async (tx: any) => {
      await tx.match.update({
        where: { id: match.id },
        data: {
          status: 'COMPLETED',
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          startedAt: new Date(),
          completedAt: new Date(),
          metadata: result.metadata || {},
        },
      });

      // Create events
      await tx.matchEvent.createMany({
        data: result.events.map(e => ({
          matchId: match.id,
          timestamp: e.timestamp,
          tick: e.tick,
          type: e.type,
          actorId: e.actorId,
          targetId: e.targetId,
          metadata: e.metadata || {},
        })),
      });

      // Create player stats
      await tx.playerMatchStats.createMany({
        data: Object.entries(result.playerStats).map(([playerId, stats]) => ({
          matchId: match.id,
          playerId,
          teamId: match.homeTeam.teamPlayers.some((tp: any) => tp.player.id === playerId)
            ? match.homeTeamId
            : match.awayTeamId,
          goals: stats.goals,
          assists: stats.assists,
          shots: stats.shots,
          shotsOnTarget: stats.shotsOnTarget,
          passes: stats.passes,
          tackles: stats.tackles,
          saves: stats.saves,
          rating: stats.rating,
          stats: {
            ...stats.sportStats,
            touchdowns: stats.sportStats?.touchdowns ?? stats.goals,
            assists: stats.assists,
            plays: stats.sportStats?.plays ?? stats.shots,
            onTarget: stats.shotsOnTarget,
            passes: stats.passes,
            tackles: stats.tackles,
            stops: stats.sportStats?.stops ?? stats.saves,
            rating: stats.rating,
            sportId: result.sportId,
            legacy: {
              goals: stats.goals,
              assists: stats.assists,
              shots: stats.shots,
              shotsOnTarget: stats.shotsOnTarget,
              passes: stats.passes,
              tackles: stats.tackles,
              saves: stats.saves,
              rating: stats.rating,
            },
          },
        })),
      });

      await applyPostGameProgression(tx, {
        sportId: match.sportId,
        season: 'beta',
        matchId: match.id,
        players: Object.entries(result.playerStats).map(([playerId, stats]) => ({
          playerId,
          teamId: match.homeTeam.teamPlayers.some((tp: any) => tp.player.id === playerId)
            ? match.homeTeamId
            : match.awayTeamId,
          position: [
            ...match.homeTeam.teamPlayers,
            ...match.awayTeam.teamPlayers,
          ].find((tp: any) => tp.player.id === playerId)?.player.position,
          stats,
        })),
      });

      // Update team records
      const homeWon = result.homeScore > result.awayScore;
      const awayWon = result.awayScore > result.homeScore;
      const draw = result.homeScore === result.awayScore;

      await tx.team.update({
        where: { id: match.homeTeamId },
        data: {
          wins: { increment: homeWon ? 1 : 0 },
          draws: { increment: draw ? 1 : 0 },
          losses: { increment: awayWon ? 1 : 0 },
          goalsFor: { increment: result.homeScore },
          goalsAgainst: { increment: result.awayScore },
          points: { increment: homeWon ? 3 : draw ? 1 : 0 },
        },
      });

      await tx.team.update({
        where: { id: match.awayTeamId },
        data: {
          wins: { increment: awayWon ? 1 : 0 },
          draws: { increment: draw ? 1 : 0 },
          losses: { increment: homeWon ? 1 : 0 },
          goalsFor: { increment: result.awayScore },
          goalsAgainst: { increment: result.homeScore },
          points: { increment: awayWon ? 3 : draw ? 1 : 0 },
        },
      });

      // Distribute rewards
      const homeReward = homeWon ? 5000 : draw ? 2000 : 1000;
      const awayReward = awayWon ? 5000 : draw ? 2000 : 1000;

      const homeWalletAfter = await tx.wallet.update({
        where: { userId: match.homeTeam.ownerId },
        data: { cash: { increment: homeReward } },
      });
      await recordCurrencyLedger(tx, {
        userId: match.homeTeam.ownerId,
        currency: 'CASH',
        amount: homeReward,
        balanceAfter: homeWalletAfter.cash,
        reason: homeWon ? 'MATCH_WIN_REWARD' : draw ? 'MATCH_DRAW_REWARD' : 'MATCH_PARTICIPATION_REWARD',
        sourceType: 'MATCH',
        sourceId: match.id,
        metadata: { teamId: match.homeTeamId, side: 'HOME', sportId: match.sportId },
      });

      const awayWalletAfter = await tx.wallet.update({
        where: { userId: match.awayTeam.ownerId },
        data: { cash: { increment: awayReward } },
      });
      await recordCurrencyLedger(tx, {
        userId: match.awayTeam.ownerId,
        currency: 'CASH',
        amount: awayReward,
        balanceAfter: awayWalletAfter.cash,
        reason: awayWon ? 'MATCH_WIN_REWARD' : draw ? 'MATCH_DRAW_REWARD' : 'MATCH_PARTICIPATION_REWARD',
        sourceType: 'MATCH',
        sourceId: match.id,
        metadata: { teamId: match.awayTeamId, side: 'AWAY', sportId: match.sportId },
      });
    });

    res.json({
      status: 'success',
      data: {
        result: {
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          events: result.events.length,
        },
      },
    });
  })
);

export const matchRouter = router;
