import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';

export type SecurityLockKey = (req: Request) => string;

/**
 * Distributed database-backed lock for economically sensitive mutations.
 * The lock is released when the response finishes and also expires automatically
 * so a crashed process cannot permanently block an asset or match.
 */
export function securityActionLock(keyForRequest: SecurityLockKey, ttlMs = 180_000) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyForRequest(req);
    const ownerToken = randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs);

    try {
      const acquired = await prisma.$queryRaw<Array<{ key: string }>>(Prisma.sql`
        INSERT INTO "SecurityActionLock" ("key", "ownerToken", "expiresAt", "updatedAt")
        VALUES (${key}, ${ownerToken}, ${expiresAt}, NOW())
        ON CONFLICT ("key") DO UPDATE
          SET "ownerToken" = EXCLUDED."ownerToken",
              "expiresAt" = EXCLUDED."expiresAt",
              "updatedAt" = NOW()
        WHERE "SecurityActionLock"."expiresAt" < NOW()
        RETURNING "key"
      `);

      if (acquired.length !== 1) {
        throw new AppError(409, 'This action is already being processed. Wait for it to finish before retrying.');
      }

      let released = false;
      const release = async () => {
        if (released) return;
        released = true;
        try {
          await prisma.$executeRaw(Prisma.sql`
            DELETE FROM "SecurityActionLock"
            WHERE "key" = ${key} AND "ownerToken" = ${ownerToken}
          `);
        } catch {
          // The TTL remains the final safety net if release cannot complete.
        }
      };

      res.once('finish', () => { void release(); });
      res.once('close', () => { void release(); });
      next();
    } catch (error) {
      next(error);
    }
  };
}
