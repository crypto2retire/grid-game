import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import {
  listTeamForSale,
  buyTeamFromMarketplace,
  cancelTeamListing,
  getTeamMarketplaceListings,
  getTeamMarketplaceListing,
  getUserTeamListings,
} from './team-marketplace.service';

const router = Router();

// GET /api/team-marketplace — browse teams for sale by players
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const tier = req.query.tier as string | undefined;
    const sportId = req.query.sportId as string | undefined;
    const listings = await getTeamMarketplaceListings({ tier, sportId });
    res.json({ status: 'success', data: listings });
  })
);

// GET /api/team-marketplace/my-listings — user's active listings
router.get(
  '/my-listings',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const listings = await getUserTeamListings(req.user!.id);
    res.json({ status: 'success', data: listings });
  })
);

// GET /api/team-marketplace/:id — single listing details
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const listing = await getTeamMarketplaceListing(req.params.id);
    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }
    res.json({ status: 'success', data: listing });
  })
);

// POST /api/team-marketplace/list — list a team for sale
router.post(
  '/list',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      teamId: z.string(),
      price: z.number().int().min(1),
      currency: z.enum(['DYN', 'SOL']),
    });
    const input = schema.parse(req.body);

    const result = await listTeamForSale(req.user!.id, input.teamId, input.price, input.currency);

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Team listed for ${input.price.toLocaleString()} ${input.currency}`,
    });
  })
);

// POST /api/team-marketplace/buy — buy a team from marketplace
router.post(
  '/buy',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      listingId: z.string(),
    });
    const input = schema.parse(req.body);

    const result = await buyTeamFromMarketplace(req.user!.id, input.listingId);

    res.json({
      status: 'success',
      data: result,
      message: `Team purchased for ${result.price.toLocaleString()} ${result.currency}`,
    });
  })
);

// POST /api/team-marketplace/cancel — cancel a listing
router.post(
  '/cancel',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      listingId: z.string(),
    });
    const input = schema.parse(req.body);

    const result = await cancelTeamListing(req.user!.id, input.listingId);

    res.json({
      status: 'success',
      data: result,
      message: 'Listing cancelled',
    });
  })
);

export const teamMarketplaceRouter = router;
