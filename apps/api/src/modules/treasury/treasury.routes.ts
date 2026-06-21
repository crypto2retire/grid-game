import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { getTreasuryReport } from './treasury.service';

const router = Router();

// GET /api/treasury/report — full treasury report (admin only or public)
router.get(
  '/report',
  authMiddleware,
  asyncHandler(async (_req: any, res) => {
    const report = await getTreasuryReport();
    res.json({ status: 'success', data: report });
  })
);

// GET /api/treasury/balances — just the balances
router.get(
  '/balances',
  asyncHandler(async (_req, res) => {
    const treasuries = await prisma.gameTreasury.findMany({
      orderBy: { currency: 'asc' },
    });
    res.json({ status: 'success', data: treasuries });
  })
);

export const treasuryRouter = router;
