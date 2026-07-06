import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

function createLimiter(max: number, windowMs: number, keyPrefix: string, message?: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return userId ? `${keyPrefix}:user:${userId}` : `${keyPrefix}:ip:${ip}`;
    },
    skip: (req) => req.method === 'OPTIONS' || req.path === '/api/health' || req.path === '/health',
    handler: (_req, res, _next, options) => {
      res.status(429).json({
        status: 'error',
        message: message || 'Too many requests. Please slow down.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path === '/api/health' || req.path === '/health',
});

// Auth routes: low thresholds to prevent brute force / enumeration.
export const authLimiter = createLimiter(10, 15 * 60 * 1000, 'auth', 'Too many auth attempts. Try again later.');

// Wallet-sensitive actions: withdrawals and currency operations.
export const walletLimiter = createLimiter(20, 15 * 60 * 1000, 'wallet', 'Too many wallet requests. Try again later.');

// Match actions: scheduling, simulating, playing.
export const matchLimiter = createLimiter(30, 15 * 60 * 1000, 'match', 'Too many match requests. Try again later.');

// Marketplace actions: listing, buying, bidding.
export const marketplaceLimiter = createLimiter(30, 15 * 60 * 1000, 'marketplace', 'Too many marketplace requests. Try again later.');

// Staking: claim and stake/unstake are economically sensitive.
export const stakingLimiter = createLimiter(10, 15 * 60 * 1000, 'staking', 'Too many staking requests. Try again later.');

// Mini-games: DB-backed daily caps are primary; this adds a fallback ceiling.
export const miniGameLimiter = createLimiter(60, 15 * 60 * 1000, 'minigame', 'Too many mini-game requests. Try again later.');

// World/chat: high enough for normal MMO activity, but capped against spam.
export const chatLimiter = createLimiter(120, 15 * 60 * 1000, 'chat', 'Too many chat requests. Slow down.');
export const worldLimiter = createLimiter(120, 15 * 60 * 1000, 'world', 'Too many world requests. Slow down.');
