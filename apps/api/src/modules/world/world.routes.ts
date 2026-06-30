import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import * as worldService from './world.service';

const router = Router();

// Get current user's stadium
router.get(
  '/my-stadium',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const stadium = await worldService.getMyStadium(req.user!.id);
    res.json({ status: 'success', data: stadium });
  })
);

// Get all other players' stadiums
router.get(
  '/stadiums',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const stadiums = await worldService.getOtherStadiums(req.user!.id);
    res.json({ status: 'success', data: stadiums });
  })
);

// Get live/upcoming matches
router.get(
  '/matches',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    const matches = await worldService.getLiveMatches();
    res.json({ status: 'success', data: matches });
  })
);

// Get online players backed by persisted socket presence
router.get(
  '/players',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const players = await worldService.getOnlinePlayers(req.user!.id);
    res.json({ status: 'success', data: players });
  })
);

// REST fallback for avatar movement when sockets are reconnecting
router.post(
  '/avatar',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      x: z.number().min(-900).max(900),
      y: z.number().min(-650).max(650),
      targetX: z.number().min(-900).max(900).optional(),
      targetY: z.number().min(-650).max(650).optional(),
      facing: z.enum(['left', 'right', 'up', 'down']).optional(),
    });
    const input = schema.parse(req.body);
    const player = await worldService.upsertAvatarPresence({
      userId: req.user!.id,
      username: req.user!.username,
      x: input.x,
      y: input.y,
      targetX: input.targetX,
      targetY: input.targetY,
      facing: input.facing,
    });
    res.json({ status: 'success', data: player });
  })
);

export { router as worldRouter };
