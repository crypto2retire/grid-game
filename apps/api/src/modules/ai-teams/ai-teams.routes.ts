import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  getMatchmakingOptions,
  scheduleAIMatch,
  scheduleLiveMatch,
} from './ai-teams.service';

const router = Router();

// GET /api/ai-teams/matchmaking/:teamId — get available opponents for a team
router.get(
  '/matchmaking/:teamId',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const options = await getMatchmakingOptions(req.user!.id, req.params.teamId);
    res.json({ status: 'success', data: options });
  })
);

// POST /api/ai-teams/schedule/ai — schedule against AI opponent
router.post(
  '/schedule/ai',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      userTeamId: z.string(),
      aiTeamId: z.string(),
    });
    const input = schema.parse(req.body);

    const match = await scheduleAIMatch(req.user!.id, input.userTeamId, input.aiTeamId);

    res.status(201).json({
      status: 'success',
      data: match,
      message: 'Match scheduled vs AI opponent',
    });
  })
);

// POST /api/ai-teams/schedule/live — schedule against live player
router.post(
  '/schedule/live',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      homeTeamId: z.string(),
      awayTeamId: z.string(),
    });
    const input = schema.parse(req.body);

    const match = await scheduleLiveMatch(req.user!.id, input.homeTeamId, input.awayTeamId);

    res.status(201).json({
      status: 'success',
      data: match,
      message: 'Match scheduled vs live opponent',
    });
  })
);

export const aiTeamsRouter = router;
