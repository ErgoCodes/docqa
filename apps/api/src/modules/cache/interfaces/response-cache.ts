import type { Citation } from '../../conversations/types/conversation.js';

export interface CachedAnswer {
  content: string;
  citations: Citation[];
}

export interface ResponseCache {
  get: (key: string) => Promise<CachedAnswer | null>;
  set: (key: string, value: CachedAnswer) => Promise<void>;
  getUserGeneration: (userId: string) => Promise<number>;
  invalidateUser: (userId: string) => Promise<void>;
}
