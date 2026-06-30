import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { createChatMessage, getRecentChatMessages } from './chat.service';

const router = Router();

router.get(
  '/messages',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const channel = typeof req.query.channel === 'string' ? req.query.channel : 'Realm';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
    const messages = await getRecentChatMessages(channel, Number.isFinite(limit) ? limit : 50);
    res.json({ status: 'success', data: messages });
  })
);

router.post(
  '/messages',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      channel: z.string().max(24).optional(),
      message: z.string().min(1).max(240),
    });
    const input = schema.parse(req.body);

    try {
      const message = await createChatMessage({
        userId: req.user!.id,
        username: req.user!.username,
        channel: input.channel,
        message: input.message,
      });
      res.status(201).json({ status: 'success', data: message });
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : 'Unable to send message');
    }
  })
);

export const chatRouter = router;
