import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { calculatePlayerPrice } from '../economy/marketplace.routes';
import { routeParam } from '../../utils/routeParams';
import { generateAndCreatePlayer, maintainPlayerPool } from './player.generator';

const router = Router();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { position, rarity, minOverall, maxOverall, sportId = 'american-football', page = '1', limit = '20', random } = req.query;

    const where: any = { sportId: sportId as string };
    if (position) where.position = position as string;
    if (rarity) where.rarity = rarity as string;
    if (minOverall || maxOverall) {
      where.overall = {};
      if (minOverall) where.overall.gte = parseInt(minOverall as string);
      if (maxOverall) where.overall.lte = parseInt(maxOverall as string);
    }

    const take = parseInt(limit as string);

    let players;
    let total;

    if (random === 'true') {
      // Random ordering - use Prisma's skip for randomness
      total = await prisma.player.count({ where });
      const skip = Math.floor(Math.random() * Math.max(0, total - take));
      players = await prisma.player.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'asc' },
        include: {
          teamPlayers: {
            include: {
              team: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    } else {
      const skip = (parseInt(page as string) - 1) * take;
      [players, total] = await Promise.all([
        prisma.player.findMany({
          where,
          skip,
          take,
          orderBy: { overall: 'desc' },
          include: {
            teamPlayers: {
              include: {
                team: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        }),
        prisma.player.count({ where }),
      ]);
    }

    const playersWithPrice = players.map((p: any) => ({
      ...p,
      currentPrice: calculatePlayerPrice(p),
    }));

    res.json({
      status: 'success',
      data: {
        players: playersWithPrice,
        pagination: {
          page: random === 'true' ? 1 : parseInt(page as string),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const player = await prisma.player.findUnique({
      where: { id: routeParam(req.params.id, 'id') },
      include: {
        teamPlayers: {
          include: {
            team: {
              select: { id: true, name: true, owner: { select: { username: true } } },
            },
          },
        },
        matchStats: {
          orderBy: { match: { completedAt: 'desc' } },
          take: 10,
          include: {
            match: {
              select: {
                id: true,
                homeScore: true,
                awayScore: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      throw new AppError(404, 'Player not found');
    }

    res.json({ status: 'success', data: { ...player, currentPrice: calculatePlayerPrice(player) } });
  })
);

router.post(
  '/refresh-pool',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const sportId = (req.query.sportId as string) || 'american-football';
    const count = await maintainPlayerPool(200);
    res.json({
      status: 'success',
      data: {
        generated: count,
        sportId,
        message: count > 0
          ? `Generated ${count} new player(s) to maintain the pool.`
          : 'Pool is already at target size. No new players needed.',
      },
    });
  })
);

export const playerRouter = router;
