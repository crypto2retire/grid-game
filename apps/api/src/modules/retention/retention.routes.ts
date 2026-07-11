import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  JOURNEY_STAGES,
  claimDailyChest,
  claimSeasonMilestone,
  completeJourneyStage,
  getFacilityModifiers,
  getRetentionState,
  getSeasonState,
} from './retention.service';

const router = Router();
router.use(authMiddleware);

const stageSchema = z.object({ stage: z.enum(JOURNEY_STAGES) });
const milestoneSchema = z.object({ milestoneId: z.string().min(1) });

function idempotencyKey(req: AuthRequest) {
  const header = req.get('Idempotency-Key') || req.get('X-Idempotency-Key');
  if (!header) throw new Error('Idempotency-Key header is required');
  return header;
}

router.get('/state', asyncHandler(async (req: AuthRequest, res) => {
  const state = await getRetentionState(req.user!.id);
  res.json({ status: 'success', data: state });
}));

router.post('/journey/stages', asyncHandler(async (req: AuthRequest, res) => {
  const { stage } = stageSchema.parse(req.body);
  const result = await completeJourneyStage(req.user!.id, stage);
  res.json({ status: 'success', data: result });
}));

router.post('/daily-chest/claim', asyncHandler(async (req: AuthRequest, res) => {
  const result = await claimDailyChest(req.user!.id, idempotencyKey(req));
  res.json({ status: 'success', data: result });
}));

router.get('/season', asyncHandler(async (req: AuthRequest, res) => {
  const state = await getSeasonState(req.user!.id);
  res.json({ status: 'success', data: state });
}));

router.post('/season/milestones/claim', asyncHandler(async (req: AuthRequest, res) => {
  const { milestoneId } = milestoneSchema.parse(req.body);
  const result = await claimSeasonMilestone(req.user!.id, milestoneId, idempotencyKey(req));
  res.json({ status: 'success', data: result });
}));

router.get('/facility-modifiers', asyncHandler(async (_req: AuthRequest, res) => {
  const modifiers = await getFacilityModifiers();
  res.json({ status: 'success', data: modifiers });
}));

export const retentionRouter = router;
