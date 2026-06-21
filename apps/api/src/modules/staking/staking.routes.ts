import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import {
  getUserStakingStats,
  getPoolLeaderboard,
  stakeGrid,
  claimRewards,
  requestUnstake,
  completeUnstake,
  fundPool,
} from './staking.service';

const router = Router();

// GET /api/staking/stats — user's staking stats + pool info
router.get(
  '/stats',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const stats = await getUserStakingStats(req.user!.id);
    res.json({ status: 'success', data: stats });
  })
);

// GET /api/staking/leaderboard — global pool stats + top stakers
router.get(
  '/leaderboard',
  authMiddleware,
  asyncHandler(async (_req: any, res) => {
    const leaderboard = await getPoolLeaderboard();
    res.json({ status: 'success', data: leaderboard });
  })
);

// POST /api/staking/stake — stake GRID tokens
router.post(
  '/stake',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      amount: z.number().int().min(1),
    });
    const input = schema.parse(req.body);

    const result = await stakeGrid(req.user!.id, input.amount);

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Staked ${input.amount.toLocaleString()} GRID successfully`,
    });
  })
);

// POST /api/staking/claim — claim accrued rewards
router.post(
  '/claim',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const result = await claimRewards(req.user!.id);

    if (result.claimed === 0) {
      res.json({
        status: 'success',
        data: result,
        message: 'No rewards available to claim yet',
      });
    } else {
      res.json({
        status: 'success',
        data: result,
        message: `Claimed ${result.claimed.toLocaleString()} GRID rewards`,
      });
    }
  })
);

// POST /api/staking/unstake/request — request unstake (starts cooldown)
router.post(
  '/unstake/request',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const result = await requestUnstake(req.user!.id);

    res.json({
      status: 'success',
      data: result,
      message: 'Unstake requested. 24-hour cooldown started.',
    });
  })
);

// POST /api/staking/unstake/complete — complete unstake after cooldown
router.post(
  '/unstake/complete',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const result = await completeUnstake(req.user!.id);

    res.json({
      status: 'success',
      data: result,
      message: `Unstake complete. ${result.returned.toLocaleString()} GRID returned to wallet.`,
    });
  })
);

// POST /api/staking/fund — fund the pool (admin)
router.post(
  '/fund',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    // Check admin role
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MODERATOR') {
      throw new AppError(403, 'Admin access required');
    }

    const schema = z.object({
      amount: z.number().int().min(1),
      reason: z.string().optional(),
    });
    const input = schema.parse(req.body);

    const result = await fundPool(input.amount, input.reason);

    res.json({
      status: 'success',
      data: result,
      message: `Funded pool with ${input.amount.toLocaleString()} GRID`,
    });
  })
);

export const stakingRouter = router;
