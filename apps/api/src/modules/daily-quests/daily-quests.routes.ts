import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
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
    const questId = routeParam(req.params.questId, 'questId');
    const result = await claimDailyQuest(req.user!.id, questId);
    res.json({ status: 'success', data: result, message: 'Daily payout eligibility unlocked' });
  })
);

export const dailyQuestsRouter = router;
