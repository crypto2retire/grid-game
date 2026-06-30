import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { claimDailyQuest, getDailyQuestsForUser } from './daily-quests.service';

const router = Router();

router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const quests = await getDailyQuestsForUser(req.user!.id);
    res.json({ status: 'success', data: quests });
  })
);

router.post(
  '/:questId/claim',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await claimDailyQuest(req.user!.id, req.params.questId);
    res.json({ status: 'success', data: result, message: 'Daily quest reward claimed' });
  })
);

export const dailyQuestsRouter = router;
