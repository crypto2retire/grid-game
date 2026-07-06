import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest, requireRole } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import {
  runTestSeason,
  getEconomicAudit,
  getPlayerDevelopmentAudit,
  resetTestSeason,
  resetEconomy,
  processWeeklyOperatingCosts,
  runMegaSimulation,
} from './testing.service';
import { runMegaSimulationV2 } from './mega-simulation.service';

const router = Router();

// POST /api/testing/season — run a test season
router.post(
  '/season',
  authMiddleware,
  requireRole('ADMIN'),
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

// POST /api/testing/mega-simulation — run full 250-user, 5-season mega simulation
router.post(
  '/mega-simulation',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      userCount: z.number().int().min(10).max(500).default(250),
      seasonCount: z.number().int().min(1).max(10).default(5),
    });
    const input = schema.parse(req.body);

    const result = await runMegaSimulation(input.userCount, input.seasonCount);

    res.json({
      status: 'success',
      data: result,
      message: `Mega simulation complete: ${result.usersCreated} users, ${result.seasons.length} seasons`,
    });
  })
);

// POST /api/testing/mega-simulation-v2 — run enhanced 250-user, 5-season simulation with all features
router.post(
  '/mega-simulation-v2',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      userCount: z.number().int().min(10).max(500).default(250),
      seasonCount: z.number().int().min(1).max(10).default(5),
      throttleMs: z.number().int().min(0).max(5000).default(0),
    });
    const input = schema.parse(req.body);

    const result = await runMegaSimulationV2(input.userCount, input.seasonCount, input.throttleMs);

    res.json({
      status: 'success',
      data: result,
      message: `Mega simulation V2 complete: ${result.usersCreated} users, ${result.seasons.length} seasons, ${result.totalPlayers} players`,
    });
  })
);

// GET /api/testing/audit/economics — full economic audit
router.get(
  '/audit/economics',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (_req: AuthRequest, res) => {
    const audit = await getEconomicAudit();
    res.json({ status: 'success', data: audit });
  })
);

// GET /api/testing/audit/players — player development audit
router.get(
  '/audit/players',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (_req: AuthRequest, res) => {
    const audit = await getPlayerDevelopmentAudit();
    res.json({ status: 'success', data: audit });
  })
);

// POST /api/testing/reset — reset test season data
router.post(
  '/reset',
  authMiddleware,
  requireRole('ADMIN'),
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
  requireRole('ADMIN'),
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
  requireRole('ADMIN'),
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
  requireRole('ADMIN'),
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
        gameOwnerGrid: gameOwnerWallet?.dynTokens || 0,
      },
    });
  })
);

// POST /api/testing/qa/injure-player — create deterministic self-owned injury data for UI QA.
// Restricted to admin users or obvious disposable QA accounts so production users cannot grief other teams.
router.post(
  '/qa/injure-player',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      playerId: z.string().uuid(),
      injuryStatus: z.enum(['MINOR', 'MODERATE', 'MAJOR', 'SEASON_ENDING']).default('MODERATE'),
      injuryType: z.string().min(1).max(80).default('QA Test Injury'),
      injuryWeeks: z.number().int().min(1).max(12).default(2),
      health: z.number().int().min(1).max(99).default(62),
    });
    const input = schema.parse(req.body ?? {});
    const user = req.user!;
    const isQaUser = user.role === 'ADMIN' || user.email.endsWith('@example.com') || /^qa|^gridqa|^injqa/i.test(user.username);
    if (!isQaUser) {
      throw new AppError(403, 'QA injury mutation is restricted to disposable QA accounts');
    }

    const teamPlayer = await prisma.teamPlayer.findFirst({
      where: { playerId: input.playerId, team: { ownerId: user.id } },
      include: { team: { select: { id: true, name: true } }, player: true },
    });
    if (!teamPlayer) {
      throw new AppError(404, 'Self-owned player not found');
    }

    const player = await prisma.player.update({
      where: { id: input.playerId },
      data: {
        health: input.health,
        injuryStatus: input.injuryStatus,
        injuryType: input.injuryType,
        injuryWeeks: input.injuryWeeks,
      },
    });

    res.json({
      status: 'success',
      data: {
        teamId: teamPlayer.team.id,
        teamName: teamPlayer.team.name,
        player,
      },
      message: `${player.name} marked injured for QA verification`,
    });
  })
);

export const testingRouter = router;
