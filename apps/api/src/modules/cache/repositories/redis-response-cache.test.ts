import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import type { CachedAnswer } from '../interfaces/response-cache.js';
import { CACHE_TTL_SECONDS, createRedisResponseCache } from './redis-response-cache.js';

function createMockRedis() {
  const get = vi.fn();
  const set = vi.fn();
  const incr = vi.fn();

  const redis = {
    get,
    set,
    incr,
  } as unknown as Redis;

  return { redis, get, set, incr };
}

describe('RedisResponseCache', () => {
  describe('get', () => {
    it('returns parsed CachedAnswer when cache key exists', async () => {
      const { redis, get } = createMockRedis();
      const cachedData: CachedAnswer = {
        content: 'Cached LLM answer',
        citations: [{ chunkId: 'c1', documentId: 'd1', page: 1 }],
      };
      get.mockResolvedValue(JSON.stringify(cachedData));

      const cache = createRedisResponseCache(redis);
      const result = await cache.get('testkey123');

      expect(get).toHaveBeenCalledWith('cache:testkey123');
      expect(result).toEqual(cachedData);
    });

    it('returns null when cache key does not exist', async () => {
      const { redis, get } = createMockRedis();
      get.mockResolvedValue(null);

      const cache = createRedisResponseCache(redis);
      const result = await cache.get('nonexistent');

      expect(get).toHaveBeenCalledWith('cache:nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when cached value is empty string', async () => {
      const { redis, get } = createMockRedis();
      get.mockResolvedValue('');

      const cache = createRedisResponseCache(redis);
      const result = await cache.get('emptykey');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('saves serialized CachedAnswer with 24h TTL (86400s)', async () => {
      const { redis, set } = createMockRedis();
      set.mockResolvedValue('OK');

      const cache = createRedisResponseCache(redis);
      const value: CachedAnswer = {
        content: 'Generated text',
        citations: [{ chunkId: 'c2', documentId: 'd2', page: 3 }],
      };

      await cache.set('mykey', value);

      expect(set).toHaveBeenCalledWith(
        'cache:mykey',
        JSON.stringify(value),
        'EX',
        CACHE_TTL_SECONDS,
      );
      expect(CACHE_TTL_SECONDS).toBe(24 * 60 * 60);
    });
  });

  describe('getUserGeneration', () => {
    it('returns parsed generation number when key exists in Redis', async () => {
      const { redis, get } = createMockRedis();
      get.mockResolvedValue('5');

      const cache = createRedisResponseCache(redis);
      const gen = await cache.getUserGeneration('user-1');

      expect(get).toHaveBeenCalledWith('cache:gen:user-1');
      expect(gen).toBe(5);
    });

    it('returns 0 when generation key is missing in Redis', async () => {
      const { redis, get } = createMockRedis();
      get.mockResolvedValue(null);

      const cache = createRedisResponseCache(redis);
      const gen = await cache.getUserGeneration('user-new');

      expect(get).toHaveBeenCalledWith('cache:gen:user-new');
      expect(gen).toBe(0);
    });

    it('returns 0 when stored generation is not a valid number', async () => {
      const { redis, get } = createMockRedis();
      get.mockResolvedValue('not-a-number');

      const cache = createRedisResponseCache(redis);
      const gen = await cache.getUserGeneration('user-corrupt');

      expect(gen).toBe(0);
    });
  });

  describe('invalidateUser', () => {
    it('increments generation key in Redis', async () => {
      const { redis, incr } = createMockRedis();
      incr.mockResolvedValue(1);

      const cache = createRedisResponseCache(redis);
      await cache.invalidateUser('user-1');

      expect(incr).toHaveBeenCalledWith('cache:gen:user-1');
    });
  });
});
