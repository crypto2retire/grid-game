import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DAILY_SALT: z.string().optional(),
  FRONTEND_URL: z.string().url().optional().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(),
  GAME_OWNER_USER_ID: z.string().default('ai-system-owner-001'),
  PUMPFUN_TOKEN_ADDRESS: z.string().optional(),
  PUMPFUN_TOKEN_SYMBOL: z.string().default('DYN'),
  PUMPFUN_TRADING_FEE_PCT: z.string().default('0.01').transform(Number),
  PUMPFUN_CREATOR_SHARE_PCT: z.string().default('0.50').transform(Number),
  REQUIRED_DYN_BALANCE: z.string().default('0').transform(Number),
  ROBINHOOD_CHAIN_NAME: z.string().default('Robinhood Chain'),
  ROBINHOOD_CHAIN_ID: z.string().optional().transform((value) => value ? Number(value) : undefined),
  ROBINHOOD_CHAIN_RPC_URL: z.string().url().optional(),
  ROBINHOOD_CHAIN_EXPLORER_URL: z.string().url().default('https://robinhoodchain.blockscout.com'),
  ROBINHOOD_CHAIN_NATIVE_SYMBOL: z.string().default('ETH'),
  ROBINHOOD_CONFIRMATIONS_REQUIRED: z.string().default('12').transform(Number),
  ROBINHOOD_DYN_TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  ROBINHOOD_USDG_TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  // Must remain false until EIP-191/SIWE challenge verification is implemented.
  WALLET_LINKING_ENABLED: z.string().default('false').transform((value) => value === 'true'),
});

export const env = envSchema.parse(process.env);
