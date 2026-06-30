import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(), // required — app cannot function without it
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32), // required — no fallback in production
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DAILY_SALT: z.string().optional(), // optional but strongly recommended for seed security
  FRONTEND_URL: z.string().url().optional().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(),
  GAME_OWNER_USER_ID: z.string().default('ai-system-owner-001'),
  PUMPFUN_TOKEN_ADDRESS: z.string().optional(),
  PUMPFUN_TOKEN_SYMBOL: z.string().default('DYN'),
  PUMPFUN_TRADING_FEE_PCT: z.string().default('0.01').transform(Number), // 1% default
  PUMPFUN_CREATOR_SHARE_PCT: z.string().default('0.50').transform(Number), // 50% of fees to creator
  // Token gate — set to >0 at launch to require DYN token balance
  REQUIRED_DYN_BALANCE: z.string().default('0').transform(Number),
});

export const env = envSchema.parse(process.env);
