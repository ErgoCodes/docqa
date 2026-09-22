import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureIndexes } from '../../../db/indexes.js';
import { createInMemoryConversationRepository } from '../../../testing/fakes.js';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { Message, NewConversation } from '../types/conversation.js';
import { createMongoConversationRepository } from './mongo-conversation.repository.js';

function newConversationInput(overrides: Partial<NewConversation> = {}): NewConversation {
  const now = new Date();
  return {
    userId: new ObjectId().toHexString(),
    documentIds: [new ObjectId().toHexString()],
    messages: [],
    createdAt: now,
    ...overrides,
  };
}

function describeConversationRepositoryContract(
  name: string,
  createRepository: () => ConversationRepository,
): void {
  describe(`ConversationRepository (${name})`, () => {
    let repository: ConversationRepository;

    beforeAll(() => {
      repository = createRepository();
    });

    it('inserts a conversation and returns the created conversation with expected fields', async () => {
      const input = newConversationInput();
      const conversation = await repository.insert(input);

      expect(conversation.id).toBeDefined();
      expect(typeof conversation.id).toBe('string');
      expect(conversation.userId).toBe(input.userId);
      expect(conversation.documentIds).toEqual(input.documentIds);
      expect(conversation.messages).toEqual([]);
      expect(conversation.createdAt).toEqual(input.createdAt);
    });

    describe('findById', () => {
      it('finds an existing conversation by id and userId', async () => {
        const input = newConversationInput();
        const created = await repository.insert(input);

        const found = await repository.findById(created.id, input.userId);

        expect(found).not.toBeNull();
        expect(found?.id).toBe(created.id);
        expect(found?.userId).toBe(input.userId);
        expect(found?.documentIds).toEqual(input.documentIds);
        expect(found?.messages).toEqual([]);
      });

      it('returns null when searching for a non-existent conversation id', async () => {
        const userId = new ObjectId().toHexString();
        const found = await repository.findById(new ObjectId().toHexString(), userId);

        expect(found).toBeNull();
      });

      it('RNF-01: returns null when conversation exists but belongs to a different user', async () => {
        const created = await repository.insert(newConversationInput());
        const otherUserId = new ObjectId().toHexString();

        const found = await repository.findById(created.id, otherUserId);

        expect(found).toBeNull();
      });

      it('returns null when passed invalid non-hex IDs', async () => {
        const found = await repository.findById('invalid-id', 'invalid-user');
        expect(found).toBeNull();
      });
    });

    describe('appendMessages', () => {
      it('appends messages to existing conversation and returns the updated conversation', async () => {
        const input = newConversationInput();
        const created = await repository.insert(input);

        const userMsg: Message = {
          role: 'user',
          content: 'Hello, what is this?',
          citations: [],
          createdAt: new Date(),
        };
        const assistantMsg: Message = {
          role: 'assistant',
          content: 'This is a document.',
          citations: [
            {
              chunkId: new ObjectId().toHexString(),
              documentId: input.documentIds[0] ?? new ObjectId().toHexString(),
              page: 1,
            },
          ],
          createdAt: new Date(),
        };

        const updated = await repository.appendMessages(created.id, input.userId, [userMsg, assistantMsg]);

        expect(updated).not.toBeNull();
        expect(updated?.id).toBe(created.id);
        expect(updated?.messages).toHaveLength(2);
        expect(updated?.messages[0]).toEqual(userMsg);
        expect(updated?.messages[1]).toEqual(assistantMsg);

        const retrieved = await repository.findById(created.id, input.userId);
        expect(retrieved?.messages).toHaveLength(2);
      });

      it('returns null when attempting to append messages to a non-existent conversation', async () => {
        const userId = new ObjectId().toHexString();
        const nonExistentId = new ObjectId().toHexString();

        const result = await repository.appendMessages(nonExistentId, userId, [
          {
            role: 'user',
            content: 'Hello',
            citations: [],
            createdAt: new Date(),
          },
        ]);

        expect(result).toBeNull();
      });

      it('RNF-01: returns null when user B attempts to append messages to user A conversation', async () => {
        const userAId = new ObjectId().toHexString();
        const userBId = new ObjectId().toHexString();
        const created = await repository.insert(newConversationInput({ userId: userAId }));

        const result = await repository.appendMessages(created.id, userBId, [
          {
            role: 'user',
            content: 'Injected message',
            citations: [],
            createdAt: new Date(),
          },
        ]);

        expect(result).toBeNull();

        const original = await repository.findById(created.id, userAId);
        expect(original?.messages).toHaveLength(0);
      });

      it('returns null when passed invalid non-hex IDs', async () => {
        const result = await repository.appendMessages('invalid-id', 'invalid-user', []);
        expect(result).toBeNull();
      });
    });
  });
}

describeConversationRepositoryContract('in-memory', createInMemoryConversationRepository);

describe.skipIf(!process.env.MONGODB_TEST_URI)('MongoDB integration (ConversationRepository)', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-conversations-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describeConversationRepositoryContract('mongodb', () => createMongoConversationRepository(db));
});
