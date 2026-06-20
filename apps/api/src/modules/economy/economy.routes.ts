import { Router } from 'express';
import { z } from 'zod';
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

// Admin/debug: top up wallet for testing
router.post(
  '/wallet/topup',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      amount: z.number().int().positive().max(10000000),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    const updated = await prisma.wallet.update({
      where: { userId },
      data: { cash: { increment: input.amount } },
    });

    res.json({ status: 'success', data: updated, message: `Added ${input.amount.toLocaleString()} CASH` });
  })
);

export const economyRouter = router;
