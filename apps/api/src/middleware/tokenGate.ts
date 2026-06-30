import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';
import { AuthRequest } from './auth';

/**
 * Token gate middleware — skips entirely when REQUIRED_DYN_BALANCE is 0.
 * When set to >0 at launch, checks that the authenticated user's wallet
 * holds the required amount of DYN tokens before allowing the request.
 */
export const tokenGate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const required = env.REQUIRED_DYN_BALANCE;

  // Gate disabled — allow all traffic
  if (required <= 0) {
    next();
    return;
  }

  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.id) {
      throw new AppError(401, 'Authentication required');
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: authReq.user.id },
      select: { gridTokens: true },
    });

    if (!wallet || wallet.gridTokens < required) {
      throw new AppError(403,
        `Token gate: ${required.toLocaleString()} DYN required to access this feature. ` +
        `You have ${wallet?.gridTokens?.toLocaleString() ?? 0}.`
      );
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(403, 'Token gate check failed'));
    }
  }
};
