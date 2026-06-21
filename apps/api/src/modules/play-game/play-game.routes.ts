import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import {
  initializePlayableMatch,
  setLineupAndStyles,
  resolvePlay,
  simulateRemainder,
  completeGame,
  getGameState,
} from './play-game.service';

const router = Router();

// GET /api/play-game/:matchId/state — get current game state
router.get(
  '/:matchId/state',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const state = await getGameState(req.params.matchId);
    res.json({ status: 'success', data: state });
  })
);

// POST /api/play-game/:matchId/init — initialize a match as playable
router.post(
  '/:matchId/init',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      select: { homeTeamId: true, awayTeamId: true },
    });

    if (!match) {
      throw new AppError(404, 'Match not found');
    }

    // Determine which team the user owns
    const userTeams = await prisma.team.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true },
    });
    const userTeamIds = userTeams.map((t) => t.id);
    const userTeamId = userTeamIds.includes(match.homeTeamId)
      ? match.homeTeamId
      : userTeamIds.includes(match.awayTeamId)
      ? match.awayTeamId
      : match.homeTeamId; // fallback

    const result = await initializePlayableMatch(req.params.matchId, userTeamId);

    res.json({
      status: 'success',
      data: result,
      message: 'Game initialized',
    });
  })
);

// POST /api/play-game/:matchId/lineup — set lineups and start game
router.post(
  '/:matchId/lineup',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      offensiveLineup: z.array(z.string()),
      defensiveLineup: z.array(z.string()),
      offensiveStyle: z.enum(['balanced', 'runHeavy', 'passHeavy']),
      defensiveStyle: z.enum(['balanced', 'aggressive', 'conservative']),
    });
    const input = schema.parse(req.body);

    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      select: { userTeamId: true },
    });

    if (!match) {
      throw new AppError(404, 'Match not found');
    }

    const result = await setLineupAndStyles(
      req.params.matchId,
      match.userTeamId || '',
      input.offensiveLineup,
      input.defensiveLineup,
      input.offensiveStyle,
      input.defensiveStyle
    );

    res.json({
      status: 'success',
      data: result,
      message: 'Lineup set. Game started!',
    });
  })
);

// POST /api/play-game/:matchId/play — submit a play
router.post(
  '/:matchId/play',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      playType: z.enum(['RUN_LEFT', 'RUN_MIDDLE', 'RUN_RIGHT', 'QB_DRAW', 'SHORT_PASS', 'MEDIUM_PASS', 'DEEP_BALL', 'SCREEN']),
      direction: z.string().optional(),
    });
    const input = schema.parse(req.body);

    const result = await resolvePlay(req.params.matchId, input.playType, input.direction);

    res.json({
      status: 'success',
      data: result,
    });
  })
);

// POST /api/play-game/:matchId/sim — simulate remainder of game
router.post(
  '/:matchId/sim',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const result = await simulateRemainder(req.params.matchId);

    res.json({
      status: 'success',
      data: result,
      message: 'Game simulated to completion',
    });
  })
);

// POST /api/play-game/:matchId/complete — finalize game and calculate development
router.post(
  '/:matchId/complete',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const result = await completeGame(req.params.matchId);

    res.json({
      status: 'success',
      data: result,
      message: 'Game completed',
    });
  })
);

export const playGameRouter = router;
