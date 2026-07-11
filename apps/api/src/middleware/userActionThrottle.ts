import type { NextFunction, Request, Response } from 'express';
import { getRedisClient } from '../config/redis';
import { AppError } from './errorHandler';
import type { AuthRequest } from './auth';

type LocalBucket = { count: number; resetAt: number };
const localBuckets = new Map<string, LocalBucket>();

/**
 * Authenticated, per-user throttle. Uses Redis when configured so limits remain
 * consistent across instances; falls back to process memory in development.
 */
export function userActionThrottle(action: string, max: number, windowSeconds: number) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) return next(new AppError(401, 'Authentication required'));

    const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `security:throttle:${action}:${userId}:${windowId}`;

    try {
      const redis = getRedisClient();
      let count: number;
      if (redis) {
        count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSeconds + 5);
      } else {
        const now = Date.now();
        const existing = localBuckets.get(key);
        if (!existing || existing.resetAt <= now) {
          localBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
          count = 1;
        } else {
          existing.count += 1;
          count = existing.count;
        }

        if (localBuckets.size > 10_000) {
          for (const [bucketKey, bucket] of localBuckets) {
            if (bucket.resetAt <= now) localBuckets.delete(bucketKey);
          }
        }
      }

      if (count > max) {
        throw new AppError(429, 'Action rate exceeded. Slow down and try again later.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
