import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('Connected to Redis'));
redis.on('error', (err) => console.error('Redis error:', err));

export async function connectRedis(): Promise<void> {
  await redis.ping();
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
