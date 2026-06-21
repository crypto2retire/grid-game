import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import { calculatePlayerPrice } from '../economy/marketplace.routes';
import { recordCurrencyLedger, legacyAttributesFromPlayer } from '../economy/ledger';
import { getSportConfig, SportId } from '../sports/sports.config';

const router = Router();

const createTeamSchema = z.object({
  name: z.string().min(1).max(50),
  sportId: z.enum(['american-football', 'soccer', 'basketball', 'baseball']).default('american-football'),
  formation: z.string().default('11v11'),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  formation: z.string().optional(),
  style: z.string().optional(),
  pressing: z.string().optional(),
  mentality: z.string().optional(),
});

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const input = createTeamSchema.parse(req.body);
    const userId = req.user!.id;

    const teamCount = await prisma.team.count({ where: { ownerId: userId } });
    if (teamCount >= 3) {
      throw new AppError(400, 'Maximum team limit reached (3)');
    }

    // Ensure default leagues exist for this sport
    const defaultLeague = await prisma.league.upsert({
      where: { id: 'local-rec-football' },
      update: {},
      create: {
        id: 'local-rec-football',
        sportId: input.sportId,
        name: 'Local Rec Football League',
        tier: 'LOCAL_REC',
        level: 1,
      },
    });

    const team = await prisma.$transaction(async (tx: any) => {
      const newTeam = await tx.team.create({
        data: {
          name: input.name,
          sportId: input.sportId,
          formation: input.formation,
          tactics: { formation: input.formation, sportId: input.sportId },
          ownerId: userId,
        },
      });

      // Create starter venue
      await tx.venue.create({
        data: {
          teamId: newTeam.id,
          sportId: input.sportId,
          name: `${input.name} Community Field`,
          tier: 'PARK_FIELD',
          capacity: 250,
          ticketPrice: 8,
          condition: 70,
          prestige: 10,
        },
      });

      // Create starter transportation
      await tx.transportationAsset.create({
        data: {
          teamId: newTeam.id,
          tier: 'CARPOOL',
          name: 'Carpool / Rental Vans',
          operatingCost: 100,
          fatigueReduction: 0,
          prestige: 0,
        },
      });

      // Attach to local rec league
      await tx.teamLeagueMembership.create({
        data: {
          teamId: newTeam.id,
          leagueId: defaultLeague.id,
          season: 'beta',
          status: 'ACTIVE',
        },
      });

      return newTeam;
    });

    const fullTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        teamPlayers: { include: { player: true } },
        venue: true,
        transportationAssets: true,
        leagueMemberships: { include: { league: true } },
      },
    });

    res.status(201).json({ status: 'success', data: fullTeam });
  })
);

router.get(
  '/mine',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teams = await prisma.team.findMany({
      where: { ownerId: req.user!.id },
      include: {
        teamPlayers: { include: { player: true } },
        venue: true,
        transportationAssets: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: teams });
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true },
        },
        teamPlayers: {
          include: { player: true },
          orderBy: { player: { position: 'asc' } },
        },
        venue: true,
        transportationAssets: true,
        leagueMemberships: { include: { league: true } },
        matchesHome: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            homeScore: true,
            awayScore: true,
            completedAt: true,
            awayTeam: { select: { name: true } },
          },
        },
        matchesAway: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            homeScore: true,
            awayScore: true,
            completedAt: true,
            homeTeam: { select: { name: true } },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(404, 'Team not found');
    }

    res.json({ status: 'success', data: team });
  })
);

router.put(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const input = updateTeamSchema.parse(req.body);
    const userId = req.user!.id;
    const teamId = routeParam(req.params.id, 'id');

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });

    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: input,
      include: {
        teamPlayers: {
          include: { player: true },
        },
      },
    });

    res.json({ status: 'success', data: updated });
  })
);

router.post(
  '/:id/players',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      playerId: z.string().uuid(),
      isStarter: z.boolean().default(false),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;
    const teamId = routeParam(req.params.id, 'id');

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
      include: { teamPlayers: true },
    });

    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const playerCount = team.teamPlayers.length;
    const sportConfig = getSportConfig(team.sportId as SportId);
    if (playerCount >= sportConfig.roster.maxRoster) {
      throw new AppError(400, `Maximum ${sportConfig.label} roster size reached (${sportConfig.roster.maxRoster})`);
    }

    const existing = await prisma.teamPlayer.findUnique({
      where: {
        teamId_playerId: {
          teamId,
          playerId: input.playerId,
        },
      },
    });

    if (existing) {
      throw new AppError(409, 'Player already in team');
    }

    // Charge CASH for acquiring the player based on dynamic price
    const player = await prisma.player.findUnique({ where: { id: input.playerId } });
    if (!player) {
      throw new AppError(404, 'Player not found');
    }
    const price = calculatePlayerPrice(player);
    if (player.sportId !== team.sportId) {
      throw new AppError(400, `This player belongs to ${player.sportId}, but this team is ${team.sportId}`);
    }
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.cash < price) {
      throw new AppError(400, `Insufficient CASH. This player costs ${price.toLocaleString()} CASH`);
    }

    await prisma.$transaction(async (tx: any) => {
      const walletAfter = await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: price } },
      });
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -price,
        balanceAfter: walletAfter.cash,
        reason: 'PLAYER_HIRE',
        sourceType: 'TEAM_PLAYER',
        sourceId: input.playerId,
        metadata: { teamId, playerId: input.playerId, sportId: team.sportId },
      });
      await tx.player.update({
        where: { id: input.playerId },
        data: { attributes: legacyAttributesFromPlayer(player) },
      });
      await tx.teamPlayer.create({
        data: {
          teamId,
          playerId: input.playerId,
          isStarter: input.isStarter,
        },
      });
    });

    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: { teamId, playerId: input.playerId },
      include: { player: true },
    });

    res.status(201).json({ status: 'success', data: teamPlayer });
  })
);

router.delete(
  '/:id/players/:playerId',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const teamId = routeParam(req.params.id, 'id');
    const playerId = routeParam(req.params.playerId, 'playerId');

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });

    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    await prisma.teamPlayer.delete({
      where: {
        teamId_playerId: {
          teamId,
          playerId,
        },
      },
    });

    res.json({ status: 'success', message: 'Player removed from team' });
  })
);

export const teamRouter = router;
