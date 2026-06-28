import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import * as worldService from './world.service';

const router = Router();

// Get current user's stadium
router.get(
  '/my-stadium',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const stadium = await worldService.getMyStadium(req.user!.id);
    res.json({ status: 'success', data: stadium });
  })
);

// Get all other players' stadiums
router.get(
  '/stadiums',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const stadiums = await worldService.getOtherStadiums(req.user!.id);
    res.json({ status: 'success', data: stadiums });
  })
);

// Get live/upcoming matches
router.get(
  '/matches',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const matches = await worldService.getLiveMatches();
    res.json({ status: 'success', data: matches });
  })
);

// Get online players (for now, just returns empty list - socket handles real-time)
router.get(
  '/players',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    res.json({ status: 'success', data: [] });
  })
);

export { router as worldRouter };
