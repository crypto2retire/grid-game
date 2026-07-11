import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { securityActionLock } from '../../middleware/securityActionLock';
import {
  initializePlayableMatch,
  setLineupAndStyles,
  resolvePlay,
  simulateRemainder,
  completeGame,
  getGameState,
} from './play-game.service';

const router = Router();
const matchMutationLock = securityActionLock((req) => `match:${req.params.matchId}`, 180_000);

async function assertMatchParticipant(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { ownerId: true } },
      awayTeam: { select: { ownerId: true } },
    },
  });

  if (!match) throw new AppError(404, 'Match not found');

  const userTeamId =
    match.homeTeam.ownerId === userId ? match.homeTeamId :
    match.awayTeam.ownerId === userId ? match.awayTeamId :
    null;

  if (!userTeamId) throw new AppError(403, 'You are not a participant in this match');
  return { match, userTeamId };
}

router.get(
  '/:matchId/state',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    await assertMatchParticipant(req.params.matchId, req.user!.id);
    const state = await getGameState(req.params.matchId);
    res.json({ status: 'success', data: state });
  }),
);

router.post(
  '/:matchId/init',
  authMiddleware,
  matchMutationLock,
  asyncHandler(async (req: any, res) => {
    const { userTeamId } = await assertMatchParticipant(req.params.matchId, req.user!.id);
    const result = await initializePlayableMatch(req.params.matchId, userTeamId);
    res.json({ status: 'success', data: result, message: 'Game initialized' });
  }),
);

router.post(
  '/:matchId/lineup',
  authMiddleware,
  matchMutationLock,
  asyncHandler(async (req: any, res) => {
    const input = z.object({
      offensiveLineup: z.array(z.string()).max(60),
      defensiveLineup: z.array(z.string()).max(60),
      offensiveStyle: z.enum(['balanced', 'runHeavy', 'passHeavy']),
      defensiveStyle: z.enum(['balanced', 'aggressive', 'conservative']),
    }).parse(req.body);

    const { userTeamId } = await assertMatchParticipant(req.params.matchId, req.user!.id);
    const result = await setLineupAndStyles(
      req.params.matchId,
      userTeamId,
      input.offensiveLineup,
      input.defensiveLineup,
      input.offensiveStyle,
      input.defensiveStyle,
    );
    res.json({ status: 'success', data: result, message: 'Lineup set. Game started!' });
  }),
);

router.post(
  '/:matchId/play',
  authMiddleware,
  matchMutationLock,
  asyncHandler(async (req: any, res) => {
    const input = z.object({
      playType: z.enum(['RUN_LEFT', 'RUN_MIDDLE', 'RUN_RIGHT', 'QB_DRAW', 'SHORT_PASS', 'MEDIUM_PASS', 'DEEP_BALL', 'SCREEN', 'PUNT', 'FIELD_GOAL']),
      direction: z.string().max(24).optional(),
    }).parse(req.body);

    await assertMatchParticipant(req.params.matchId, req.user!.id);
    const result = await resolvePlay(req.params.matchId, input.playType, input.direction);
    res.json({ status: 'success', data: result });
  }),
);

router.post(
  '/:matchId/sim',
  authMiddleware,
  matchMutationLock,
  asyncHandler(async (req: any, res) => {
    await assertMatchParticipant(req.params.matchId, req.user!.id);
    const result = await simulateRemainder(req.params.matchId);
    res.json({ status: 'success', data: result, message: 'Game simulated to completion' });
  }),
);

router.post(
  '/:matchId/complete',
  authMiddleware,
  matchMutationLock,
  asyncHandler(async (req: any, res) => {
    await assertMatchParticipant(req.params.matchId, req.user!.id);
    const result = await completeGame(req.params.matchId);
    res.json({ status: 'success', data: result, message: 'Game completed' });
  }),
);

export const playGameRouter = router;
