import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryChunkRepository } from '../../../testing/fakes.js';
import type { ChunkRepository } from '../interfaces/chunk.repository.js';
import type { EmbeddedChunk } from '../types/embedded-chunk.js';
import { ensureChunksVectorIndex } from './chunks-vector-index.js';
import { createMongoChunkRepository } from './mongo-chunk.repository.js';

interface ChunkRepositoryTestHarness {
  repository: ChunkRepository;
  readAll: () => Promise<EmbeddedChunk[]>;
}

function createSampleChunk(overrides: Partial<EmbeddedChunk> = {}): EmbeddedChunk {
  return {
    documentId: new ObjectId().toHexString(),
    userId: new ObjectId().toHexString(),
    page: 1,
    index: 0,
    text: 'sample chunk text',
    embedding: [0.1, 0.2, 0.3, 0.4],
    ...overrides,
  };
}

/**
 * Shared contract test suite executed against both in-memory and real MongoDB implementations.
 * Guarantees that chunk insertion, field integrity, and user data isolation (RNF-01) behave identically.
 */
function describeChunkRepositoryContract(
  name: string,
  createHarness: () => Promise<ChunkRepositoryTestHarness> | ChunkRepositoryTestHarness,
): void {
  describe(`ChunkRepository (${name})`, () => {
    let harness: ChunkRepositoryTestHarness;

    beforeEach(async () => {
      harness = await createHarness();
    });

    it('inserts multiple chunks for a document/user and preserves all fields intact', async () => {
      const documentId = new ObjectId().toHexString();
      const userId = new ObjectId().toHexString();

      const chunks: EmbeddedChunk[] = [
        {
          documentId,
          userId,
          page: 1,
          index: 0,
          text: 'First chunk text',
          embedding: [0.1, 0.2, 0.3],
        },
        {
          documentId,
          userId,
          page: 2,
          index: 1,
          text: 'Second chunk text',
          embedding: [0.4, 0.5, 0.6],
        },
      ];

      await harness.repository.insertMany(chunks);

      const stored = await harness.readAll();
      expect(stored).toHaveLength(2);

      const sorted = [...stored].sort((a, b) => a.index - b.index);
      expect(sorted).toEqual(chunks);
    });

    it('RNF-01: chunks preserve their exact userId with no cross-contamination between users', async () => {
      const userA = new ObjectId().toHexString();
      const userB = new ObjectId().toHexString();
      const docA = new ObjectId().toHexString();
      const docB = new ObjectId().toHexString();

      const chunksUserA: EmbeddedChunk[] = [
        {
          documentId: docA,
          userId: userA,
          page: 1,
          index: 0,
          text: 'Doc A chunk 0',
          embedding: [0.11, 0.22],
        },
        {
          documentId: docA,
          userId: userA,
          page: 1,
          index: 1,
          text: 'Doc A chunk 1',
          embedding: [0.33, 0.44],
        },
      ];

      const chunksUserB: EmbeddedChunk[] = [
        {
          documentId: docB,
          userId: userB,
          page: 1,
          index: 0,
          text: 'Doc B chunk 0',
          embedding: [0.55, 0.66],
        },
      ];

      await harness.repository.insertMany(chunksUserA);
      await harness.repository.insertMany(chunksUserB);

      const stored = await harness.readAll();
      expect(stored).toHaveLength(3);

      for (const chunk of stored) {
        expect(chunk.userId).toBeDefined();
        expect(chunk.userId.trim().length).toBeGreaterThan(0);
      }

      const storedForA = stored.filter((chunk) => chunk.userId === userA);
      const storedForB = stored.filter((chunk) => chunk.userId === userB);

      expect(storedForA).toHaveLength(2);
      expect(storedForB).toHaveLength(1);

      expect(storedForA.every((chunk) => chunk.userId === userA && chunk.userId !== userB)).toBe(true);
      expect(storedForB.every((chunk) => chunk.userId === userB && chunk.userId !== userA)).toBe(true);

      expect(storedForA.map((chunk) => chunk.text)).toEqual(
        expect.arrayContaining(['Doc A chunk 0', 'Doc A chunk 1']),
      );
      expect(storedForB.map((chunk) => chunk.text)).toEqual(['Doc B chunk 0']);
    });

    it('RNF-01: preserves user isolation when chunks of different users are in the same insertMany call', async () => {
      const userA = new ObjectId().toHexString();
      const userB = new ObjectId().toHexString();

      const mixedChunks: EmbeddedChunk[] = [
        createSampleChunk({ userId: userA, text: 'chunk-for-user-a' }),
        createSampleChunk({ userId: userB, text: 'chunk-for-user-b' }),
      ];

      await harness.repository.insertMany(mixedChunks);

      const stored = await harness.readAll();
      expect(stored).toHaveLength(2);

      const chunkA = stored.find((chunk) => chunk.text === 'chunk-for-user-a');
      const chunkB = stored.find((chunk) => chunk.text === 'chunk-for-user-b');

      expect(chunkA).toBeDefined();
      expect(chunkA?.userId).toBe(userA);
      expect(chunkA?.userId).not.toBe(userB);

      expect(chunkB).toBeDefined();
      expect(chunkB?.userId).toBe(userB);
      expect(chunkB?.userId).not.toBe(userA);
    });

    it('fails insertion when a chunk has an empty userId', async () => {
      const invalidChunk = createSampleChunk({ userId: '' });

      await expect(harness.repository.insertMany([invalidChunk])).rejects.toThrow();

      const stored = await harness.readAll();
      expect(stored).toHaveLength(0);
    });

    it('persists none of the batch when one chunk among otherwise valid ones has an empty userId', async () => {
      const mixedBatch: EmbeddedChunk[] = [
        createSampleChunk({ text: 'valid-before' }),
        createSampleChunk({ userId: '', text: 'invalid' }),
        createSampleChunk({ text: 'valid-after' }),
      ];

      await expect(harness.repository.insertMany(mixedBatch)).rejects.toThrow();

      const stored = await harness.readAll();
      expect(stored).toHaveLength(0);
    });

    it('does not throw and inserts nothing when called with an empty array', async () => {
      await expect(harness.repository.insertMany([])).resolves.toBeUndefined();

      const stored = await harness.readAll();
      expect(stored).toHaveLength(0);
    });
  });
}

describeChunkRepositoryContract('en memoria', () => {
  const fake = createInMemoryChunkRepository();
  return {
    repository: fake,
    readAll: () => Promise.resolve(fake.getAll()),
  };
});

describe.skipIf(!process.env.MONGODB_TEST_URI)('integración con MongoDB (ChunkRepository)', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-chunks-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
    await ensureChunksVectorIndex(db);
  });

  afterAll(async () => {
    if (db) {
      await db.dropDatabase();
    }
    if (client) {
      await client.close();
    }
  });

  describeChunkRepositoryContract('mongodb', async () => {
    await db.collection('chunks').deleteMany({});
    const repository = createMongoChunkRepository(db);

    return {
      repository,
      readAll: async (): Promise<EmbeddedChunk[]> => {
        const rawDocs = await db.collection('chunks').find({}).toArray();
        return rawDocs.map((doc) => ({
          documentId: (doc.documentId as ObjectId).toHexString(),
          userId: (doc.userId as ObjectId).toHexString(),
          page: doc.page as number,
          index: doc.index as number,
          text: doc.text as string,
          embedding: doc.embedding as number[],
        }));
      },
    };
  });

  it('persists userId and documentId as MongoDB ObjectId instances', async () => {
    await db.collection('chunks').deleteMany({});
    const repository = createMongoChunkRepository(db);
    const docId = new ObjectId().toHexString();
    const userId = new ObjectId().toHexString();
    const chunk = createSampleChunk({ documentId: docId, userId });

    await repository.insertMany([chunk]);

    const rawDocs = await db.collection('chunks').find({}).toArray();
    expect(rawDocs).toHaveLength(1);
    const rawDoc = rawDocs[0];
    expect(rawDoc?._id).toBeInstanceOf(ObjectId);
    expect(rawDoc?.documentId).toBeInstanceOf(ObjectId);
    expect(rawDoc?.userId).toBeInstanceOf(ObjectId);
    expect((rawDoc?.userId as ObjectId).toHexString()).toBe(userId);
    expect((rawDoc?.documentId as ObjectId).toHexString()).toBe(docId);
  });
});
