import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';

const router = Router();

// GET /api/solana/purchases — list user's SOLANA purchases
router.get(
  '/purchases',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const purchases = await prisma.solanaPurchase.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: purchases });
  })
);

// POST /api/solana/purchase — record a SOLANA purchase (whale item)
router.post(
  '/purchase',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      type: z.enum(['TEAM', 'STADIUM', 'FACILITY', 'EQUIPMENT', 'TRANSPORT']),
      itemId: z.string(),
      itemName: z.string(),
      purchasePriceSol: z.number().positive(),
      isInitialSale: z.boolean().default(true),
      sellerId: z.string().optional(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const purchase = await prisma.solanaPurchase.create({
      data: {
        userId,
        type: input.type,
        itemId: input.itemId,
        itemName: input.itemName,
        purchasePriceSol: input.purchasePriceSol,
        isInitialSale: input.isInitialSale,
        sellerId: input.sellerId || null,
      },
    });

    res.status(201).json({
      status: 'success',
      data: purchase,
      message: input.isInitialSale
        ? 'Initial sale recorded. Game receives full SOL payment as profit.'
        : 'Resale recorded.',
    });
  })
);

// POST /api/solana/resale — record a resale with 5% tax
router.post(
  '/resale',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      purchaseId: z.string(),
      resalePriceSol: z.number().positive(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const originalPurchase = await prisma.solanaPurchase.findFirst({
      where: { id: input.purchaseId, userId },
    });

    if (!originalPurchase) {
      throw new AppError(404, 'Original purchase not found');
    }

    const tax = input.resalePriceSol * 0.05;
    const toTreasury = tax * 0.9;
    const toBurn = tax * 0.1;
    const sellerReceives = input.resalePriceSol - tax;

    const updatedPurchase = await prisma.solanaPurchase.update({
      where: { id: input.purchaseId },
      data: { resaleTaxPaid: { increment: tax } },
    });

    res.json({
      status: 'success',
      data: {
        originalPurchase: updatedPurchase,
        resalePrice: input.resalePriceSol,
        tax,
        toTreasury,
        toBurn,
        sellerReceives,
      },
      message: `5% tax applied: ${tax.toFixed(4)} SOL (90% to treasury, 10% burned)`,
    });
  })
);

export const solanaRouter = router;
