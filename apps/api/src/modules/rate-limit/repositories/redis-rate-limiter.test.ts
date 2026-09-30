import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { createRedisRateLimiter } from './redis-rate-limiter.js';

function createMockRedis(replies: Array<[Error | null, unknown]> | null) {
  const exec = vi.fn().mockResolvedValue(replies);
  const ttl = vi.fn().mockReturnValue({ exec });
  const expire = vi.fn().mockReturnValue({ ttl });
  const incr = vi.fn().mockReturnValue({ expire });
  const multi = vi.fn().mockReturnValue({ incr });

  return { redis: { multi } as unknown as Redis, incr, expire, ttl };
}

describe('RedisRateLimiter', () => {
  it('allows a request while the counter is at or below the limit', async () => {
    const { redis, incr, expire, ttl } = createMockRedis([
      [null, 20],
      [null, 0],
      [null, 42],
    ]);

    const limiter = createRedisRateLimiter(redis, { limit: 20, windowSeconds: 60 });
    const result = await limiter.consume('question:user-1');

    expect(incr).toHaveBeenCalledWith('ratelimit:question:user-1');
    expect(expire).toHaveBeenCalledWith('ratelimit:question:user-1', 60, 'NX');
    expect(ttl).toHaveBeenCalledWith('ratelimit:question:user-1');
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 42 });
  });

  it('rejects the request that exceeds the limit and reports the remaining window', async () => {
    const { redis } = createMockRedis([
      [null, 21],
      [null, 0],
      [null, 17],
    ]);

    const limiter = createRedisRateLimiter(redis, { limit: 20, windowSeconds: 60 });
    const result = await limiter.consume('question:user-1');

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 17 });
  });

  it('falls back to the full window when Redis reports no TTL', async () => {
    const { redis } = createMockRedis([
      [null, 21],
      [null, 0],
      [null, -1],
    ]);

    const limiter = createRedisRateLimiter(redis, { limit: 20, windowSeconds: 60 });
    const result = await limiter.consume('question:user-1');

    expect(result.retryAfterSeconds).toBe(60);
  });

  it('throws when the Redis transaction is aborted', async () => {
    const { redis } = createMockRedis(null);

    const limiter = createRedisRateLimiter(redis, { limit: 20, windowSeconds: 60 });

    await expect(limiter.consume('question:user-1')).rejects.toThrow('Rate limit transaction was aborted');
  });
});
