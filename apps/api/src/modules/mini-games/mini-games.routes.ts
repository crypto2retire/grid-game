import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { getMiniGameCatalog, getMiniGameHistory, playMiniGame } from './mini-games.service';

const router = Router();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    res.json({ status: 'success', data: getMiniGameCatalog() });
  })
);

router.get(
  '/history',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const history = await getMiniGameHistory(req.user!.id);
    res.json({ status: 'success', data: history });
  })
);

router.post(
  '/play',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({ miniGameType: z.string().min(1).max(32) });
    const input = schema.parse(req.body);
    const result = await playMiniGame(req.user!.id, input.miniGameType);
    res.status(201).json({ status: 'success', data: result, message: `${result.miniGame.label}: ${result.outcome}` });
  })
);

export const miniGamesRouter = router;
