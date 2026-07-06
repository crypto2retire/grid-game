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

async function assertMatchParticipant(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { ownerId: true } },
      awayTeam: { select: { ownerId: true } },
    },
  });

  if (!match) {
    throw new AppError(404, 'Match not found');
  }

  const userTeamId =
    match.homeTeam.ownerId === userId ? match.homeTeamId :
    match.awayTeam.ownerId === userId ? match.awayTeamId :
    null;

  if (!userTeamId) {
    throw new AppError(403, 'You are not a participant in this match');
  }

  return { match, userTeamId };
}

// GET /api/play-game/:matchId/state — get current game state
router.get(
  '/:matchId/state',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    await assertMatchParticipant(req.params.matchId, req.user!.id);
    const state = await getGameState(req.params.matchId);
    res.json({ status: 'success', data: state });
  })
);

// POST /api/play-game/:matchId/init — initialize a match as playable
router.post(
  '/:matchId/init',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const { userTeamId } = await assertMatchParticipant(req.params.matchId, req.user!.id);

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

    const { userTeamId } = await assertMatchParticipant(req.params.matchId, req.user!.id);

    const result = await setLineupAndStyles(
      req.params.matchId,
      userTeamId,
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
      playType: z.enum(['RUN_LEFT', 'RUN_MIDDLE', 'RUN_RIGHT', 'QB_DRAW', 'SHORT_PASS', 'MEDIUM_PASS', 'DEEP_BALL', 'SCREEN', 'PUNT', 'FIELD_GOAL']),
      direction: z.string().optional(),
    });
    const input = schema.parse(req.body);

    await assertMatchParticipant(req.params.matchId, req.user!.id);
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
    await assertMatchParticipant(req.params.matchId, req.user!.id);
    try {
      const result = await simulateRemainder(req.params.matchId);
      res.json({
        status: 'success',
        data: result,
        message: 'Game simulated to completion',
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        message: err?.message || 'Simulation failed',
        stack: err?.stack || null,
      });
    }
  })
);

// POST /api/play-game/:matchId/complete — finalize game and calculate development
router.post(
  '/:matchId/complete',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    await assertMatchParticipant(req.params.matchId, req.user!.id);
    const result = await completeGame(req.params.matchId);

    res.json({
      status: 'success',
      data: result,
      message: 'Game completed',
    });
  })
);

export const playGameRouter = router;
