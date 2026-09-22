import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureChunksVectorIndexForTests } from '../../../testing/vector-index.js';
import { createMongoChunkSearcher, EMBEDDING_DIMENSIONS } from './mongo-chunk-searcher.js';
import type { ChunkSearcher } from '../interfaces/chunk-searcher.js';

interface TestChunk {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  embedding: number[];
}

function unitLikeVector(overrides: Record<number, number> = {}): number[] {
  // MongoDB $vectorSearch requires all vector elements to be BSON doubles.
  // In the Node.js BSON serializer, numbers that satisfy Number.isInteger()
  // are serialized as BSON Int32, triggering:
  // "BSON field '$vectorSearch.queryVector.0' is the wrong type 'int', expected type 'double'".
  // Using non-integer floats (with a 0.00001 fractional offset) guarantees BSON serializes them as doubles.
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.00001);
  vector[0] = 1.00001;
  for (const [index, value] of Object.entries(overrides)) {
    vector[Number(index)] = Number.isInteger(value) ? value + 0.00001 : value;
  }
  return vector;
}

describe.skipIf(!process.env.MONGODB_TEST_URI)('integración con MongoDB (ChunkSearcher, RNF-01)', () => {
  let client: MongoClient;
  let db: Db;
  let searcher: ChunkSearcher;
  const testDbName = `docqa-test-chunks-search-${randomUUID()}`;

  const userAId = new ObjectId();
  const userBId = new ObjectId();
  const userADocId = new ObjectId();
  const userBDocId = new ObjectId();
  const userAChunkId = new ObjectId();

  const userBChunkIds = [
    new ObjectId(),
    new ObjectId(),
    new ObjectId(),
    new ObjectId(),
    new ObjectId(),
  ];

  const userCId = new ObjectId();
  const docC1 = new ObjectId();
  const docC2 = new ObjectId();

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
    await ensureChunksVectorIndexForTests(db);
    searcher = createMongoChunkSearcher(db);

    const userBChunks: TestChunk[] = userBChunkIds.map((id, i) => ({
      _id: id,
      documentId: userBDocId,
      userId: userBId,
      page: 1,
      index: i,
      text: `userB chunk ${i}`,
      embedding: unitLikeVector({ 1: 0.001 * (i + 1) }),
    }));

    const userAChunk: TestChunk = {
      _id: userAChunkId,
      documentId: userADocId,
      userId: userAId,
      page: 1,
      index: 0,
      text: 'userA chunk 0',
      embedding: unitLikeVector({ 50: 3 }),
    };

    const docC1Chunks: TestChunk[] = [
      {
        _id: new ObjectId(),
        documentId: docC1,
        userId: userCId,
        page: 1,
        index: 0,
        text: 'userC doc1 chunk 0',
        embedding: unitLikeVector({ 1: 0.1 }),
      },
      {
        _id: new ObjectId(),
        documentId: docC1,
        userId: userCId,
        page: 1,
        index: 1,
        text: 'userC doc1 chunk 1',
        embedding: unitLikeVector({ 1: 0.2 }),
      },
      {
        _id: new ObjectId(),
        documentId: docC1,
        userId: userCId,
        page: 2,
        index: 2,
        text: 'userC doc1 chunk 2',
        embedding: unitLikeVector({ 1: 0.3 }),
      },
      {
        _id: new ObjectId(),
        documentId: docC1,
        userId: userCId,
        page: 2,
        index: 3,
        text: 'userC doc1 chunk 3',
        embedding: unitLikeVector({ 1: 0.4 }),
      },
    ];

    const docC2Chunks: TestChunk[] = [
      {
        _id: new ObjectId(),
        documentId: docC2,
        userId: userCId,
        page: 1,
        index: 0,
        text: 'userC doc2 chunk 0',
        embedding: unitLikeVector({ 1: 0.05 }),
      },
      {
        _id: new ObjectId(),
        documentId: docC2,
        userId: userCId,
        page: 1,
        index: 1,
        text: 'userC doc2 chunk 1',
        embedding: unitLikeVector({ 1: 0.15 }),
      },
      {
        _id: new ObjectId(),
        documentId: docC2,
        userId: userCId,
        page: 2,
        index: 2,
        text: 'userC doc2 chunk 2',
        embedding: unitLikeVector({ 1: 0.25 }),
      },
    ];

    await db.collection<TestChunk>('chunks').insertMany([
      ...userBChunks,
      userAChunk,
      ...docC1Chunks,
      ...docC2Chunks,
    ]);

    // Poll until documents are indexed into the vector search index
    const queryVector = unitLikeVector();
    const startTime = Date.now();
    while (Date.now() - startTime < 30_000) {
      const probeA = await searcher.searchSimilar({
        embedding: queryVector,
        userId: userAId.toHexString(),
      });
      const probeC = await searcher.searchSimilar({
        embedding: queryVector,
        userId: userCId.toHexString(),
      });
      if (probeA.length === 1 && probeC.length === 5) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, 90_000);

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  /**
   * RNF-01: Vector search isolation proof.
   * If userId filtering were ever implemented as "run $vectorSearch without a userId
   * filter, fetch the globally top-K candidates, then filter by userId in application
   * code" instead of filtering inside the Mongo query itself, userB's 5 near-perfect-match
   * chunks would dominate the small candidate pool and userA's lower-scoring chunk would
   * never even be fetched — this test would then return [] instead of userA's chunk,
   * failing loudly. This is the required proof that the filter lives in the query, not
   * applied afterward in memory.
   */
  it('RNF-01: retrieves lower-scoring chunk for userA even when userB has globally superior cosine matches', async () => {
    const queryVector = unitLikeVector();
    const results = await searcher.searchSimilar({
      embedding: queryVector,
      userId: userAId.toHexString(),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(userAChunkId.toHexString());
    expect(results[0]?.userId).toBe(userAId.toHexString());
    for (const chunk of results) {
      expect(chunk.userId).toBe(userAId.toHexString());
    }
  });

  it('RNF-01: returns empty array when querying with a documentId belonging to another user', async () => {
    const queryVector = unitLikeVector();
    const results = await searcher.searchSimilar({
      embedding: queryVector,
      userId: userAId.toHexString(),
      documentIds: [userBDocId.toHexString()],
    });

    expect(results).toEqual([]);
  });

  it('returns empty array without throwing when the user has no chunks in the collection', async () => {
    const queryVector = unitLikeVector();
    const nonExistentUserId = new ObjectId().toHexString();
    const results = await searcher.searchSimilar({
      embedding: queryVector,
      userId: nonExistentUserId,
    });

    expect(results).toEqual([]);
  });

  it('correctly filters by documentIds, respects default limit, and orders by descending score', async () => {
    const queryVector = unitLikeVector();

    const docC1Results = await searcher.searchSimilar({
      embedding: queryVector,
      userId: userCId.toHexString(),
      documentIds: [docC1.toHexString()],
    });

    expect(docC1Results).toHaveLength(4);
    for (const chunk of docC1Results) {
      expect(chunk.documentId).toBe(docC1.toHexString());
      expect(chunk.userId).toBe(userCId.toHexString());
    }

    const allCResults = await searcher.searchSimilar({
      embedding: queryVector,
      userId: userCId.toHexString(),
    });

    expect(allCResults).toHaveLength(5);
    for (const chunk of allCResults) {
      expect(chunk.userId).toBe(userCId.toHexString());
    }

    for (let i = 0; i < allCResults.length - 1; i++) {
      const current = allCResults[i];
      const next = allCResults[i + 1];
      expect(current).toBeDefined();
      expect(next).toBeDefined();
      expect(current?.score).toBeGreaterThanOrEqual(next?.score ?? 0);
    }
  });
});
