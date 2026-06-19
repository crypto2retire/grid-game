import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';

const router = Router();

router.get(
  '/wallet',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
    });

    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    res.json({ status: 'success', data: wallet });
  })
);

router.get(
  '/transactions',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const transactions = await prisma.matchParticipant.findMany({
      where: { userId: req.user!.id },
      include: {
        match: {
          select: {
            id: true,
            homeScore: true,
            awayScore: true,
            completedAt: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
      },
      orderBy: { match: { completedAt: 'desc' } },
      take: 50,
    });

    res.json({ status: 'success', data: transactions });
  })
);

export const economyRouter = router;
