import { randomUUID } from 'node:crypto';
import type { AppDependencies } from '../dependencies.js';
import type { NewRefreshToken, RefreshTokenRepository } from '../modules/auth/interfaces/refresh-token.repository.js';
import type { NewUser, UserRepository } from '../modules/auth/interfaces/user.repository.js';
import type { RefreshToken, RevokedReason } from '../modules/auth/types/refresh-token.js';
import { DuplicateEmailError, type User } from '../modules/auth/types/user.js';
import { createArgon2Hasher } from '../modules/auth/utils/password-hasher.js';
import type { ChunkDeleter } from '../modules/chunks/interfaces/chunk-deleter.js';
import type { ChunkReader } from '../modules/chunks/interfaces/chunk-reader.js';
import type { ChunkSearcher } from '../modules/chunks/interfaces/chunk-searcher.js';
import type { Chunk, ChunkSearchResult } from '../modules/chunks/types/chunk.js';
import type { ConversationRepository } from '../modules/conversations/interfaces/conversation.repository.js';
import type { Conversation, NewConversation } from '../modules/conversations/types/conversation.js';
import type { DocumentRepository } from '../modules/documents/interfaces/document.repository.js';
import type { IngestionQueue } from '../modules/documents/interfaces/ingestion-queue.js';
import type { ObjectStorage } from '../modules/documents/interfaces/object-storage.js';
import type { Document, NewDocument } from '../modules/documents/types/document.js';
import type { EmbeddingsProvider } from '../modules/embeddings/interfaces/embeddings-provider.js';

export function createInMemoryUserRepository(): UserRepository {
  const usersByEmail = new Map<string, User>();
  const usersById = new Map<string, User>();

  return {
    insert: (user: NewUser): Promise<User> => {
      if (usersByEmail.has(user.email)) {
        return Promise.reject(new DuplicateEmailError(user.email));
      }
      const stored: User = { id: randomUUID(), ...user };
      usersByEmail.set(user.email, stored);
      usersById.set(stored.id, stored);
      return Promise.resolve(stored);
    },

    findByEmail: (email: string): Promise<User | null> => Promise.resolve(usersByEmail.get(email) ?? null),

    findById: (userId: string): Promise<User | null> => Promise.resolve(usersById.get(userId) ?? null),
  };
}

export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  const byHash = new Map<string, RefreshToken>();

  return {
    insert: (token: NewRefreshToken): Promise<RefreshToken> => {
      const stored: RefreshToken = {
        id: randomUUID(),
        ...token,
        rotatedAt: null,
        replacedByHash: null,
        revokedAt: null,
        revokedReason: null,
      };
      byHash.set(stored.tokenHash, stored);
      return Promise.resolve(stored);
    },

    findByTokenHash: (tokenHash: string): Promise<RefreshToken | null> =>
      Promise.resolve(byHash.get(tokenHash) ?? null),

    markRotated: (tokenHash: string, replacedByHash: string, now: Date): Promise<boolean> => {
      const existing = byHash.get(tokenHash);
      if (!existing || existing.rotatedAt !== null || existing.revokedAt !== null) {
        return Promise.resolve(false);
      }
      byHash.set(tokenHash, { ...existing, rotatedAt: now, replacedByHash, revokedAt: now, revokedReason: 'rotated' });
      return Promise.resolve(true);
    },

    revokeFamily: (familyId: string, reason: RevokedReason, now: Date): Promise<void> => {
      for (const [hash, token] of byHash) {
        if (token.familyId === familyId && token.revokedAt === null) {
          byHash.set(hash, { ...token, revokedAt: now, revokedReason: reason });
        }
      }
      return Promise.resolve();
    },
  };
}

export function createInMemoryDocumentRepository(): DocumentRepository {
  const documents = new Map<string, Document>();

  return {
    insert: (document: NewDocument): Promise<Document> => {
      const stored: Document = {
        id: randomUUID(),
        ...document,
      };
      documents.set(stored.id, stored);
      return Promise.resolve(stored);
    },

    findById: (id: string, userId: string): Promise<Document | null> => {
      const doc = documents.get(id);
      if (!doc || doc.userId !== userId) {
        return Promise.resolve(null);
      }
      return Promise.resolve(doc);
    },

    findAllByUser: (userId: string): Promise<Document[]> => {
      const userDocs = Array.from(documents.values())
        .filter((d) => d.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return Promise.resolve(userDocs);
    },

    deleteById: (id: string, userId: string): Promise<boolean> => {
      const doc = documents.get(id);
      if (!doc || doc.userId !== userId) {
        return Promise.resolve(false);
      }
      documents.delete(id);
      return Promise.resolve(true);
    },
  };
}

export function createInMemoryConversationRepository(): ConversationRepository {
  const conversations = new Map<string, Conversation>();

  return {
    insert: (conversation: NewConversation): Promise<Conversation> => {
      const stored: Conversation = {
        id: randomUUID(),
        ...conversation,
      };
      conversations.set(stored.id, stored);
      return Promise.resolve(stored);
    },
  };
}

export function createInMemoryObjectStorage(): ObjectStorage {
  const storage = new Map<string, { data: Buffer; contentType: string }>();

  return {
    putObject: (key: string, data: Buffer, contentType: string): Promise<void> => {
      storage.set(key, { data, contentType });
      return Promise.resolve();
    },

    deleteObject: (key: string): Promise<void> => {
      storage.delete(key);
      return Promise.resolve();
    },
  };
}

export function createInMemoryChunkSearcher(results: ChunkSearchResult[] = []): ChunkSearcher {
  return {
    searchSimilar: (): Promise<ChunkSearchResult[]> => Promise.resolve(results),
  };
}

export function createInMemoryEmbeddingsProvider(): EmbeddingsProvider {
  return {
    embed: (texts: string[]): Promise<number[][]> => Promise.resolve(texts.map(() => [])),
  };
}

export function createInMemoryChunkDeleter(chunks: Chunk[] = []): ChunkDeleter {
  return {
    deleteByDocumentId: (documentId: string, userId: string): Promise<number> => {
      const remaining = chunks.filter((chunk) => !(chunk.documentId === documentId && chunk.userId === userId));
      const deletedCount = chunks.length - remaining.length;
      chunks.length = 0;
      chunks.push(...remaining);
      return Promise.resolve(deletedCount);
    },
  };
}

export function createInMemoryChunkReader(chunks: Chunk[] = []): ChunkReader {
  return {
    findById: (id: string, userId: string): Promise<Chunk | null> => {
      const chunk = chunks.find((item) => item.id === id && item.userId === userId);
      return Promise.resolve(chunk ?? null);
    },
  };
}

export function createInMemoryIngestionQueue(): IngestionQueue {
  const enqueued: string[] = [];

  return {
    enqueue: (documentId: string): Promise<void> => {
      enqueued.push(documentId);
      return Promise.resolve();
    },
  };
}

export function createInMemoryDependencies(): AppDependencies {
  return {
    users: createInMemoryUserRepository(),
    refreshTokens: createInMemoryRefreshTokenRepository(),
    documents: createInMemoryDocumentRepository(),
    conversations: createInMemoryConversationRepository(),
    objectStorage: createInMemoryObjectStorage(),
    ingestionQueue: createInMemoryIngestionQueue(),
    chunkDeleter: createInMemoryChunkDeleter(),
    chunkReader: createInMemoryChunkReader(),
    chunkSearcher: createInMemoryChunkSearcher(),
    embeddingsProvider: createInMemoryEmbeddingsProvider(),
    // Argon2 real con memoryCost mínimo, no un mock: cubre el camino
    // crítico sin pagar su coste en cada test (~1-5ms por hash).
    hasher: createArgon2Hasher({ memoryCost: 8, timeCost: 1, parallelism: 1 }),
    close: () => Promise.resolve(),
  };
}
