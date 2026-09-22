import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureIndexes } from '../../../db/indexes.js';
import { createInMemoryConversationRepository } from '../../../testing/fakes.js';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { NewConversation } from '../types/conversation.js';
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
