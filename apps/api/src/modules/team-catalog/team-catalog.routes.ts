import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import {
  getTeamCatalog,
  getCatalogEntry,
  getTierEligibility,
  buyTeamFromCatalog,
  getTeamWithRoster,
} from './team-catalog.service';

const router = Router();

// GET /api/teams/catalog — browse available teams from the game
router.get(
  '/catalog',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const tier = req.query.tier as string | undefined;
    const catalog = await getTeamCatalog({ tier });
    res.json({ status: 'success', data: catalog });
  })
);

// GET /api/teams/catalog/:id — single catalog entry
router.get(
  '/catalog/:id',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const entry = await getCatalogEntry(req.params.id);
    if (!entry) {
      throw new AppError(404, 'Catalog entry not found');
    }
    res.json({ status: 'success', data: entry });
  })
);

// GET /api/teams/eligibility — check what tiers the user can buy
router.get(
  '/eligibility',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const eligibility = await getTierEligibility(req.user!.id);
    res.json({ status: 'success', data: eligibility });
  })
);

// POST /api/teams/buy — buy a team from the catalog
router.post(
  '/buy',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      catalogId: z.string(),
      currency: z.enum(['DYN', 'SOL']),
    });
    const input = schema.parse(req.body);

    const result = await buyTeamFromCatalog(req.user!.id, input.catalogId, input.currency);

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Purchased ${result.catalog.name} for ${result.catalog.tier === 'STATE_COLLEGE' ? 'FREE' : `${result.team.purchasePrice.toLocaleString()} ${input.currency}`}`,
    });
  })
);

// GET /api/teams/:id/roster — full team details with roster
router.get(
  '/:id/roster',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const team = await getTeamWithRoster(req.params.id);
    if (!team) {
      throw new AppError(404, 'Team not found');
    }
    res.json({ status: 'success', data: team });
  })
);

export const teamCatalogRouter = router;
