import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { registerSchema, loginSchema } from './auth.schema';
import { register, login, getMe } from './auth.service';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    res.status(201).json({ status: 'success', data: result });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json({ status: 'success', data: result });
  })
);

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await getMe(req.user!.id);
    res.json({ status: 'success', data: user });
  })
);

export const authRouter = router;
