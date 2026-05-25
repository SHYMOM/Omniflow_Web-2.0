import Redis from 'ioredis';
import type { IStreamResult } from '@/types/extraction-types';

// Initialize Redis client using REDIS_URL or fallback to localhost
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Prevent multiple connections during hot-reloading in dev
const globalForRedis = global as unknown as { redis: Redis };
export const redis = globalForRedis.redis || new Redis(redisUrl, {
  maxRetriesPerRequest: 0, // FAIL FAST: Do not retry if Redis is down
  commandTimeout: 1000,    // 1 second timeout maximum
  retryStrategy: () => null // Disable automatic reconnection spam
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Suppress unhandled rejections if Redis is down
redis.on('error', (err) => {
  if (err.message.includes('ECONNREFUSED')) {
    // console.warn('Redis is offline, caching will be skipped');
  } else {
    console.warn('[Redis] Error:', err.message);
  }
});

/**
 * Get a cached stream result from Redis
 */
export async function getCachedStream(key: string): Promise<IStreamResult | null> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as IStreamResult;
    }
  } catch (error) {
    console.warn(`[Redis Cache] Error getting key ${key}:`, error);
  }
  return null;
}

/**
 * Set a cached stream result in Redis with TTL
 * @param ttlSeconds Default is 10800 (3 hours)
 */
export async function setCachedStream(key: string, data: IStreamResult, ttlSeconds: number = 10800): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.warn(`[Redis Cache] Error setting key ${key}:`, error);
  }
}
