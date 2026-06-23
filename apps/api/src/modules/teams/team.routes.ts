import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import { calculatePlayerPrice } from '../economy/marketplace.routes';
import { recordCurrencyLedger, legacyAttributesFromPlayer } from '../economy/ledger';
import { getSportConfig, SportId } from '../sports/sports.config';
import { generateAndCreatePlayerTx } from '../players/player.generator';

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

      // Generate a replacement player to keep the pool at 200
      await generateAndCreatePlayerTx(tx, {
        sportId: team.sportId,
        position: player.position, // Same position as the hired player for balance
      });
    });

    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: { teamId, playerId: input.playerId },
      include: { player: true },
    });

    // Get the newly generated replacement player
    const replacementPlayer = await prisma.player.findFirst({
      where: {
        sportId: team.sportId,
        teamPlayers: { none: {} }, // Not on any team
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(201).json({
      status: 'success',
      data: {
        hired: teamPlayer,
        replacement: replacementPlayer,
        message: 'Player hired. A new prospect has been added to the pool.',
      },
    });
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

router.post(
  '/:id/venue',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;
    const schema = z.object({
      name: z.string().min(1).max(100),
      tier: z.enum(['PARK_FIELD', 'COMMUNITY', 'SMALL_STADIUM', 'REGIONAL', 'PRO', 'ELITE']),
      capacity: z.number().int().positive(),
      ticketPrice: z.number().int().positive(),
      cost: z.number().int().positive(),
    });
    const input = schema.parse(req.body);

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
      include: { venue: true },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }
    if (wallet.cash < input.cost) {
      throw new AppError(400, `Insufficient CASH. Need ${input.cost.toLocaleString()} CASH`);
    }

    const prestigeMap: Record<string, number> = {
      PARK_FIELD: 10, COMMUNITY: 25, SMALL_STADIUM: 40, REGIONAL: 50, PRO: 65, ELITE: 85,
    };

    await prisma.$transaction(async (tx: any) => {
      // Delete old venue if exists
      if (team.venue) {
        await tx.venue.delete({ where: { id: team.venue.id } });
      }
      // Create new venue
      await tx.venue.create({
        data: {
          teamId: team.id,
          sportId: team.sportId,
          name: input.name,
          tier: input.tier,
          capacity: input.capacity,
          ticketPrice: input.ticketPrice,
          condition: 100,
          prestige: prestigeMap[input.tier] || 10,
        },
      });
      // Deduct cash from buyer
      await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: input.cost } },
      });
      // Credit game owner (infrastructure revenue)
      const gameOwnerId = env.GAME_OWNER_USER_ID;
      const gameOwnerWallet = await tx.wallet.findUnique({ where: { userId: gameOwnerId } });
      if (gameOwnerWallet) {
        await tx.wallet.update({
          where: { userId: gameOwnerId },
          data: { cash: { increment: input.cost } },
        });
      }
      // Record ledger
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -input.cost,
        balanceAfter: wallet.cash - input.cost,
        reason: 'STADIUM_UPGRADE',
        sourceType: 'VENUE_PURCHASE',
        sourceId: teamId,
        metadata: { tier: input.tier, capacity: input.capacity },
      });
    });

    res.json({ status: 'success', message: `Purchased ${input.name}` });
  })
);

router.post(
  '/:id/transportation',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;
    const schema = z.object({
      name: z.string().min(1).max(100),
      tier: z.enum(['CARPOOL', 'BUS', 'CHARTER', 'LUXURY']),
      operatingCost: z.number().int().positive(),
      fatigueReduction: z.number().int().min(0).max(100),
      prestige: z.number().int().min(0),
      cost: z.number().int().positive(),
    });
    const input = schema.parse(req.body);

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }
    if (wallet.cash < input.cost) {
      throw new AppError(400, `Insufficient CASH. Need ${input.cost.toLocaleString()} CASH`);
    }

    await prisma.$transaction(async (tx: any) => {
      // Delete old transportation
      await tx.transportationAsset.deleteMany({ where: { teamId: team.id } });
      // Create new
      await tx.transportationAsset.create({
        data: {
          teamId: team.id,
          tier: input.tier,
          name: input.name,
          operatingCost: input.operatingCost,
          fatigueReduction: input.fatigueReduction,
          prestige: input.prestige,
        },
      });
      // Deduct cash from buyer
      await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: input.cost } },
      });
      // Credit game owner (infrastructure revenue)
      const gameOwnerId = env.GAME_OWNER_USER_ID;
      const gameOwnerWallet = await tx.wallet.findUnique({ where: { userId: gameOwnerId } });
      if (gameOwnerWallet) {
        await tx.wallet.update({
          where: { userId: gameOwnerId },
          data: { cash: { increment: input.cost } },
        });
      }
      // Record ledger
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -input.cost,
        balanceAfter: wallet.cash - input.cost,
        reason: 'TRANSPORTATION_PURCHASE',
        sourceType: 'TRANSPORT_PURCHASE',
        sourceId: teamId,
        metadata: { tier: input.tier, name: input.name },
      });
    });

    res.json({ status: 'success', message: `Purchased ${input.name}` });
  })
);

// ─── Asset Purchase (One-Time) ───

// GET /api/teams/assets/marketplace — list AI-owned venues & transportation for sale
router.get(
  '/assets/marketplace',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const venues = await prisma.venue.findMany({
      where: { ownerId: env.GAME_OWNER_USER_ID || 'ai-system-owner-001', purchasePrice: { not: null } },
      include: { team: { select: { id: true, name: true, tier: true } } },
      orderBy: { purchasePrice: 'asc' },
    });

    const transportation = await prisma.transportationAsset.findMany({
      where: { ownerId: env.GAME_OWNER_USER_ID || 'ai-system-owner-001', purchasePrice: { not: null } },
      include: { team: { select: { id: true, name: true, tier: true } } },
      orderBy: { purchasePrice: 'asc' },
    });

    res.json({
      status: 'success',
      data: { venues, transportation },
    });
  })
);

// POST /api/teams/:id/venue/buy — buy the team's venue outright
router.post(
  '/:id/venue/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
      include: { venue: true },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }
    if (!team.venue) {
      throw new AppError(404, 'No venue assigned to this team');
    }
    if (!team.venue.purchasePrice) {
      throw new AppError(400, 'This venue is not available for purchase');
    }
    if (team.venue.ownerId === userId) {
      throw new AppError(400, 'You already own this venue');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }
    if (wallet.cash < team.venue.purchasePrice) {
      throw new AppError(400, `Insufficient CASH. Need ${team.venue.purchasePrice.toLocaleString()} CASH`);
    }

    const price = team.venue.purchasePrice;

    await prisma.$transaction(async (tx: any) => {
      // Transfer ownership
      await tx.venue.update({
        where: { id: team.venue!.id },
        data: { ownerId: userId, leaseRate: 0 }, // No lease fee when you own it
      });
      // Deduct cash from buyer
      await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: price } },
      });
      // Credit game owner
      const gameOwnerId = env.GAME_OWNER_USER_ID;
      const gameOwnerWallet = await tx.wallet.findUnique({ where: { userId: gameOwnerId } });
      if (gameOwnerWallet) {
        await tx.wallet.update({
          where: { userId: gameOwnerId },
          data: { cash: { increment: price } },
        });
      }
      // Record ledger
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -price,
        balanceAfter: wallet.cash - price,
        reason: 'VENUE_PURCHASE',
        sourceType: 'VENUE_BUY',
        sourceId: team.venue!.id,
        metadata: { tier: team.venue!.tier, name: team.venue!.name, price },
      });
    });

    res.json({ status: 'success', message: `You now own ${team.venue.name}` });
  })
);

// POST /api/teams/:id/transportation/buy — buy the team's transportation outright
router.post(
  '/:id/transportation/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
      include: { transportationAssets: true },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }
    const transport = team.transportationAssets[0];
    if (!transport) {
      throw new AppError(404, 'No transportation assigned to this team');
    }
    if (!transport.purchasePrice) {
      throw new AppError(400, 'This transportation is not available for purchase');
    }
    if (transport.ownerId === userId) {
      throw new AppError(400, 'You already own this transportation');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }
    if (wallet.cash < transport.purchasePrice) {
      throw new AppError(400, `Insufficient CASH. Need ${transport.purchasePrice.toLocaleString()} CASH`);
    }

    const price = transport.purchasePrice;

    await prisma.$transaction(async (tx: any) => {
      // Transfer ownership
      await tx.transportationAsset.update({
        where: { id: transport.id },
        data: { ownerId: userId },
      });
      // Deduct cash from buyer
      await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: price } },
      });
      // Credit game owner
      const gameOwnerId = env.GAME_OWNER_USER_ID;
      const gameOwnerWallet = await tx.wallet.findUnique({ where: { userId: gameOwnerId } });
      if (gameOwnerWallet) {
        await tx.wallet.update({
          where: { userId: gameOwnerId },
          data: { cash: { increment: price } },
        });
      }
      // Record ledger
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -price,
        balanceAfter: wallet.cash - price,
        reason: 'TRANSPORTATION_PURCHASE',
        sourceType: 'TRANSPORT_BUY',
        sourceId: transport.id,
        metadata: { tier: transport.tier, name: transport.name, price },
      });
    });

    res.json({ status: 'success', message: `You now own ${transport.name}` });
  })
);

export const teamRouter = router;
