import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { getLuckBreakdown, recalculateLuckScore } from './luck.service';

const router = Router();

// GET /api/luck — current luck breakdown
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const breakdown = await getLuckBreakdown(req.user!.id);
    res.json({ status: 'success', data: breakdown });
  })
);

// POST /api/luck/recalculate — refresh score after major wallet changes
router.post(
  '/recalculate',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const breakdown = await recalculateLuckScore(req.user!.id);
    res.json({ status: 'success', data: breakdown });
  })
);

export { router as luckRouter };
