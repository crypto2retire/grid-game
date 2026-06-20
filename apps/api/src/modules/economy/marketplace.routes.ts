import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';

const router = Router();

const RARITY_MULTIPLIERS: Record<string, number> = {
  COMMON: 1.0,
  BRONZE: 1.5,
  SILVER: 2.5,
  GOLD: 4.0,
  ELITE: 6.0,
  LEGEND: 10.0,
};

const BASE_PRICE_PER_OVERALL = 500;

function calculatePlayerPrice(player: {
  overall: number;
  rarity: string;
  demandMultiplier: number;
  lastSoldPrice: number | null;
}): number {
  const rarityMult = RARITY_MULTIPLIERS[player.rarity] || 1.0;
  const base = player.overall * BASE_PRICE_PER_OVERALL * rarityMult;
  const demandAdjusted = Math.round(base * player.demandMultiplier);
  if (player.lastSoldPrice) {
    const blended = Math.round((demandAdjusted * 0.7) + (player.lastSoldPrice * 0.3));
    return blended;
  }
  return demandAdjusted;
}

export async function updatePlayerDemand(playerId: string, transaction: any = prisma) {
  const activeListings = await transaction.marketplaceListing.count({
    where: { playerId, status: 'ACTIVE' },
  });
  const recentSales = await transaction.marketplaceListing.count({
    where: { playerId, status: 'SOLD', soldAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  const demand = 1.0 + (activeListings * 0.05) + (recentSales * 0.1);
  const clamped = Math.min(Math.max(demand, 0.5), 3.0);
  await transaction.player.update({
    where: { id: playerId },
    data: { demandMultiplier: clamped, priceUpdatedAt: new Date() },
  });
}

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20', rarity, position, minPrice, maxPrice, sortBy = 'price' } = req.query;

    const where: any = { status: 'ACTIVE' };
    if (rarity) where.player = { rarity: rarity as string };
    if (position) where.player = { ...where.player, position: position as string };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseInt(minPrice as string);
      if (maxPrice) where.price.lte = parseInt(maxPrice as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: sortBy === 'price' ? { price: 'asc' } : { createdAt: 'desc' },
        include: {
          player: true,
          seller: { select: { id: true, username: true } },
          offers: {
            where: { status: 'PENDING' },
            include: { buyer: { select: { id: true, username: true } } },
          },
        },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        listings,
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

router.get(
  '/my-offers',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const offers = await prisma.marketplaceOffer.findMany({
      where: { buyerId: userId },
      include: {
        listing: {
          include: {
            player: true,
            seller: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: offers });
  })
);

router.get(
  '/my-listings',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const listings = await prisma.marketplaceListing.findMany({
      where: { sellerId: userId },
      include: {
        player: true,
        offers: {
          where: { status: 'PENDING' },
          include: { buyer: { select: { id: true, username: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: listings });
  })
);

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      playerId: z.string().uuid(),
      price: z.number().int().positive().min(100),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: { playerId: input.playerId, team: { ownerId: userId } },
    });
    if (!teamPlayer) {
      throw new AppError(403, 'You do not own this player');
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: { playerId: input.playerId, sellerId: userId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new AppError(409, 'Player already listed on marketplace');
    }

    await updatePlayerDemand(input.playerId);

    const listing = await prisma.marketplaceListing.create({
      data: { sellerId: userId, playerId: input.playerId, price: input.price },
      include: {
        player: true,
        seller: { select: { id: true, username: true } },
      },
    });

    res.status(201).json({ status: 'success', data: listing });
  })
);

router.post(
  '/:id/offer',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({ price: z.number().int().positive().min(100) });
    const input = schema.parse(req.body);
    const userId = req.user!.id;
    const listingId = routeParam(req.params.id, 'id');

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { seller: true, player: true },
    });
    if (!listing || listing.status !== 'ACTIVE') {
      throw new AppError(404, 'Listing not found or not active');
    }
    if (listing.sellerId === userId) {
      throw new AppError(400, 'Cannot make an offer on your own listing');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.cash < input.price) {
      throw new AppError(400, 'Insufficient CASH for this offer');
    }

    const existingOffer = await prisma.marketplaceOffer.findFirst({
      where: { listingId, buyerId: userId, status: 'PENDING' },
    });
    if (existingOffer) {
      throw new AppError(409, 'You already have a pending offer on this listing');
    }

    const offer = await prisma.marketplaceOffer.create({
      data: { listingId, buyerId: userId, price: input.price },
      include: {
        listing: { include: { player: true, seller: { select: { id: true, username: true } } } },
        buyer: { select: { id: true, username: true } },
      },
    });

    res.status(201).json({ status: 'success', data: offer });
  })
);

router.post(
  '/offers/:offerId/accept',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const offerId = routeParam(req.params.offerId, 'offerId');

    const offer = await prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: {
        listing: { include: { seller: { include: { wallet: true } }, player: true } },
        buyer: { include: { wallet: true } },
      },
    });
    if (!offer || offer.status !== 'PENDING') {
      throw new AppError(404, 'Offer not found or not pending');
    }
    if (offer.listing.sellerId !== userId) {
      throw new AppError(403, 'You do not own this listing');
    }
    if (offer.listing.status !== 'ACTIVE') {
      throw new AppError(400, 'Listing is no longer active');
    }
    if (!offer.buyer.wallet || offer.buyer.wallet.cash < offer.price) {
      throw new AppError(400, 'Buyer no longer has sufficient CASH');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.wallet.update({ where: { userId: offer.buyerId }, data: { cash: { decrement: offer.price } } });
      const sellerAmount = Math.floor(offer.price * 0.95);
      await tx.wallet.update({ where: { userId: offer.listing.sellerId }, data: { cash: { increment: sellerAmount } } });
      await tx.marketplaceOffer.update({ where: { id: offerId }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
      await tx.marketplaceOffer.updateMany({
        where: { listingId: offer.listingId, id: { not: offerId }, status: 'PENDING' },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });
      await tx.marketplaceListing.update({ where: { id: offer.listingId }, data: { status: 'SOLD', soldAt: new Date() } });
      await tx.teamPlayer.deleteMany({ where: { playerId: offer.listing.playerId, team: { ownerId: offer.listing.sellerId } } });
      const buyerTeam = await tx.team.findFirst({ where: { ownerId: offer.buyerId } });
      if (buyerTeam) {
        await tx.teamPlayer.create({ data: { teamId: buyerTeam.id, playerId: offer.listing.playerId, isStarter: false } });
      }
      await tx.player.update({
        where: { id: offer.listing.playerId },
        data: { lastSoldPrice: offer.price, priceUpdatedAt: new Date() },
      });
    });

    res.json({ status: 'success', message: 'Offer accepted and sale completed' });
  })
);

router.post(
  '/offers/:offerId/reject',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const offerId = routeParam(req.params.offerId, 'offerId');

    const offer = await prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: { listing: true },
    });
    if (!offer || offer.status !== 'PENDING') {
      throw new AppError(404, 'Offer not found or not pending');
    }
    if (offer.listing.sellerId !== userId) {
      throw new AppError(403, 'You do not own this listing');
    }

    await prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });

    res.json({ status: 'success', message: 'Offer rejected' });
  })
);

router.post(
  '/offers/:offerId/cancel',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const offerId = routeParam(req.params.offerId, 'offerId');

    const offer = await prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer || offer.status !== 'PENDING') {
      throw new AppError(404, 'Offer not found or not pending');
    }
    if (offer.buyerId !== userId) {
      throw new AppError(403, 'You did not make this offer');
    }

    await prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });

    res.json({ status: 'success', message: 'Offer cancelled' });
  })
);

router.post(
  '/:id/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const listingId = routeParam(req.params.id, 'id');

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { seller: { include: { wallet: true } }, player: true },
    });
    if (!listing || listing.status !== 'ACTIVE') {
      throw new AppError(404, 'Listing not found or not active');
    }
    if (listing.sellerId === userId) {
      throw new AppError(400, 'Cannot buy your own listing');
    }

    const buyerWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!buyerWallet || buyerWallet.cash < listing.price) {
      throw new AppError(400, 'Insufficient CASH');
    }

    const existingPlayer = await prisma.teamPlayer.findFirst({
      where: { playerId: listing.playerId, team: { ownerId: userId } },
    });
    if (existingPlayer) {
      throw new AppError(400, 'You already own this player');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.wallet.update({ where: { userId }, data: { cash: { decrement: listing.price } } });
      const sellerAmount = Math.floor(listing.price * 0.95);
      await tx.wallet.update({ where: { userId: listing.sellerId }, data: { cash: { increment: sellerAmount } } });
      await tx.marketplaceListing.update({ where: { id: listingId }, data: { status: 'SOLD', soldAt: new Date() } });
      await tx.marketplaceOffer.updateMany({
        where: { listingId, status: 'PENDING' },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });
      await tx.teamPlayer.deleteMany({ where: { playerId: listing.playerId, team: { ownerId: listing.sellerId } } });
      const buyerTeam = await tx.team.findFirst({ where: { ownerId: userId } });
      if (buyerTeam) {
        await tx.teamPlayer.create({ data: { teamId: buyerTeam.id, playerId: listing.playerId, isStarter: false } });
      }
      await tx.player.update({
        where: { id: listing.playerId },
        data: { lastSoldPrice: listing.price, priceUpdatedAt: new Date() },
      });
    });

    res.json({ status: 'success', message: 'Purchase successful' });
  })
);

export const marketplaceRouter = router;
export { calculatePlayerPrice };
