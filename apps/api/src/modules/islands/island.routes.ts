import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { Response } from 'express';

const router = Router();

// ─── GET /api/islands — list all islands with league info ───
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const islands = await prisma.island.findMany({
      include: {
        league: {
          select: {
            id: true,
            name: true,
            tier: true,
            visibility: true,
            minOverall: true,
            maxOverall: true,
            maxTeams: true,
            isDefault: true,
            creator: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
      orderBy: [{ type: 'desc' as any }, { prestige: 'desc' }],
    });

    res.json({ status: 'success', data: islands });
  })
);

// ─── GET /api/islands/:id — island detail with teams and stadiums ───
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const island = await prisma.island.findUnique({
      where: { id: req.params.id as string },
      include: {
        league: {
          include: {
            memberships: {
              include: {
                team: {
                  include: {
                    owner: { select: { id: true, username: true, displayName: true } },
                    venue: true,
                    teamPlayers: { include: { player: true } },
                  },
                },
              },
            },
            creator: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    if (!island) throw new AppError(404, 'Island not found');

    res.json({ status: 'success', data: island });
  })
);

export { router as islandRouter };
