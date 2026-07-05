import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { tokenGate } from '../../middleware/tokenGate';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import { settleMarketplaceSale } from './currency.service';

const router = Router();

const RARITY_MULTIPLIERS: Record<string, number> = {
  COMMON: 1.0,
  BRONZE: 1.2,
  SILVER: 1.5,
  GOLD: 2.0,
  ELITE: 3.0,
  LEGEND: 5.0,
};

const BASE_PRICE_PER_OVERALL = 100;

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

// ── Marketplace Listings ───────────────────────────────────────────────────

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { sportId = 'american-football' } = req.query;
    const listings = await prisma.marketplaceListing.findMany({
      where: { status: 'ACTIVE', sportId: sportId as string },
      include: {
        player: true,
        seller: { select: { username: true } },
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
      where: {
        playerId: input.playerId,
        team: { ownerId: userId },
      },
      include: { player: true },
    });

    if (!teamPlayer) {
      throw new AppError(403, 'You do not own this player');
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        sportId: teamPlayer.player.sportId,
        playerId: input.playerId,
        sellerId: userId,
        price: input.price,
        status: 'ACTIVE',
      },
      include: {
        player: true,
        seller: { select: { username: true } },
      },
    });

    res.status(201).json({ status: 'success', data: listing });
  })
);

router.post(
  '/:id/buy',
  authMiddleware,
  tokenGate,
  asyncHandler(async (req: AuthRequest, res) => {
    const listingId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.marketplaceListing.updateMany({
        where: { id: listingId, status: 'ACTIVE' },
        data: { status: 'PENDING_SETTLEMENT' },
      });
      if (claimed.count !== 1) {
        throw new AppError(409, 'Listing already sold');
      }

      const listing = await tx.marketplaceListing.findUnique({
        where: { id: listingId },
        include: { player: true },
      });
      if (!listing) {
        throw new AppError(404, 'Listing not found');
      }
      if (listing.sellerId === userId) {
        throw new AppError(400, 'Cannot buy your own listing');
      }

      await settleMarketplaceSale(tx, {
        buyerId: userId,
        sellerId: listing.sellerId,
        currency: 'CASH',
        price: listing.price,
        reasonPrefix: 'MARKETPLACE',
        sourceType: 'MARKETPLACE_LISTING',
        sourceId: listingId,
        metadata: { playerId: listing.playerId, sportId: listing.sportId, sellerId: listing.sellerId },
      });
      // Remove player from seller's team only (not all teams)
      await tx.teamPlayer.deleteMany({
        where: { playerId: listing.playerId, team: { ownerId: listing.sellerId } },
      });
      // Assign player to buyer's team
      const buyerTeam = await tx.team.findFirst({
        where: { ownerId: userId, sportId: listing.sportId },
        select: { id: true },
      });
      if (buyerTeam) {
        await tx.teamPlayer.create({
          data: { teamId: buyerTeam.id, playerId: listing.playerId, isStarter: false },
        });
      }
      await tx.player.update({
        where: { id: listing.playerId },
        data: { lastSoldPrice: listing.price, priceUpdatedAt: new Date() },
      });
      await tx.marketplaceListing.update({
        where: { id: listingId },
        data: { status: 'SOLD', soldAt: new Date() },
      });
    });

    res.json({ status: 'success', message: 'Purchase successful' });
  })
);

// ── Offers ─────────────────────────────────────────────────────────────────

router.get(
  '/my-offers',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const offers = await prisma.marketplaceOffer.findMany({
      where: { buyerId: req.user!.id },
      include: {
        listing: {
          include: {
            player: true,
            seller: { select: { username: true } },
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
    const listings = await prisma.marketplaceListing.findMany({
      where: { sellerId: req.user!.id },
      include: {
        player: true,
        offers: {
          where: { status: 'PENDING' },
          include: {
            buyer: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: listings });
  })
);

router.post(
  '/:id/offer',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const listingId = routeParam(req.params.id, 'id');
    const schema = z.object({
      price: z.number().int().positive().min(100),
    });
    const input = schema.parse(req.body);
    const buyerId = req.user!.id;

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.status !== 'ACTIVE') {
      throw new AppError(404, 'Listing not found');
    }

    if (listing.sellerId === buyerId) {
      throw new AppError(400, 'Cannot make an offer on your own listing');
    }

    const existing = await prisma.marketplaceOffer.findFirst({
      where: { listingId, buyerId, status: 'PENDING' },
    });

    if (existing) {
      throw new AppError(409, 'You already have a pending offer on this listing');
    }

    const offer = await prisma.marketplaceOffer.create({
      data: {
        listingId,
        buyerId,
        price: input.price,
        status: 'PENDING',
      },
      include: {
        listing: { include: { player: true } },
        buyer: { select: { username: true } },
      },
    });

    res.status(201).json({ status: 'success', data: offer });
  })
);

router.post(
  '/offers/:id/accept',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const offerId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const offer = await prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: {
        listing: { include: { player: true } },
      },
    });

    if (!offer || offer.status !== 'PENDING') {
      throw new AppError(404, 'Offer not found');
    }

    if (offer.listing.sellerId !== userId) {
      throw new AppError(403, 'You do not own this listing');
    }

    await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.marketplaceListing.updateMany({
        where: { id: offer.listingId, status: 'ACTIVE' },
        data: { status: 'PENDING_SETTLEMENT' },
      });
      if (claimed.count !== 1) {
        throw new AppError(409, 'Listing already sold');
      }

      const accepted = await tx.marketplaceOffer.updateMany({
        where: { id: offerId, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      if (accepted.count !== 1) {
        throw new AppError(409, 'Offer already handled');
      }

      await settleMarketplaceSale(tx, {
        buyerId: offer.buyerId,
        sellerId: userId,
        currency: 'CASH',
        price: offer.price,
        reasonPrefix: 'MARKETPLACE_OFFER_ACCEPTED',
        sourceType: 'MARKETPLACE_OFFER',
        sourceId: offerId,
        metadata: { listingId: offer.listingId, playerId: offer.listing.playerId, sportId: offer.listing.sportId },
      });
      // Remove player from seller's team only
      await tx.teamPlayer.deleteMany({
        where: { playerId: offer.listing.playerId, team: { ownerId: userId } },
      });
      // Assign player to buyer's team
      const buyerTeamForOffer = await tx.team.findFirst({
        where: { ownerId: offer.buyerId, sportId: offer.listing.sportId },
        select: { id: true },
      });
      if (buyerTeamForOffer) {
        await tx.teamPlayer.create({
          data: { teamId: buyerTeamForOffer.id, playerId: offer.listing.playerId, isStarter: false },
        });
      }
      await tx.player.update({
        where: { id: offer.listing.playerId },
        data: { lastSoldPrice: offer.price, priceUpdatedAt: new Date() },
      });
      await tx.marketplaceListing.update({
        where: { id: offer.listingId },
        data: { status: 'SOLD', soldAt: new Date() },
      });
    });

    res.json({ status: 'success', message: 'Offer accepted' });
  })
);

router.post(
  '/offers/:id/reject',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const offerId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const offer = await prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: { listing: true },
    });

    if (!offer || offer.status !== 'PENDING') {
      throw new AppError(404, 'Offer not found');
    }

    if (offer.listing.sellerId !== userId) {
      throw new AppError(403, 'You do not own this listing');
    }

    await prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED' },
    });

    res.json({ status: 'success', message: 'Offer rejected' });
  })
);

router.post(
  '/offers/:id/cancel',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const offerId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const offer = await prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer || offer.status !== 'PENDING') {
      throw new AppError(404, 'Offer not found');
    }

    if (offer.buyerId !== userId) {
      throw new AppError(403, 'You did not make this offer');
    }

    await prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: 'CANCELLED' },
    });

    res.json({ status: 'success', message: 'Offer cancelled' });
  })
);

export { router as marketplaceRouter, calculatePlayerPrice };
