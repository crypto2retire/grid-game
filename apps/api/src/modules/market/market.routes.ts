import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { processTreasuryInflow } from '../../modules/treasury/treasury.service';

const router = Router();

// ─── GET /api/market/items ───
// List all items available in the game store, with dynamic pricing rules applied
router.get(
  '/items',
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const marketItems = await prisma.marketItem.findMany({
      where: { isAvailable: true },
      include: { item: true },
      orderBy: { item: { tier: 'asc' } },
    });

    const data = marketItems.map((mi) => ({
      id: mi.item.id,
      name: mi.item.name,
      slot: mi.item.slot,
      rarity: mi.item.rarity,
      tier: mi.item.tier,
      statBoosts: mi.item.statBoosts,
      durability: mi.item.durability,
      marketPriceCash: mi.marketPriceCash,
      marketPriceGrid: mi.marketPriceGrid,
      lastMarketplacePrice: mi.lastMarketplacePrice,
      isAvailable: mi.isAvailable,
    }));

    res.json({ status: 'success', data });
  })
);

// ─── GET /api/market/items/:slot ───
// Filter by slot (helmet, pads, gloves, shoes, accessory)
router.get(
  '/items/:slot',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const slot = req.params.slot;
    const marketItems = await prisma.marketItem.findMany({
      where: { isAvailable: true, item: { slot } },
      include: { item: true },
      orderBy: { item: { tier: 'asc' } },
    });

    res.json({ status: 'success', data: marketItems });
  })
);

// ─── POST /api/market/buy ───
// Buy an item from the game store. Money goes to treasury.
router.post(
  '/buy',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      itemId: z.string().uuid(),
      playerId: z.string().uuid(),
      currency: z.enum(['CASH', 'DYN']).default('CASH'),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    // Verify market item is available
    const marketItem = await prisma.marketItem.findUnique({
      where: { itemId: input.itemId },
      include: { item: true },
    });
    if (!marketItem || !marketItem.isAvailable) {
      throw new AppError(400, 'This item is not available in the market');
    }

    // Check player ownership
    const player = await prisma.player.findFirst({
      where: { id: input.playerId, teamPlayers: { some: { team: { ownerId: userId } } } },
    });
    if (!player) {
      throw new AppError(403, 'You do not own this player');
    }

    // Check wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new AppError(404, 'Wallet not found');

    const price = input.currency === 'DYN' ? marketItem.marketPriceGrid : marketItem.marketPriceCash;
    if (price <= 0) throw new AppError(400, 'This item is not for sale in the selected currency');

    if (input.currency === 'DYN' && wallet.dynTokens < price) {
      throw new AppError(400, `Insufficient DYN. Need ${price.toLocaleString()} DYN`);
    }
    if (input.currency === 'CASH' && wallet.cash < price) {
      throw new AppError(400, `Insufficient CASH. Need ${price.toLocaleString()} CASH`);
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Deduct from wallet
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: input.currency === 'DYN'
          ? { dynTokens: { decrement: price } }
          : { cash: { decrement: price } },
      });

      // Record ledger entry
      await tx.currencyLedger.create({
        data: {
          userId,
          currency: input.currency,
          amount: -price,
          balanceAfter: input.currency === 'DYN' ? updatedWallet.dynTokens : updatedWallet.cash,
          reason: 'MARKET_PURCHASE',
          sourceType: 'ITEM',
          sourceId: input.itemId,
          metadata: { itemName: marketItem.item.name, playerId: input.playerId },
        },
      });

      // Send to treasury
      await processTreasuryInflow(
        tx,
        input.currency,
        price,
        `Market sale: ${marketItem.item.name}`,
        input.itemId
      );

      // Create PlayerItem
      const playerItem = await tx.playerItem.create({
        data: {
          playerId: input.playerId,
          itemId: input.itemId,
          equipped: false,
          durability: marketItem.item.durability,
          acquiredFrom: 'MARKET',
        },
        include: { item: true },
      });

      return { playerItem, wallet: updatedWallet };
    });

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Purchased ${marketItem.item.name} from the market`,
    });
  })
);

export const marketRouter = router;
