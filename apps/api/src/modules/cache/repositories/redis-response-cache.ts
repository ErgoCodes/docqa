import type { Redis } from 'ioredis';
import type { CachedAnswer, ResponseCache } from '../interfaces/response-cache.js';

export const CACHE_TTL_SECONDS = 24 * 60 * 60;

export function createRedisResponseCache(redis: Redis): ResponseCache {
  return {
    get: async (key: string): Promise<CachedAnswer | null> => {
      const raw = await redis.get('cache:' + key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as CachedAnswer;
    },

    set: async (key: string, value: CachedAnswer): Promise<void> => {
      await redis.set('cache:' + key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    },

    getUserGeneration: async (userId: string): Promise<number> => {
      const raw = await redis.get('cache:gen:' + userId);
      if (raw === null) {
        return 0;
      }
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? 0 : parsed;
    },

    invalidateUser: async (userId: string): Promise<void> => {
      await redis.incr('cache:gen:' + userId);
    },
  };
}
