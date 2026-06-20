import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { recordCurrencyLedger } from './ledger';

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
    const transactions = await prisma.currencyLedger.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

    const updated = await prisma.$transaction(async (tx: any) => {
      const walletAfter = await tx.wallet.update({
        where: { userId },
        data: { cash: { increment: input.amount } },
      });
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: input.amount,
        balanceAfter: walletAfter.cash,
        reason: 'TEST_TOPUP',
        sourceType: 'WALLET_TOPUP',
        sourceId: walletAfter.id,
        metadata: { testOnly: true },
      });
      return walletAfter;
    });

    res.json({ status: 'success', data: updated, message: `Added ${input.amount.toLocaleString()} CASH` });
  })
);

export const economyRouter = router;
