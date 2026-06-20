import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { calculatePlayerPrice } from '../economy/marketplace.routes';
import { routeParam } from '../../utils/routeParams';

const router = Router();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { position, rarity, minOverall, maxOverall, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (position) where.position = position as string;
    if (rarity) where.rarity = rarity as string;
    if (minOverall || maxOverall) {
      where.overall = {};
      if (minOverall) where.overall.gte = parseInt(minOverall as string);
      if (maxOverall) where.overall.lte = parseInt(maxOverall as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        skip,
        take: parseInt(limit as string),
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

    const playersWithPrice = players.map((p) => ({
      ...p,
      currentPrice: calculatePlayerPrice(p),
    }));

    res.json({
      status: 'success',
      data: {
        players: playersWithPrice,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string)),
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

export const playerRouter = router;
