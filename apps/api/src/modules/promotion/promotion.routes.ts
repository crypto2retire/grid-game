import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import {
  checkPromotionEligibility,
  promoteTeam,
} from './promotion.service';

const router = Router();

// GET /api/teams/:id/promotion-eligibility — check if team can be promoted
router.get(
  '/:id/promotion-eligibility',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const result = await checkPromotionEligibility(teamId);
    res.json({ status: 'success', data: result });
  })
);

// POST /api/teams/:id/promote — promote team to next tier
router.post(
  '/:id/promote',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const result = await promoteTeam(teamId);
    res.json({
      status: 'success',
      data: result,
      message: `Promoted to ${result.newTier!.replace(/_/g, ' ')}!`,
    });
  })
);

export const promotionRouter = router;
