import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { tokenGate } from '../../middleware/tokenGate';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import { recordCurrencyLedger } from './ledger';

const router = Router();

// 5% marketplace fee: 90% treasury / 10% burn
const MARKETPLACE_FEE_PCT = 0.05;
const TREASURY_SHARE = 0.9;

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

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { player: true },
    });

    if (!listing || listing.status !== 'ACTIVE') {
      throw new AppError(404, 'Listing not found or already sold');
    }

    if (listing.sellerId === userId) {
      throw new AppError(400, 'Cannot buy your own listing');
    }

    const buyerWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!buyerWallet || buyerWallet.cash < listing.price) {
      throw new AppError(400, 'Insufficient CASH');
    }

    await prisma.$transaction(async (tx: any) => {
      // 5% marketplace fee: 90% treasury / 10% burn
      const fee = Math.ceil(listing.price * MARKETPLACE_FEE_PCT);
      const sellerReceives = listing.price - fee;

      // Deduct full price from buyer
      const buyerWalletAfter = await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: listing.price } },
      });
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -listing.price,
        balanceAfter: buyerWalletAfter.cash,
        reason: 'MARKETPLACE_PURCHASE',
        sourceType: 'MARKETPLACE_LISTING',
        sourceId: listingId,
        metadata: { playerId: listing.playerId, sportId: listing.sportId, fee },
      });
      // Credit seller (price minus fee)
      const sellerWalletAfter = await tx.wallet.update({
        where: { userId: listing.sellerId },
        data: { cash: { increment: sellerReceives } },
      });
      await recordCurrencyLedger(tx, {
        userId: listing.sellerId,
        currency: 'CASH',
        amount: sellerReceives,
        balanceAfter: sellerWalletAfter.cash,
        reason: 'MARKETPLACE_SALE',
        sourceType: 'MARKETPLACE_LISTING',
        sourceId: listingId,
        metadata: { buyerId: userId, playerId: listing.playerId, sportId: listing.sportId, fee },
      });

      // Record fee to treasury (90%) and burn (10%)
      const treasuryAmount = Math.floor(fee * TREASURY_SHARE);
      const burnAmount = fee - treasuryAmount;
      await tx.gameTreasury.upsert({
        where: { currency: 'CASH' },
        update: { balance: { increment: treasuryAmount }, totalInflows: { increment: treasuryAmount } },
        create: { currency: 'CASH', balance: treasuryAmount, totalInflows: treasuryAmount },
      });
      await tx.treasuryTransaction.create({
        data: {
          treasury: { connect: { currency: 'CASH' } },
          type: 'INFLOW',
          amount: treasuryAmount,
          currency: 'CASH',
          reason: 'MARKETPLACE_PLAYER_FEE',
          sourceType: 'MARKETPLACE_LISTING',
          sourceId: listingId,
          metadata: { playerId: listing.playerId, buyerId: userId, sellerId: listing.sellerId },
        },
      });
      if (burnAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            treasury: { connect: { currency: 'CASH' } },
            type: 'BURN',
            amount: burnAmount,
            currency: 'CASH',
            reason: 'MARKETPLACE_PLAYER_FEE_BURN',
            sourceType: 'MARKETPLACE_LISTING',
            sourceId: listingId,
          },
        });
      }
      await tx.marketplaceListing.update({
        where: { id: listingId },
        data: { status: 'SOLD', soldAt: new Date() },
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

    const buyerWallet = await prisma.wallet.findUnique({ where: { userId: offer.buyerId } });
    if (!buyerWallet || buyerWallet.cash < offer.price) {
      throw new AppError(400, 'Buyer has insufficient CASH');
    }

    await prisma.$transaction(async (tx: any) => {
      // 5% marketplace fee: 90% treasury / 10% burn
      const fee = Math.ceil(offer.price * MARKETPLACE_FEE_PCT);
      const sellerReceives = offer.price - fee;

      const buyerWalletAfter = await tx.wallet.update({
        where: { userId: offer.buyerId },
        data: { cash: { decrement: offer.price } },
      });
      await recordCurrencyLedger(tx, {
        userId: offer.buyerId,
        currency: 'CASH',
        amount: -offer.price,
        balanceAfter: buyerWalletAfter.cash,
        reason: 'MARKETPLACE_OFFER_ACCEPTED_PURCHASE',
        sourceType: 'MARKETPLACE_OFFER',
        sourceId: offerId,
        metadata: { listingId: offer.listingId, playerId: offer.listing.playerId, sportId: offer.listing.sportId, fee },
      });
      const sellerWalletAfter = await tx.wallet.update({
        where: { userId },
        data: { cash: { increment: sellerReceives } },
      });
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: sellerReceives,
        balanceAfter: sellerWalletAfter.cash,
        reason: 'MARKETPLACE_OFFER_ACCEPTED_SALE',
        sourceType: 'MARKETPLACE_OFFER',
        sourceId: offerId,
        metadata: { listingId: offer.listingId, buyerId: offer.buyerId, playerId: offer.listing.playerId, sportId: offer.listing.sportId, fee },
      });

      // Record fee to treasury (90%) and burn (10%)
      const treasuryAmount = Math.floor(fee * TREASURY_SHARE);
      const burnAmount = fee - treasuryAmount;
      await tx.gameTreasury.upsert({
        where: { currency: 'CASH' },
        update: { balance: { increment: treasuryAmount }, totalInflows: { increment: treasuryAmount } },
        create: { currency: 'CASH', balance: treasuryAmount, totalInflows: treasuryAmount },
      });
      await tx.treasuryTransaction.create({
        data: {
          treasury: { connect: { currency: 'CASH' } },
          type: 'INFLOW',
          amount: treasuryAmount,
          currency: 'CASH',
          reason: 'MARKETPLACE_OFFER_FEE',
          sourceType: 'MARKETPLACE_OFFER',
          sourceId: offerId,
          metadata: { listingId: offer.listingId, playerId: offer.listing.playerId, buyerId: offer.buyerId, sellerId: userId },
        },
      });
      if (burnAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            treasury: { connect: { currency: 'CASH' } },
            type: 'BURN',
            amount: burnAmount,
            currency: 'CASH',
            reason: 'MARKETPLACE_OFFER_FEE_BURN',
            sourceType: 'MARKETPLACE_OFFER',
            sourceId: offerId,
          },
        });
      }
      await tx.marketplaceOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' },
      });
      await tx.marketplaceListing.update({
        where: { id: offer.listingId },
        data: { status: 'SOLD', soldAt: new Date() },
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
