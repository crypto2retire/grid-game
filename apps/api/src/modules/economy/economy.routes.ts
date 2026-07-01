import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest, requireRole } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { creditCurrency, exchangeCurrency } from './currency.service';
import { getLuckBreakdown } from '../luck/luck.service';

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

    const luck = await getLuckBreakdown(req.user!.id);
    res.json({ status: 'success', data: { ...wallet, luck } });
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

// Admin-only: top up wallet for testing
router.post(
  '/wallet/topup',
  authMiddleware,
  requireRole('ADMIN'),
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
      const { wallet: walletAfter } = await creditCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: input.amount,
        reason: 'TEST_TOPUP',
        sourceType: 'WALLET_TOPUP',
        sourceId: wallet.id,
        metadata: { testOnly: true },
      });
      return walletAfter;
    });

    res.json({ status: 'success', data: updated, message: `Added ${input.amount.toLocaleString()} CASH` });
  })
);

// Admin-only: top up DYN tokens for testing
router.post(
  '/wallet/topup-grid',
  authMiddleware,
  requireRole('ADMIN'),
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
      const { wallet: walletAfter } = await creditCurrency(tx, {
        userId,
        currency: 'DYN',
        amount: input.amount,
        reason: 'TEST_TOPUP',
        sourceType: 'WALLET_TOPUP',
        sourceId: wallet.id,
        metadata: { testOnly: true },
      });
      return walletAfter;
    });

    res.json({ status: 'success', data: updated, message: `Added ${input.amount.toLocaleString()} DYN` });
  })
);

// POST /api/economy/exchange — exchange Gold for DYN (paid users only)
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
        'Gold-to-DYN exchange requires a paid team purchase. Buy a college or pro team to unlock.'
      );
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    if (wallet.cash < input.amount) {
      throw new AppError(400, `Insufficient CASH. Need ${input.amount.toLocaleString()} CASH`);
    }

    // Exchange rate: 1000 CASH = 1 DYN (adjustable)
    const gridReceived = Math.floor(input.amount / 1000);
    if (gridReceived <= 0) {
      throw new AppError(400, 'Minimum exchange: 1,000 CASH for 1 DYN');
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const { wallet: walletAfter } = await exchangeCurrency(tx, {
        userId,
        fromCurrency: 'CASH',
        toCurrency: 'DYN',
        fromAmount: input.amount,
        toAmount: gridReceived,
        reason: 'GOLD_TO_DYN_EXCHANGE',
        sourceType: 'EXCHANGE',
        metadata: { exchangedAmount: input.amount, gridReceived },
      });

      return walletAfter;
    });

    res.json({
      status: 'success',
      data: updated,
      message: `Exchanged ${input.amount.toLocaleString()} CASH for ${gridReceived.toLocaleString()} DYN`,
    });
  })
);

// GET /api/economy/token-gate-status — public: check if token gating is active
router.get(
  '/token-gate-status',
  asyncHandler(async (_req, res) => {
    const required = env.REQUIRED_DYN_BALANCE;
    res.json({
      status: 'success',
      data: {
        active: required > 0,
        requiredBalance: required,
        tokenSymbol: env.PUMPFUN_TOKEN_SYMBOL || 'DYN',
        message: required > 0
          ? `${required.toLocaleString()} ${env.PUMPFUN_TOKEN_SYMBOL || 'DYN'} required to play`
          : 'No token gate — free to play',
      },
    });
  })
);

export const economyRouter = router;
