import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import {
  runTestSeason,
  getEconomicAudit,
  getPlayerDevelopmentAudit,
  resetTestSeason,
} from './testing.service';

const router = Router();

// Admin-only middleware
function adminOnly(req: AuthRequest, _res: any, next: any) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR')) {
    return next(new AppError(403, 'Admin access required'));
  }
  next();
}

// POST /api/testing/season — run a test season
router.post(
  '/season',
  authMiddleware,
  adminOnly,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      gameCount: z.number().int().min(1).max(100).default(20),
    });
    const input = schema.parse(req.body);

    const result = await runTestSeason(input.gameCount);

    res.json({
      status: 'success',
      data: result,
      message: `Test season completed: ${result.matchesPlayed} matches played`,
    });
  })
);

// GET /api/testing/audit/economics — full economic audit
router.get(
  '/audit/economics',
  authMiddleware,
  adminOnly,
  asyncHandler(async (_req: AuthRequest, res) => {
    const audit = await getEconomicAudit();
    res.json({ status: 'success', data: audit });
  })
);

// GET /api/testing/audit/players — player development audit
router.get(
  '/audit/players',
  authMiddleware,
  adminOnly,
  asyncHandler(async (_req: AuthRequest, res) => {
    const audit = await getPlayerDevelopmentAudit();
    res.json({ status: 'success', data: audit });
  })
);

// POST /api/testing/reset — reset test season data
router.post(
  '/reset',
  authMiddleware,
  adminOnly,
  asyncHandler(async (_req: AuthRequest, res) => {
    const result = await resetTestSeason();
    res.json({
      status: 'success',
      data: result,
      message: `Reset complete: ${result.deletedMatches} test matches deleted`,
    });
  })
);

// GET /api/testing/status — quick status check
router.get(
  '/status',
  authMiddleware,
  adminOnly,
  asyncHandler(async (_req: AuthRequest, res) => {
    const aiTeamCount = await prisma.team.count({ where: { isAI: true } });
    const playerCount = await prisma.player.count();
    const matchCount = await prisma.match.count({ where: { status: 'COMPLETED' } });
    const testMatchCount = await prisma.match.count({ where: { id: { startsWith: 'test-match-' } } });
    const treasury = await prisma.gameTreasury.findFirst({ where: { currency: 'CASH' } });
    const gameOwnerWallet = await prisma.wallet.findUnique({ where: { userId: 'ai-system-owner-001' } });

    res.json({
      status: 'success',
      data: {
        aiTeams: aiTeamCount,
        totalPlayers: playerCount,
        completedMatches: matchCount,
        testMatches: testMatchCount,
        treasuryBalance: treasury?.balance || 0,
        gameOwnerCash: gameOwnerWallet?.cash || 0,
        gameOwnerGrid: gameOwnerWallet?.gridTokens || 0,
      },
    });
  })
);

export const testingRouter = router;
