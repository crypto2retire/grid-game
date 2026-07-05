import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { tokenGate } from '../../middleware/tokenGate';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { debitCurrency, settleMarketplaceSale } from '../economy/currency.service';
import { ECONOMY_BALANCE_POLICY } from '../economy/balance.service';

const router = Router();

// ─── GET /api/marketplace-items ───
// List all active P2P item listings
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const listings = await prisma.marketplaceItemListing.findMany({
      where: { status: 'ACTIVE' },
      include: {
        seller: { select: { id: true, username: true } },
        playerItem: {
          include: {
            item: true,
            player: { select: { id: true, name: true, position: true, overall: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: listings });
  })
);

// ─── GET /api/marketplace-items/my-listings ───
router.get(
  '/my-listings',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const userId = req.user!.id;
    const listings = await prisma.marketplaceItemListing.findMany({
      where: { sellerId: userId },
      include: {
        playerItem: {
          include: {
            item: true,
            player: { select: { id: true, name: true, position: true, overall: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: listings });
  })
);

// ─── POST /api/marketplace-items ───
// List a player item for sale
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      playerItemId: z.string().uuid(),
      price: z.number().int().min(1),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    // Verify ownership of the playerItem
    const playerItem = await prisma.playerItem.findFirst({
      where: {
        id: input.playerItemId,
        player: { teamPlayers: { some: { team: { ownerId: userId } } } },
      },
      include: { item: true, player: true },
    });
    if (!playerItem) {
      throw new AppError(403, 'You do not own this item');
    }
    if (playerItem.equipped) {
      throw new AppError(400, 'Cannot sell an equipped item. Unequip it first.');
    }

    // Check if already listed
    const existing = await prisma.marketplaceItemListing.findFirst({
      where: { playerItemId: input.playerItemId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new AppError(409, 'This item is already listed for sale');
    }

    const listingFee = Math.max(1, Math.floor(input.price * ECONOMY_BALANCE_POLICY.marketplaceListingFeeRate));
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new AppError(404, 'Wallet not found');
    if (wallet.cash < listingFee) {
      throw new AppError(400, `Listing fee requires ${listingFee.toLocaleString()} CASH`);
    }

    const listing = await prisma.$transaction(async (tx: any) => {
      await debitCurrency(tx, {
        userId,
        currency: 'CASH',
        amount: listingFee,
        reason: 'MARKETPLACE_ITEM_LISTING_FEE',
        sourceType: 'MARKETPLACE_ITEM',
        sourceId: input.playerItemId,
        metadata: { playerItemId: input.playerItemId, price: input.price, feeRate: ECONOMY_BALANCE_POLICY.marketplaceListingFeeRate },
      });

      return tx.marketplaceItemListing.create({
        data: {
          sellerId: userId,
          playerItemId: input.playerItemId,
          price: input.price,
          status: 'ACTIVE',
        },
        include: {
          seller: { select: { id: true, username: true } },
          playerItem: {
            include: {
              item: true,
              player: { select: { id: true, name: true, position: true, overall: true } },
            },
          },
        },
      });
    });

    res.status(201).json({ status: 'success', data: { ...listing, listingFee } });
  })
);

// ─── POST /api/marketplace-items/:id/buy ───
// Buy a listed item from another player
router.post(
  '/:id/buy',
  authMiddleware,
  tokenGate,
  asyncHandler(async (req: any, res) => {
    const listingId = req.params.id;
    const userId = req.user!.id;

    const result = await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.marketplaceItemListing.updateMany({
        where: { id: listingId, status: 'ACTIVE' },
        data: { status: 'PENDING_SETTLEMENT' },
      });
      if (claimed.count !== 1) {
        throw new AppError(409, 'Listing already sold');
      }

      const listing = await tx.marketplaceItemListing.findUnique({
        where: { id: listingId },
        include: {
          seller: true,
          playerItem: { include: { item: true, player: true } },
        },
      });
      if (!listing) throw new AppError(404, 'Listing not found');
      if (listing.sellerId === userId) throw new AppError(400, 'Cannot buy your own item');

      await settleMarketplaceSale(tx, {
        buyerId: userId,
        sellerId: listing.sellerId,
        currency: 'CASH',
        price: listing.price,
        reasonPrefix: 'MARKETPLACE_ITEM',
        sourceType: 'MARKETPLACE_ITEM',
        sourceId: listingId,
        metadata: { itemName: listing.playerItem.item.name, sellerId: listing.sellerId },
      });

      // Transfer PlayerItem to buyer's team player
      // Find a player on buyer's team to assign the item to
      const buyerTeamPlayer = await tx.teamPlayer.findFirst({
        where: { team: { ownerId: userId } },
        select: { playerId: true },
      });
      const newPlayerId = buyerTeamPlayer?.playerId || listing.playerItem.playerId;

      // Transfer the item
      const transferredItem = await tx.playerItem.update({
        where: { id: listing.playerItemId },
        data: {
          playerId: newPlayerId,
          equipped: false,
          acquiredFrom: 'MARKETPLACE',
        },
        include: { item: true },
      });

      // Record sale history for pricing dynamic
      await tx.itemSaleHistory.create({
        data: {
          itemId: listing.playerItem.itemId,
          price: listing.price,
          currency: 'CASH',
          sellerId: listing.sellerId,
          buyerId: userId,
        },
      });

      // ─── Dynamic pricing rule ───
      // If marketplace price > market price, adjust market price to 110% of last sale
      // or make item unavailable in market
      const marketItem = await tx.marketItem.findUnique({
        where: { itemId: listing.playerItem.itemId },
      });
      if (marketItem) {
        const newPrice = Math.ceil(listing.price * 1.1);
        // If market price is below the new threshold, adjust it up
        if (marketItem.marketPriceCash < listing.price) {
          await tx.marketItem.update({
            where: { itemId: listing.playerItem.itemId },
            data: {
              marketPriceCash: newPrice,
              lastMarketplacePrice: listing.price,
              updatedAt: new Date(),
            },
          });
        } else {
          // Just update the last marketplace price
          await tx.marketItem.update({
            where: { itemId: listing.playerItem.itemId },
            data: {
              lastMarketplacePrice: listing.price,
              updatedAt: new Date(),
            },
          });
        }
      }

      const soldListing = await tx.marketplaceItemListing.update({
        where: { id: listingId },
        data: { status: 'SOLD', soldAt: new Date() },
      });

      return { listing: soldListing, playerItem: transferredItem };
    });

    res.json({
      status: 'success',
      data: result,
      message: `Purchased ${result.playerItem.item.name} from the marketplace`,
    });
  })
);

// ─── DELETE /api/marketplace-items/:id ───
// Cancel a listing
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const listingId = req.params.id;
    const userId = req.user!.id;

    const listing = await prisma.marketplaceItemListing.findFirst({
      where: { id: listingId, sellerId: userId, status: 'ACTIVE' },
    });
    if (!listing) throw new AppError(404, 'Listing not found or already sold');

    await prisma.marketplaceItemListing.update({
      where: { id: listingId },
      data: { status: 'CANCELLED' },
    });

    res.json({ status: 'success', message: 'Listing cancelled' });
  })
);

export const marketplaceItemsRouter = router;
