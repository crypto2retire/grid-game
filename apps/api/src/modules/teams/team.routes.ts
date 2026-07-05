import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { tokenGate } from '../../middleware/tokenGate';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import { calculatePlayerPrice } from '../economy/marketplace.routes';
import { legacyAttributesFromPlayer } from '../economy/ledger';
import { creditCurrency, debitCurrency, processCurrencySink, settleMarketplaceSale } from '../economy/currency.service';
import { getSportConfig, SportId } from '../sports/sports.config';
import { generateAndCreatePlayerTx } from '../players/player.generator';
import { generateAIPlayers } from '../ai-teams/ai-teams.service';

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
  tokenGate,
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
          ownerId: userId, // Player owns their stadium from day one
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
          ownerId: userId, // Player owns their transport from day one
          tier: 'CARPOOL',
          name: 'Carpool / Rental Vans',
          operatingCost: 100,
          fatigueReduction: 0,
          prestige: 0,
          condition: 70,
          speed: 1,
          capacity: 12,
          upgradeCount: 0,
          maxUpgrade: 5,
          tripsTaken: 0,
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

    // Generate starter roster of 43 players for new user team
    await generateAIPlayers(team.id);

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
        teamPlayers: { include: { player: { include: { playerItems: { include: { item: true } } } } } },
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
      await debitCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: price,
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
      // Unlink old venue (preserve it for other teams or dev use)
      if (team.venue) {
        await tx.venue.update({
          where: { id: team.venue.id },
          data: { teamId: null }, // Old stadium becomes available
        });
      }
      // Create new venue
      const createdVenue = await tx.venue.create({
        data: {
          teamId: team.id,
          ownerId: userId, // Stadium stays with the player
          sportId: team.sportId,
          name: input.name,
          tier: input.tier,
          capacity: input.capacity,
          ticketPrice: input.ticketPrice,
          condition: 100,
          prestige: prestigeMap[input.tier] || 10,
        },
      });

      await debitCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: input.cost,
        reason: 'STADIUM_UPGRADE',
        sourceType: 'VENUE_PURCHASE',
        sourceId: createdVenue.id,
        metadata: { teamId, tier: input.tier, capacity: input.capacity, name: input.name },
      });

      // Infrastructure sale proceeds go to game owner wallet when configured;
      // otherwise they are a platform sink/treasury inflow.
      const gameOwnerId = env.GAME_OWNER_USER_ID;
      const gameOwnerWallet = gameOwnerId ? await tx.wallet.findUnique({ where: { userId: gameOwnerId } }) : null;
      if (gameOwnerId && gameOwnerWallet) {
        await creditCurrency(tx, {
          userId: gameOwnerId,
          currency: 'CASH',
          amount: input.cost,
          reason: 'STADIUM_UPGRADE_REVENUE',
          sourceType: 'VENUE_PURCHASE',
          sourceId: createdVenue.id,
          metadata: { buyerId: userId, teamId, tier: input.tier, capacity: input.capacity, name: input.name },
        });
      } else {
        await processCurrencySink(tx, 'CASH', input.cost, 'STADIUM_UPGRADE', 'VENUE_PURCHASE', createdVenue.id, {
          buyerId: userId,
          teamId,
          tier: input.tier,
          capacity: input.capacity,
          name: input.name,
        });
      }
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
      // Unlink old transportation (preserve it for other teams or dev use)
      await tx.transportationAsset.updateMany({
        where: { teamId: team.id },
        data: { teamId: null },
      });
      // Create new
      const createdTransport = await tx.transportationAsset.create({
        data: {
          teamId: team.id,
          ownerId: userId, // Transport stays with the player
          tier: input.tier,
          name: input.name,
          operatingCost: input.operatingCost,
          fatigueReduction: input.fatigueReduction,
          prestige: input.prestige,
          condition: 70,
          speed: 1,
          capacity: 12,
          upgradeCount: 0,
          maxUpgrade: 5,
          tripsTaken: 0,
        },
      });

      await debitCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: input.cost,
        reason: 'TRANSPORTATION_PURCHASE',
        sourceType: 'TRANSPORT_PURCHASE',
        sourceId: createdTransport.id,
        metadata: { teamId, tier: input.tier, name: input.name },
      });

      // Infrastructure sale proceeds go to game owner wallet when configured;
      // otherwise they are a platform sink/treasury inflow.
      const gameOwnerId = env.GAME_OWNER_USER_ID;
      const gameOwnerWallet = gameOwnerId ? await tx.wallet.findUnique({ where: { userId: gameOwnerId } }) : null;
      if (gameOwnerId && gameOwnerWallet) {
        await creditCurrency(tx, {
          userId: gameOwnerId,
          currency: 'CASH',
          amount: input.cost,
          reason: 'TRANSPORTATION_PURCHASE_REVENUE',
          sourceType: 'TRANSPORT_PURCHASE',
          sourceId: createdTransport.id,
          metadata: { buyerId: userId, teamId, tier: input.tier, name: input.name },
        });
      } else {
        await processCurrencySink(tx, 'CASH', input.cost, 'TRANSPORTATION_PURCHASE', 'TRANSPORT_PURCHASE', createdTransport.id, {
          buyerId: userId,
          teamId,
          tier: input.tier,
          name: input.name,
        });
      }
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
    const currency = (req.body.currency || 'CASH') as 'CASH' | 'SOL';

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

    const price = currency === 'SOL' ? (team.venue.solPrice || 0) : team.venue.purchasePrice;

    if (currency === 'CASH') {
      if (wallet.cash < price) {
        throw new AppError(400, `Insufficient CASH. Need ${price.toLocaleString()} CASH`);
      }
    } else {
      if ((wallet.solBalance || 0) < price) {
        throw new AppError(400, `Insufficient SOL. Need ${price} SOL`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      // Transfer ownership
      await tx.venue.update({
        where: { id: team.venue!.id },
        data: { ownerId: userId, leaseRate: 0 },
      });

      await debitCurrency(tx, {
        userId,
        currency,
        amount: price,
        reason: currency === 'SOL' ? 'VENUE_PURCHASE_SOL' : 'VENUE_PURCHASE',
        sourceType: 'VENUE_BUY',
        sourceId: team.venue!.id,
        metadata: { tier: team.venue!.tier, name: team.venue!.name, price, currency, sellerId: team.venue!.ownerId },
      });

      if (currency === 'CASH') {
        const sellerId = team.venue!.ownerId || env.GAME_OWNER_USER_ID;
        const sellerWallet = sellerId ? await tx.wallet.findUnique({ where: { userId: sellerId } }) : null;
        if (sellerId && sellerWallet) {
          await creditCurrency(tx, {
            userId: sellerId,
            currency: 'CASH',
            amount: price,
            reason: 'VENUE_PURCHASE_REVENUE',
            sourceType: 'VENUE_BUY',
            sourceId: team.venue!.id,
            metadata: { buyerId: userId, tier: team.venue!.tier, name: team.venue!.name, price },
          });
        } else {
          await processCurrencySink(tx, 'CASH', price, 'VENUE_PURCHASE', 'VENUE_BUY', team.venue!.id, {
            buyerId: userId,
            tier: team.venue!.tier,
            name: team.venue!.name,
            price,
          });
        }
      } else {
        await processCurrencySink(tx, 'SOL', price, 'VENUE_PURCHASE_SOL', 'VENUE_BUY', team.venue!.id, {
          buyerId: userId,
          tier: team.venue!.tier,
          name: team.venue!.name,
          price,
        });
      }
    });

    res.json({ status: 'success', message: `You now own ${team.venue.name} (${currency})` });
  })
);

// POST /api/teams/:id/transportation/buy — buy the team's transportation outright
router.post(
  '/:id/transportation/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;
    const currency = (req.body.currency || 'CASH') as 'CASH' | 'SOL';

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

    const price = currency === 'SOL' ? (transport.solPrice || 0) : transport.purchasePrice;

    if (currency === 'CASH') {
      if (wallet.cash < price) {
        throw new AppError(400, `Insufficient CASH. Need ${price.toLocaleString()} CASH`);
      }
    } else {
      if ((wallet.solBalance || 0) < price) {
        throw new AppError(400, `Insufficient SOL. Need ${price} SOL`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      // Transfer ownership
      await tx.transportationAsset.update({
        where: { id: transport.id },
        data: { ownerId: userId },
      });

      await debitCurrency(tx, {
        userId,
        currency,
        amount: price,
        reason: currency === 'SOL' ? 'TRANSPORT_PURCHASE_SOL' : 'TRANSPORTATION_PURCHASE',
        sourceType: 'TRANSPORT_BUY',
        sourceId: transport.id,
        metadata: { tier: transport.tier, name: transport.name, price, currency, sellerId: transport.ownerId },
      });

      if (currency === 'CASH') {
        const sellerId = transport.ownerId || env.GAME_OWNER_USER_ID;
        const sellerWallet = sellerId ? await tx.wallet.findUnique({ where: { userId: sellerId } }) : null;
        if (sellerId && sellerWallet) {
          await creditCurrency(tx, {
            userId: sellerId,
            currency: 'CASH',
            amount: price,
            reason: 'TRANSPORTATION_PURCHASE_REVENUE',
            sourceType: 'TRANSPORT_BUY',
            sourceId: transport.id,
            metadata: { buyerId: userId, tier: transport.tier, name: transport.name, price },
          });
        } else {
          await processCurrencySink(tx, 'CASH', price, 'TRANSPORTATION_PURCHASE', 'TRANSPORT_BUY', transport.id, {
            buyerId: userId,
            tier: transport.tier,
            name: transport.name,
            price,
          });
        }
      } else {
        await processCurrencySink(tx, 'SOL', price, 'TRANSPORT_PURCHASE_SOL', 'TRANSPORT_BUY', transport.id, {
          buyerId: userId,
          tier: transport.tier,
          name: transport.name,
          price,
        });
      }
    });

    res.json({ status: 'success', message: `You now own this transportation (${currency})` });
  })
);

// POST /api/teams/transportation/:transportId/upgrade
// POST /api/teams/:id/transportation/:transportId/upgrade
router.post(
  ['/transportation/:transportId/upgrade', '/:id/transportation/:transportId/upgrade'],
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const transportId = routeParam(req.params.transportId, 'transportId');
    const teamId = req.params.id ? routeParam(req.params.id, 'id') : undefined;

    const transport = await prisma.transportationAsset.findFirst({
      where: { id: transportId, ownerId: userId, ...(teamId ? { teamId } : {}) },
    });
    if (!transport) {
      throw new AppError(403, 'You do not own this transportation');
    }
    if ((transport.upgradeCount || 0) >= (transport.maxUpgrade || 5)) {
      throw new AppError(400, 'This vehicle is already fully upgraded');
    }

    const upgradeCost = Math.floor(transport.operatingCost * 2 * ((transport.upgradeCount || 0) + 1));

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }
    if (wallet.cash < upgradeCost) {
      throw new AppError(400, `Insufficient CASH. Need ${upgradeCost.toLocaleString()} CASH`);
    }

    const nextUpgradeCount = (transport.upgradeCount || 0) + 1;
    const nextCondition = Math.min((transport.condition || 70) + 10, 100);
    const nextFatigueReduction = Math.min((transport.fatigueReduction || 0) + 1, 10);
    const nextPrestige = (transport.prestige || 0) + 1;
    const nextSpeed = Math.min((transport.speed || 1) + 0.5, 10);
    const nextTripsTaken = (transport.tripsTaken || 0) + 1;

    const updated = await prisma.$transaction(async (tx: any) => {
      await debitCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: upgradeCost,
        reason: 'TRANSPORT_UPGRADE',
        sourceType: 'TRANSPORT_UPGRADE',
        sourceId: transport.id,
        metadata: {
          tier: transport.tier,
          name: transport.name,
          upgradeCount: nextUpgradeCount,
          cost: upgradeCost,
        },
      });

      return tx.transportationAsset.update({
        where: { id: transport.id },
        data: {
          upgradeCount: nextUpgradeCount,
          condition: nextCondition,
          fatigueReduction: nextFatigueReduction,
          prestige: nextPrestige,
          speed: nextSpeed,
          tripsTaken: nextTripsTaken,
        },
      });
    });

    res.json({ status: 'success', data: updated, message: `${updated.name} upgraded for ${upgradeCost.toLocaleString()} CASH` });
  })
);

// POST /api/teams/:id/backfill-players — generate starter roster for teams with 0 players
router.post(
  '/:id/backfill-players',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const teamId = routeParam(req.params.id, 'id');

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
      include: { teamPlayers: true },
    });

    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    if (team.teamPlayers.length > 0) {
      throw new AppError(400, `Team already has ${team.teamPlayers.length} players. Backfill only works for empty rosters.`);
    }

    await generateAIPlayers(team.id);

    const fullTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        teamPlayers: { include: { player: true } },
        venue: true,
        transportationAssets: true,
      },
    });

    res.json({ status: 'success', data: fullTeam, message: `Generated ${fullTeam?.teamPlayers?.length || 0} players for ${team.name}` });
  })
);

// ─── Available Venues (for dev team creation) ───

router.get(
  '/venues/available',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const venues = await prisma.venue.findMany({
      where: { ownerId: userId, teamId: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: venues });
  })
);

// ─── Development Team Creation ───

router.post(
  '/dev',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const schema = z.object({
      venueId: z.string().uuid(),
      name: z.string().min(1).max(50),
    });
    const input = schema.parse(req.body);

    const teamCount = await prisma.team.count({ where: { ownerId: userId } });
    if (teamCount >= 3) {
      throw new AppError(400, 'Maximum team limit reached (3)');
    }

    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, ownerId: userId, teamId: null },
    });
    if (!venue) {
      throw new AppError(400, 'Venue not found, not owned by you, or already in use');
    }

    const team = await prisma.$transaction(async (tx: any) => {
      const newTeam = await tx.team.create({
        data: {
          name: input.name,
          sportId: venue.sportId,
          ownerId: userId,
          tier: 'STATE_COLLEGE',
          isFree: true,
          purchasePrice: 0,
          purchaseCurrency: 'FREE',
          formation: '4-3-3',
          tactics: { formation: '4-3-3', sportId: venue.sportId },
        },
      });

      await tx.venue.update({
        where: { id: venue.id },
        data: { teamId: newTeam.id },
      });

      await tx.transportationAsset.create({
        data: {
          teamId: newTeam.id,
          ownerId: userId,
          tier: 'CARPOOL',
          name: 'Carpool / Rental Vans',
          operatingCost: 100,
          fatigueReduction: 0,
          prestige: 0,
        },
      });

      await tx.teamLeagueMembership.create({
        data: {
          teamId: newTeam.id,
          leagueId: 'local-rec-football',
          season: 'beta',
          status: 'ACTIVE',
        },
      });

      return newTeam;
    });

    await generateAIPlayers(team.id);

    const fullTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        teamPlayers: { include: { player: true } },
        venue: true,
        transportationAssets: true,
        leagueMemberships: { include: { league: true } },
      },
    });

    res.status(201).json({ status: 'success', data: fullTeam, message: `Development team ${input.name} created in ${venue.name}` });
  })
);

// ─── Stadium Leasing Between Players ───

// GET /api/teams/venues/for-lease — list player-owned venues available for lease
router.get(
  '/venues/for-lease',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const venues = await prisma.venue.findMany({
      where: {
        ownerId: { not: userId },
        teamId: null,
        isForSale: false,
      },
      orderBy: { tier: 'asc' },
    });
    res.json({ status: 'success', data: venues });
  })
);

// POST /api/teams/:id/venue/lease — lease a venue to your team
router.post(
  '/:id/venue/lease',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;
    const schema = z.object({ venueId: z.string().uuid() });
    const input = schema.parse(req.body);

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
      include: { venue: true },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, ownerId: { not: userId }, teamId: null, isForSale: false },
    });
    if (!venue) {
      throw new AppError(400, 'Venue not available for lease');
    }

    await prisma.$transaction(async (tx: any) => {
      // Unlink current venue if any
      if (team.venue) {
        await tx.venue.update({
          where: { id: team.venue.id },
          data: { teamId: null },
        });
      }
      // Link new venue
      await tx.venue.update({
        where: { id: venue.id },
        data: { teamId: team.id },
      });
    });

    res.json({ status: 'success', message: `Leased ${venue.name} for your team. ${Math.round(venue.leaseRate * 100)}% of ticket revenue goes to ${venue.ownerId}.` });
  })
);

// ─── Stadium Marketplace (Standalone Venue Sales) ───

// GET /api/teams/venues/marketplace — list player-owned venues for sale
router.get(
  '/venues/marketplace',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const venues = await prisma.venue.findMany({
      where: { isForSale: true, teamId: null },
      orderBy: { salePrice: 'asc' },
    });
    res.json({ status: 'success', data: venues });
  })
);

// POST /api/teams/venues/:venueId/list — list your venue for sale
router.post(
  '/venues/:venueId/list',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const venueId = routeParam(req.params.venueId, 'venueId');
    const schema = z.object({
      price: z.number().int().positive(),
      currency: z.enum(['CASH', 'DYN', 'SOL']).default('CASH'),
    });
    const input = schema.parse(req.body);

    const venue = await prisma.venue.findFirst({
      where: { id: venueId, ownerId: userId, teamId: null },
    });
    if (!venue) {
      throw new AppError(400, 'Venue not found or still in use by a team');
    }
    if (venue.isForSale) {
      throw new AppError(400, 'Venue is already listed for sale');
    }

    await prisma.venue.update({
      where: { id: venueId },
      data: {
        isForSale: true,
        salePrice: input.price,
        saleCurrency: input.currency,
        saleListedAt: new Date(),
      },
    });

    res.json({ status: 'success', message: `${venue.name} listed for ${input.price.toLocaleString()} ${input.currency}` });
  })
);

// POST /api/teams/venues/:venueId/unlist — remove venue listing
router.post(
  '/venues/:venueId/unlist',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const venueId = routeParam(req.params.venueId, 'venueId');

    const venue = await prisma.venue.findFirst({
      where: { id: venueId, ownerId: userId },
    });
    if (!venue) {
      throw new AppError(403, 'Venue not found or you do not own it');
    }

    await prisma.venue.update({
      where: { id: venueId },
      data: { isForSale: false, salePrice: null, saleListedAt: null },
    });

    res.json({ status: 'success', message: `${venue.name} removed from marketplace` });
  })
);

// POST /api/teams/venues/:venueId/buy — buy a standalone venue from another player
router.post(
  '/venues/:venueId/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const venueId = routeParam(req.params.venueId, 'venueId');

    const venue = await prisma.venue.findFirst({
      where: { id: venueId, isForSale: true, teamId: null },
    });
    if (!venue) {
      throw new AppError(404, 'Venue not found or not for sale');
    }
    if (venue.ownerId === userId) {
      throw new AppError(400, 'You cannot buy your own venue');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    const price = venue.salePrice || 0;
    const currency = venue.saleCurrency || 'CASH';

    if (currency === 'CASH') {
      if (wallet.cash < price) {
        throw new AppError(400, `Insufficient CASH. Need ${price.toLocaleString()} CASH`);
      }
    } else if (currency === 'DYN') {
      if (wallet.dynTokens < price) {
        throw new AppError(400, `Insufficient DYN. Need ${price.toLocaleString()} DYN`);
      }
    } else {
      if ((wallet.solBalance || 0) < price) {
        throw new AppError(400, `Insufficient SOL. Need ${price} SOL`);
      }
    }

    const sellerId = venue.ownerId;

    await prisma.$transaction(async (tx: any) => {
      const saleGuard: any = { id: venueId, isForSale: true };
      if (sellerId) saleGuard.ownerId = sellerId;
      else saleGuard.ownerId = null;

      const transfer = await tx.venue.updateMany({
        where: saleGuard,
        data: { ownerId: userId, isForSale: false, salePrice: null, saleListedAt: null },
      });
      if (transfer.count !== 1) {
        throw new AppError(409, 'Venue listing is no longer available');
      }

      await settleMarketplaceSale(tx, {
        buyerId: userId,
        sellerId,
        currency,
        price,
        reasonPrefix: 'VENUE',
        sourceType: 'VENUE_MARKETPLACE',
        sourceId: venueId,
        metadata: { venueId, venueName: venue.name, sellerId },
      });
    });

    res.json({ status: 'success', message: `You now own ${venue.name}` });
  })
);

// ─── Transport Preservation & Marketplace ───

// GET /api/teams/transport/available — your transport not assigned to any team
router.get(
  '/transport/available',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const transport = await prisma.transportationAsset.findMany({
      where: { ownerId: userId, teamId: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: transport });
  })
);

// GET /api/teams/transport/marketplace — list transport for sale
router.get(
  '/transport/marketplace',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const transport = await prisma.transportationAsset.findMany({
      where: { isForSale: true, teamId: null },
      orderBy: { salePrice: 'asc' },
    });
    res.json({ status: 'success', data: transport });
  })
);

// POST /api/teams/transport/:transportId/list — list your transport for sale
router.post(
  '/transport/:transportId/list',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const transportId = routeParam(req.params.transportId, 'transportId');
    const schema = z.object({
      price: z.number().int().positive(),
      currency: z.enum(['CASH', 'DYN', 'SOL']).default('CASH'),
    });
    const input = schema.parse(req.body);

    const transport = await prisma.transportationAsset.findFirst({
      where: { id: transportId, ownerId: userId, teamId: null },
    });
    if (!transport) {
      throw new AppError(400, 'Transport not found or still in use by a team');
    }
    if (transport.isForSale) {
      throw new AppError(400, 'Transport is already listed for sale');
    }

    await prisma.transportationAsset.update({
      where: { id: transportId },
      data: {
        isForSale: true,
        salePrice: input.price,
        saleCurrency: input.currency,
        saleListedAt: new Date(),
      },
    });

    res.json({ status: 'success', message: `${transport.name} listed for ${input.price.toLocaleString()} ${input.currency}` });
  })
);

// POST /api/teams/transport/:transportId/unlist — remove transport listing
router.post(
  '/transport/:transportId/unlist',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const transportId = routeParam(req.params.transportId, 'transportId');

    const transport = await prisma.transportationAsset.findFirst({
      where: { id: transportId, ownerId: userId },
    });
    if (!transport) {
      throw new AppError(403, 'Transport not found or you do not own it');
    }

    await prisma.transportationAsset.update({
      where: { id: transportId },
      data: { isForSale: false, salePrice: null, saleListedAt: null },
    });

    res.json({ status: 'success', message: `${transport.name} removed from marketplace` });
  })
);

// POST /api/teams/transport/:transportId/buy — buy standalone transport from another player
router.post(
  '/transport/:transportId/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const transportId = routeParam(req.params.transportId, 'transportId');

    const transport = await prisma.transportationAsset.findFirst({
      where: { id: transportId, isForSale: true, teamId: null },
    });
    if (!transport) {
      throw new AppError(404, 'Transport not found or not for sale');
    }
    if (transport.ownerId === userId) {
      throw new AppError(400, 'You cannot buy your own transport');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    const price = transport.salePrice || 0;
    const currency = transport.saleCurrency || 'CASH';

    if (currency === 'CASH') {
      if (wallet.cash < price) {
        throw new AppError(400, `Insufficient CASH. Need ${price.toLocaleString()} CASH`);
      }
    } else if (currency === 'DYN') {
      if (wallet.dynTokens < price) {
        throw new AppError(400, `Insufficient DYN. Need ${price.toLocaleString()} DYN`);
      }
    } else {
      if ((wallet.solBalance || 0) < price) {
        throw new AppError(400, `Insufficient SOL. Need ${price} SOL`);
      }
    }

    const sellerId = transport.ownerId;

    await prisma.$transaction(async (tx: any) => {
      const saleGuard: any = { id: transportId, isForSale: true, teamId: null };
      if (sellerId) saleGuard.ownerId = sellerId;
      else saleGuard.ownerId = null;

      const transfer = await tx.transportationAsset.updateMany({
        where: saleGuard,
        data: { ownerId: userId, isForSale: false, salePrice: null, saleListedAt: null },
      });
      if (transfer.count !== 1) {
        throw new AppError(409, 'Transport listing is no longer available');
      }

      await settleMarketplaceSale(tx, {
        buyerId: userId,
        sellerId,
        currency,
        price,
        reasonPrefix: 'TRANSPORT',
        sourceType: 'TRANSPORT_MARKETPLACE',
        sourceId: transportId,
        metadata: { transportId, transportName: transport.name, sellerId },
      });
    });

    res.json({ status: 'success', message: `You now own ${transport.name}` });
  })
);

export const teamRouter = router;
