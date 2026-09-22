import { ObjectId, type Db } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import {
  CHUNKS_VECTOR_INDEX_NAME,
  createMongoChunkSearcher,
} from './mongo-chunk-searcher.js';

interface FakeChunkDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  score: number;
  embedding?: number[];
}

interface VectorSearchStage {
  $vectorSearch: {
    index: string;
    path: string;
    queryVector: number[];
    filter: Record<string, unknown>;
    numCandidates: number;
    limit: number;
  };
}

interface ProjectStage {
  $project: Record<string, unknown>;
}

function createMockDb(fakeDocs: FakeChunkDoc[] = []) {
  const toArrayMock = vi.fn().mockResolvedValue(fakeDocs);
  const aggregateMock = vi.fn().mockReturnValue({ toArray: toArrayMock });
  const collectionMock = vi.fn().mockReturnValue({ aggregate: aggregateMock });
  const db = { collection: collectionMock } as unknown as Db;

  return { db, collectionMock, aggregateMock, toArrayMock };
}

function getPipelineStages(aggregateMock: ReturnType<typeof vi.fn>): [VectorSearchStage, ProjectStage] {
  const firstCall = aggregateMock.mock.calls[0];
  if (!firstCall || !Array.isArray(firstCall[0])) {
    throw new Error('Expected aggregate to have been called with pipeline array');
  }
  return firstCall[0] as [VectorSearchStage, ProjectStage];
}

describe('createMongoChunkSearcher', () => {
  it('omits documentId from filter when documentIds is not provided', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
    });

    expect(aggregateMock).toHaveBeenCalledTimes(1);
    const [vectorStage] = getPipelineStages(aggregateMock);
    const filter = vectorStage.$vectorSearch.filter;

    expect(filter).toEqual({ userId: new ObjectId(userId) });
    expect(filter).not.toHaveProperty('documentId');
  });

  it('omits documentId from filter when documentIds is explicitly empty', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
      documentIds: [],
    });

    expect(aggregateMock).toHaveBeenCalledTimes(1);
    const [vectorStage] = getPipelineStages(aggregateMock);
    const filter = vectorStage.$vectorSearch.filter;

    expect(filter).toEqual({ userId: new ObjectId(userId) });
    expect(filter).not.toHaveProperty('documentId');
  });

  it('includes documentId $in filter with ObjectIds when valid documentIds are provided', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();
    const docId1 = new ObjectId().toHexString();
    const docId2 = new ObjectId().toHexString();

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
      documentIds: [docId1, docId2],
    });

    expect(aggregateMock).toHaveBeenCalledTimes(1);
    const [vectorStage] = getPipelineStages(aggregateMock);
    const filter = vectorStage.$vectorSearch.filter;

    expect(filter).toEqual({
      userId: new ObjectId(userId),
      documentId: {
        $in: [new ObjectId(docId1), new ObjectId(docId2)],
      },
    });
  });

  it('filters out malformed documentIds leaving only valid ObjectIds in $in', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();
    const validDocId = new ObjectId().toHexString();
    const malformedDocId = 'not-a-valid-hex-id';

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
      documentIds: [validDocId, malformedDocId],
    });

    expect(aggregateMock).toHaveBeenCalledTimes(1);
    const [vectorStage] = getPipelineStages(aggregateMock);
    const filter = vectorStage.$vectorSearch.filter;

    expect(filter).toEqual({
      userId: new ObjectId(userId),
      documentId: {
        $in: [new ObjectId(validDocId)],
      },
    });
  });

  it('uses default limit of 5 and scales numCandidates to 100 when limit is not provided', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
    });

    const [vectorStage] = getPipelineStages(aggregateMock);
    expect(vectorStage.$vectorSearch.limit).toBe(5);
    expect(vectorStage.$vectorSearch.numCandidates).toBe(100);
  });

  it('passes through custom limit and scales numCandidates accordingly', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
      limit: 3,
    });

    const [vectorStage] = getPipelineStages(aggregateMock);
    expect(vectorStage.$vectorSearch.limit).toBe(3);
    expect(vectorStage.$vectorSearch.numCandidates).toBe(60);
  });

  it('caps numCandidates at 10000 for large limits', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();

    await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
      limit: 1000,
    });

    const [vectorStage] = getPipelineStages(aggregateMock);
    expect(vectorStage.$vectorSearch.limit).toBe(1000);
    expect(vectorStage.$vectorSearch.numCandidates).toBe(10000);
  });

  it('maps mongo documents to ChunkSearchResult and never includes embedding', async () => {
    const chunkId = new ObjectId();
    const docId = new ObjectId();
    const userId = new ObjectId();

    const fakeDocs: FakeChunkDoc[] = [
      {
        _id: chunkId,
        documentId: docId,
        userId,
        page: 2,
        index: 4,
        text: 'Relevant chunk content',
        score: 0.92,
        embedding: [0.01, 0.02, 0.03],
      },
    ];

    const { db } = createMockDb(fakeDocs);
    const searcher = createMongoChunkSearcher(db);

    const results = await searcher.searchSimilar({
      userId: userId.toHexString(),
      embedding: [0.1, 0.2],
    });

    expect(results).toEqual([
      {
        id: chunkId.toHexString(),
        documentId: docId.toHexString(),
        userId: userId.toHexString(),
        page: 2,
        index: 4,
        text: 'Relevant chunk content',
        score: 0.92,
      },
    ]);
    expect(results[0]).not.toHaveProperty('embedding');
  });

  it('fails closed and returns [] without calling aggregate when userId is invalid', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);

    const results = await searcher.searchSimilar({
      userId: 'not-an-object-id',
      embedding: [0.1, 0.2],
    });

    expect(results).toEqual([]);
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  it('resolves empty array without throwing when aggregate returns no documents', async () => {
    const { db, aggregateMock } = createMockDb([]);
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();

    const results = await searcher.searchSimilar({
      userId,
      embedding: [0.1, 0.2],
    });

    expect(results).toEqual([]);
    expect(aggregateMock).toHaveBeenCalledTimes(1);
  });

  it('configures vectorSearch and project stages correctly', async () => {
    const { db, aggregateMock } = createMockDb();
    const searcher = createMongoChunkSearcher(db);
    const userId = new ObjectId().toHexString();
    const embedding = [0.1, 0.2, 0.3];

    await searcher.searchSimilar({
      userId,
      embedding,
    });

    const [vectorStage, projectStage] = getPipelineStages(aggregateMock);

    expect(vectorStage.$vectorSearch.index).toBe(CHUNKS_VECTOR_INDEX_NAME);
    expect(vectorStage.$vectorSearch.path).toBe('embedding');
    expect(vectorStage.$vectorSearch.queryVector).toEqual(embedding);
    expect(projectStage.$project).toEqual({
      _id: 1,
      documentId: 1,
      userId: 1,
      page: 1,
      index: 1,
      text: 1,
      score: { $meta: 'vectorSearchScore' },
    });
  });
});
