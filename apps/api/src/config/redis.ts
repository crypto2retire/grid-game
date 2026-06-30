import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    redisClient.on('connect', () => logger.info('Connected to Redis'));
    redisClient.on('error', (err) => logger.error(err, 'Redis error'));
  }

  return redisClient;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const client = getRedisClient();
    if (!client) {
      throw new Error('Redis is not configured. Set REDIS_URL to use Redis-backed features.');
    }
    return Reflect.get(client, prop, receiver);
  },
});

export async function connectRedis(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  await client.ping();
  return true;
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient) return;
  await redisClient.quit();
  redisClient = null;
}
