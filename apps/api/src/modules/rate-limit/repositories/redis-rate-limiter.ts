import type { Redis } from 'ioredis';
import type { RateLimiter, RateLimitResult } from '../interfaces/rate-limiter.js';

export interface RedisRateLimiterOptions {
  limit: number;
  windowSeconds: number;
}

export function createRedisRateLimiter(redis: Redis, options: RedisRateLimiterOptions): RateLimiter {
  const { limit, windowSeconds } = options;

  return {
    consume: async (key: string): Promise<RateLimitResult> => {
      const redisKey = 'ratelimit:' + key;
      // NX so a burst never extends the window that the first request opened.
      const replies = await redis.multi().incr(redisKey).expire(redisKey, windowSeconds, 'NX').ttl(redisKey).exec();

      if (!replies) {
        throw new Error('Rate limit transaction was aborted');
      }

      const [incrReply, , ttlReply] = replies;
      const count = Number(incrReply?.[1]);
      const ttl = Number(ttlReply?.[1]);

      return {
        allowed: count <= limit,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    },
  };
}
