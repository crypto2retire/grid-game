import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        createdAt: true,
        teams: {
          select: {
            id: true,
            name: true,
            wins: true,
            draws: true,
            losses: true,
            points: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({ status: 'success', data: user });
  })
);

export const userRouter = router;
