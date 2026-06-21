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

// POST /api/economy/exchange — exchange Gold for GRID (paid users only)
router.post(
  '/exchange',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      amount: z.number().int().positive(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    // Check if user has made a paid purchase
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hasPaidPurchase: true },
    });

    if (!user?.hasPaidPurchase) {
      throw new AppError(
        403,
        'Gold-to-GRID exchange requires a paid team purchase. Buy a college or pro team to unlock.'
      );
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    if (wallet.cash < input.amount) {
      throw new AppError(400, `Insufficient CASH. Need ${input.amount.toLocaleString()} CASH`);
    }

    // Exchange rate: 1000 CASH = 1 GRID (adjustable)
    const gridReceived = Math.floor(input.amount / 1000);
    if (gridReceived <= 0) {
      throw new AppError(400, 'Minimum exchange: 1,000 CASH for 1 GRID');
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const walletAfter = await tx.wallet.update({
        where: { userId },
        data: {
          cash: { decrement: input.amount },
          gridTokens: { increment: gridReceived },
        },
      });

      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -input.amount,
        balanceAfter: walletAfter.cash,
        reason: 'GOLD_TO_GRID_EXCHANGE',
        sourceType: 'EXCHANGE',
        metadata: { exchangedAmount: input.amount, gridReceived },
      });

      await recordCurrencyLedger(tx, {
        userId,
        currency: 'GRID',
        amount: gridReceived,
        balanceAfter: walletAfter.gridTokens,
        reason: 'GOLD_TO_GRID_EXCHANGE',
        sourceType: 'EXCHANGE',
        metadata: { exchangedAmount: input.amount, gridReceived },
      });

      return walletAfter;
    });

    res.json({
      status: 'success',
      data: updated,
      message: `Exchanged ${input.amount.toLocaleString()} CASH for ${gridReceived.toLocaleString()} GRID`,
    });
  })
);

export const economyRouter = router;
