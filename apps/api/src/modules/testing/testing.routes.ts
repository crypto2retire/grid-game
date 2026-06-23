import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  runTestSeason,
  getEconomicAudit,
  getPlayerDevelopmentAudit,
  resetTestSeason,
  resetEconomy,
  processWeeklyOperatingCosts,
} from './testing.service';

const router = Router();

// POST /api/testing/season — run a test season
router.post(
  '/season',
  authMiddleware,
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
  asyncHandler(async (_req: AuthRequest, res) => {
    const audit = await getEconomicAudit();
    res.json({ status: 'success', data: audit });
  })
);

// GET /api/testing/audit/players — player development audit
router.get(
  '/audit/players',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const audit = await getPlayerDevelopmentAudit();
    res.json({ status: 'success', data: audit });
  })
);

// POST /api/testing/reset — reset test season data
router.post(
  '/reset',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const result = await resetTestSeason();
    res.json({
      status: 'success',
      data: result,
      message: `Reset complete: ${result.deletedMatches} test matches deleted`,
    });
  })
);

// POST /api/testing/economy/reset — reset all wallet balances to start fresh
router.post(
  '/economy/reset',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const result = await resetEconomy();
    res.json({
      status: 'success',
      data: result,
      message: `Economy reset: ${result.resetWallets} wallets set to 1,000 CASH, AI owner set to 0`,
    });
  })
);

// POST /api/testing/economy/weekly-costs — run weekly operating costs
router.post(
  '/economy/weekly-costs',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const result = await processWeeklyOperatingCosts();
    res.json({
      status: 'success',
      data: result,
      message: `Weekly costs processed for ${result.processedTeams} teams`,
    });
  })
);

// GET /api/testing/status — quick status check
router.get(
  '/status',
  authMiddleware,
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
