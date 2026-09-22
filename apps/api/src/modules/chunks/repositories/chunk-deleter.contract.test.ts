import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryChunkDeleter } from '../../../testing/fakes.js';
import type { ChunkDeleter } from '../interfaces/chunk-deleter.js';
import type { Chunk } from '../types/chunk.js';
import { createMongoChunkDeleter } from './mongo-chunk-deleter.js';

interface ChunkDeleterTestHarness {
  deleter: ChunkDeleter;
  seed: (chunks: Chunk[]) => Promise<void>;
  readAll: () => Promise<Chunk[]>;
}

function sampleChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: new ObjectId().toHexString(),
    documentId: new ObjectId().toHexString(),
    userId: new ObjectId().toHexString(),
    page: 1,
    index: 0,
    text: 'sample chunk text',
    ...overrides,
  };
}

/**
 * Shared contract test suite executed against both in-memory and real MongoDB
 * implementations, guaranteeing that chunk deletion and user isolation (RNF-01)
 * behave identically regardless of the backing store.
 */
function describeChunkDeleterContract(
  name: string,
  createHarness: () => ChunkDeleterTestHarness | Promise<ChunkDeleterTestHarness>,
): void {
  describe(`ChunkDeleter (${name})`, () => {
    let harness: ChunkDeleterTestHarness;

    beforeEach(async () => {
      harness = await createHarness();
    });

    it('deletes the chunks matching documentId and userId and returns the deleted count', async () => {
      const documentId = new ObjectId().toHexString();
      const userId = new ObjectId().toHexString();

      await harness.seed([
        sampleChunk({ documentId, userId, index: 0 }),
        sampleChunk({ documentId, userId, index: 1 }),
      ]);

      const deletedCount = await harness.deleter.deleteByDocumentId(documentId, userId);
      expect(deletedCount).toBe(2);

      const remaining = await harness.readAll();
      expect(remaining).toHaveLength(0);
    });

    it('returns 0 when there are no chunks for the given documentId', async () => {
      const deletedCount = await harness.deleter.deleteByDocumentId(
        new ObjectId().toHexString(),
        new ObjectId().toHexString(),
      );
      expect(deletedCount).toBe(0);
    });

    it('is idempotent: calling it again after deletion returns 0', async () => {
      const documentId = new ObjectId().toHexString();
      const userId = new ObjectId().toHexString();

      await harness.seed([sampleChunk({ documentId, userId })]);

      expect(await harness.deleter.deleteByDocumentId(documentId, userId)).toBe(1);
      expect(await harness.deleter.deleteByDocumentId(documentId, userId)).toBe(0);
    });

    it('RNF-01: does not delete chunks when the documentId matches but the userId does not', async () => {
      const documentId = new ObjectId().toHexString();
      const userA = new ObjectId().toHexString();
      const userB = new ObjectId().toHexString();

      await harness.seed([
        sampleChunk({ documentId, userId: userA, index: 0 }),
        sampleChunk({ documentId, userId: userA, index: 1 }),
      ]);

      const deletedCount = await harness.deleter.deleteByDocumentId(documentId, userB);
      expect(deletedCount).toBe(0);

      const remaining = await harness.readAll();
      expect(remaining).toHaveLength(2);
      expect(remaining.every((chunk) => chunk.userId === userA)).toBe(true);
    });

    it('RNF-01: deleting chunks of one document does not affect chunks of another document', async () => {
      const documentA = new ObjectId().toHexString();
      const documentB = new ObjectId().toHexString();
      const userId = new ObjectId().toHexString();

      await harness.seed([
        sampleChunk({ documentId: documentA, userId, index: 0 }),
        sampleChunk({ documentId: documentB, userId, index: 0 }),
      ]);

      const deletedCount = await harness.deleter.deleteByDocumentId(documentA, userId);
      expect(deletedCount).toBe(1);

      const remaining = await harness.readAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.documentId).toBe(documentB);
    });
  });
}

describeChunkDeleterContract('en memoria', () => {
  const chunks: Chunk[] = [];
  return {
    deleter: createInMemoryChunkDeleter(chunks),
    seed: (seeded: Chunk[]): Promise<void> => {
      chunks.push(...seeded);
      return Promise.resolve();
    },
    readAll: (): Promise<Chunk[]> => Promise.resolve([...chunks]),
  };
});

describe.skipIf(!process.env.MONGODB_TEST_URI)('integración con MongoDB (ChunkDeleter)', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-chunk-deleter-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describeChunkDeleterContract('mongodb', async () => {
    await db.collection('chunks').deleteMany({});

    return {
      deleter: createMongoChunkDeleter(db),
      seed: async (chunks: Chunk[]): Promise<void> => {
        if (chunks.length === 0) {
          return;
        }
        await db.collection('chunks').insertMany(
          chunks.map((chunk) => ({
            _id: new ObjectId(chunk.id),
            documentId: new ObjectId(chunk.documentId),
            userId: new ObjectId(chunk.userId),
            page: chunk.page,
            index: chunk.index,
            text: chunk.text,
            embedding: [0.1, 0.2, 0.3],
          })),
        );
      },
      readAll: async (): Promise<Chunk[]> => {
        const rawDocs = await db.collection('chunks').find({}).toArray();
        return rawDocs.map((doc) => ({
          id: doc._id.toHexString(),
          documentId: (doc.documentId as ObjectId).toHexString(),
          userId: (doc.userId as ObjectId).toHexString(),
          page: doc.page as number,
          index: doc.index as number,
          text: doc.text as string,
        }));
      },
    };
  });
});
