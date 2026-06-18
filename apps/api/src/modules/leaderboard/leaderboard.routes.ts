import { Router } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        skip,
        take: parseInt(limit as string),
        orderBy: [
          { points: 'desc' },
          { goalsFor: 'desc' },
        ],
        include: {
          owner: {
            select: { username: true, displayName: true },
          },
          _count: {
            select: { teamPlayers: true },
          },
        },
      }),
      prisma.team.count(),
    ]);

    res.json({
      status: 'success',
      data: {
        teams,
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
  '/players',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20', sortBy = 'overall' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const orderBy: any = {};
    orderBy[sortBy as string] = 'desc';

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        skip,
        take: parseInt(limit as string),
        orderBy,
        include: {
          matchStats: {
            orderBy: { match: { completedAt: 'desc' } },
            take: 1,
          },
        },
      }),
      prisma.player.count(),
    ]);

    res.json({
      status: 'success',
      data: {
        players,
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

export const leaderboardRouter = router;
