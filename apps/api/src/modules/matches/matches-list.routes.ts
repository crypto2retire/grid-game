import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { prisma } from '../../config/database';

const router = Router();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { status, page = '1', limit = '20' } = req.query;
    const userId = (req as any).user?.id;

    const where: any = {
      OR: [
        { homeTeam: { ownerId: userId } },
        { awayTeam: { ownerId: userId } },
      ],
    };
    const statusMap: Record<string, string> = {
      PLAYING: 'IN_PROGRESS',
      SCHEDULED: 'SCHEDULED',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    };
    if (status) where.status = statusMap[status as string] || status as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { scheduledAt: 'desc' },
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      }),
      prisma.match.count({ where }),
    ]);

    const mappedMatches = matches.map((m) => ({
      ...m,
      status: m.status === 'IN_PROGRESS' ? 'PLAYING' : m.status,
    }));

    res.json({
      status: 'success',
      data: {
        matches: mappedMatches,
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

export const matchesListRouter = router;
