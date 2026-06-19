import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';

const router = Router();

const createListingSchema = z.object({
  playerId: z.string().uuid(),
  price: z.number().int().positive().min(100),
});

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20', rarity, position, minPrice, maxPrice } = req.query;

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
        orderBy: { createdAt: 'desc' },
        include: {
          player: true,
          seller: {
            select: { id: true, username: true },
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

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const input = createListingSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify player ownership
    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: {
        playerId: input.playerId,
        team: { ownerId: userId },
      },
    });

    if (!teamPlayer) {
      throw new AppError(403, 'You do not own this player');
    }

    // Check existing listings
    const existing = await prisma.marketplaceListing.findFirst({
      where: {
        playerId: input.playerId,
        sellerId: userId,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      throw new AppError(409, 'Player already listed on marketplace');
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerId: userId,
        playerId: input.playerId,
        price: input.price,
      },
      include: {
        player: true,
        seller: {
          select: { id: true, username: true },
        },
      },
    });

    res.status(201).json({ status: 'success', data: listing });
  })
);

router.post(
  '/:id/buy',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
      include: {
        seller: { include: { wallet: true } },
        player: true,
      },
    });

    if (!listing || listing.status !== 'ACTIVE') {
      throw new AppError(404, 'Listing not found or not active');
    }

    if (listing.sellerId === userId) {
      throw new AppError(400, 'Cannot buy your own listing');
    }

    const buyerWallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!buyerWallet || buyerWallet.cash < listing.price) {
      throw new AppError(400, 'Insufficient CASH');
    }

    // Check if buyer already has the player
    const existingPlayer = await prisma.teamPlayer.findFirst({
      where: {
        playerId: listing.playerId,
        team: { ownerId: userId },
      },
    });

    if (existingPlayer) {
      throw new AppError(400, 'You already own this player');
    }

    await prisma.$transaction(async (tx: any) => {
      // Deduct from buyer
      await tx.wallet.update({
        where: { userId },
        data: { cash: { decrement: listing.price } },
      });

      // Add to seller (minus 5% fee)
      const sellerAmount = Math.floor(listing.price * 0.95);
      await tx.wallet.update({
        where: { userId: listing.sellerId },
        data: { cash: { increment: sellerAmount } },
      });

      // Update listing
      await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: { status: 'SOLD', soldAt: new Date() },
      });

      // Remove player from seller's team
      await tx.teamPlayer.deleteMany({
        where: {
          playerId: listing.playerId,
          team: { ownerId: listing.sellerId },
        },
      });

      // Add to buyer's team (find first team or create one)
      const buyerTeam = await tx.team.findFirst({
        where: { ownerId: userId },
      });

      if (buyerTeam) {
        await tx.teamPlayer.create({
          data: {
            teamId: buyerTeam.id,
            playerId: listing.playerId,
            isStarter: false,
          },
        });
      }
    });

    res.json({ status: 'success', message: 'Purchase successful' });
  })
);

export const marketplaceRouter = router;
