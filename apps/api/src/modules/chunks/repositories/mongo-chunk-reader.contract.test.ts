import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryChunkReader } from '../../../testing/fakes.js';
import type { ChunkReader } from '../interfaces/chunk-reader.js';
import type { Chunk } from '../types/chunk.js';
import { createMongoChunkReader } from './mongo-chunk-reader.js';

interface ChunkReaderTestHarness {
  reader: ChunkReader;
  seed: (chunks: Chunk[]) => Promise<void>;
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

function describeChunkReaderContract(
  name: string,
  createHarness: () => ChunkReaderTestHarness | Promise<ChunkReaderTestHarness>,
): void {
  describe(`ChunkReader (${name})`, () => {
    let harness: ChunkReaderTestHarness;

    beforeEach(async () => {
      harness = await createHarness();
    });

    it('finds and returns a chunk when id and userId match', async () => {
      const chunk = sampleChunk({ text: 'Specific fragment of text' });
      await harness.seed([chunk]);

      const found = await harness.reader.findById(chunk.id, chunk.userId);

      expect(found).toEqual(chunk);
    });

    it('returns null when chunk does not exist', async () => {
      const nonExistentId = new ObjectId().toHexString();
      const userId = new ObjectId().toHexString();

      const found = await harness.reader.findById(nonExistentId, userId);

      expect(found).toBeNull();
    });

    it('RNF-01: returns null when user B requests chunk belonging to user A', async () => {
      const userA = new ObjectId().toHexString();
      const userB = new ObjectId().toHexString();
      const chunkA = sampleChunk({ userId: userA, text: 'Secret text of user A' });

      await harness.seed([chunkA]);

      const found = await harness.reader.findById(chunkA.id, userB);

      expect(found).toBeNull();
    });

    it('RNF-01: returns null when id is not a valid ObjectId', async () => {
      const userId = new ObjectId().toHexString();

      const found = await harness.reader.findById('not-a-valid-id', userId);

      expect(found).toBeNull();
    });

    it('RNF-01: returns null when userId is not a valid ObjectId', async () => {
      const chunk = sampleChunk();
      await harness.seed([chunk]);

      const found = await harness.reader.findById(chunk.id, 'not-a-valid-user-id');

      expect(found).toBeNull();
    });
  });
}

describeChunkReaderContract('en memoria', () => {
  const chunks: Chunk[] = [];
  return {
    reader: createInMemoryChunkReader(chunks),
    seed: (seeded: Chunk[]): Promise<void> => {
      chunks.length = 0;
      chunks.push(...seeded);
      return Promise.resolve();
    },
  };
});

describe.skipIf(!process.env.MONGODB_TEST_URI)('integración con MongoDB (ChunkReader)', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-chunk-reader-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describeChunkReaderContract('mongodb', async () => {
    await db.collection('chunks').deleteMany({});

    return {
      reader: createMongoChunkReader(db),
      seed: async (chunks: Chunk[]): Promise<void> => {
        await db.collection('chunks').deleteMany({});
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
    };
  });
});
