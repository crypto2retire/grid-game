import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import {
  getTrainingPackages,
  getTeamTrainings,
  startTraining,
  getUserTrainingHistory,
} from './training.service';

const router = Router();

// GET /api/training/packages — list all training packages
router.get(
  '/packages',
  authMiddleware,
  asyncHandler(async (_req: any, res) => {
    const packages = await getTrainingPackages();
    res.json({ status: 'success', data: packages });
  })
);

// GET /api/training/team/:teamId — active trainings for a team
router.get(
  '/team/:teamId',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.teamId, 'teamId');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const trainings = await getTeamTrainings(teamId);
    res.json({ status: 'success', data: trainings });
  })
);

// POST /api/training/start — start a training program
router.post(
  '/start',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      teamId: z.string().uuid(),
      packageId: z.string(),
      playerId: z.string().uuid().optional(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const result = await startTraining({
      teamId: input.teamId,
      userId,
      packageId: input.packageId,
      playerId: input.playerId,
    });

    res.status(201).json({
      status: 'success',
      data: result,
      message: 'Training completed successfully',
    });
  })
);

// GET /api/training/history — user's training history
router.get(
  '/history',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const history = await getUserTrainingHistory(req.user!.id);
    res.json({ status: 'success', data: history });
  })
);

export const trainingRouter = router;
