import { randomUUID } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CHUNKS_VECTOR_INDEX_NAME,
  EMBEDDING_DIMENSIONS,
  ensureChunksVectorIndex,
} from './chunks-vector-index.js';

describe('ensureChunksVectorIndex', () => {
  it('calls createCollection and createSearchIndexes with expected vectorSearch definition', async () => {
    const createCollectionMock = vi.fn().mockResolvedValue({});
    const createSearchIndexesMock = vi.fn().mockResolvedValue(['chunks_vector_index']);
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await ensureChunksVectorIndex(mockDb);

    expect(createCollectionMock).toHaveBeenCalledWith('chunks');
    expect(mockDb.collection).toHaveBeenCalledWith('chunks');
    expect(createSearchIndexesMock).toHaveBeenCalledTimes(1);
    expect(createSearchIndexesMock).toHaveBeenCalledWith([
      {
        name: CHUNKS_VECTOR_INDEX_NAME,
        type: 'vectorSearch',
        definition: {
          fields: [
            {
              type: 'vector',
              path: 'embedding',
              numDimensions: EMBEDDING_DIMENSIONS,
              similarity: 'cosine',
            },
            { type: 'filter', path: 'userId' },
            { type: 'filter', path: 'documentId' },
          ],
        },
      },
    ]);
  });

  it('resolves without error if collection already exists (by codeName or code)', async () => {
    const namespaceError = Object.assign(new Error('collection already exists'), {
      codeName: 'NamespaceExists',
      code: 48,
    });
    const createCollectionMock = vi.fn().mockRejectedValue(namespaceError);
    const createSearchIndexesMock = vi.fn().mockResolvedValue(['chunks_vector_index']);
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await expect(ensureChunksVectorIndex(mockDb)).resolves.toBeUndefined();
    expect(createSearchIndexesMock).toHaveBeenCalledTimes(1);
  });

  it('resolves without error if collection already exists (by error message)', async () => {
    const namespaceError = new Error('Collection docqa.chunks already exists');
    const createCollectionMock = vi.fn().mockRejectedValue(namespaceError);
    const createSearchIndexesMock = vi.fn().mockResolvedValue(['chunks_vector_index']);
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await expect(ensureChunksVectorIndex(mockDb)).resolves.toBeUndefined();
    expect(createSearchIndexesMock).toHaveBeenCalledTimes(1);
  });

  it('re-throws if createCollection fails with any other error', async () => {
    const networkError = new Error('Connection refused');
    const createCollectionMock = vi.fn().mockRejectedValue(networkError);
    const createSearchIndexesMock = vi.fn().mockResolvedValue(['chunks_vector_index']);
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await expect(ensureChunksVectorIndex(mockDb)).rejects.toThrow('Connection refused');
    expect(createSearchIndexesMock).not.toHaveBeenCalled();
  });

  it('resolves without error if index already exists (by error message)', async () => {
    const createCollectionMock = vi.fn().mockResolvedValue({});
    const createSearchIndexesMock = vi
      .fn()
      .mockRejectedValue(new Error('Index chunks_vector_index already exists'));
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await expect(ensureChunksVectorIndex(mockDb)).resolves.toBeUndefined();
  });

  it('resolves without error if index already exists (by codeName or code)', async () => {
    const duplicateError = Object.assign(new Error('duplicate index'), {
      codeName: 'IndexAlreadyExists',
      code: 68,
    });
    const createCollectionMock = vi.fn().mockResolvedValue({});
    const createSearchIndexesMock = vi.fn().mockRejectedValue(duplicateError);
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await expect(ensureChunksVectorIndex(mockDb)).resolves.toBeUndefined();
  });

  it('re-throws if createSearchIndexes fails with any other error', async () => {
    const networkError = new Error('Connection refused');
    const createCollectionMock = vi.fn().mockResolvedValue({});
    const createSearchIndexesMock = vi.fn().mockRejectedValue(networkError);
    const mockDb = {
      createCollection: createCollectionMock,
      collection: vi.fn().mockReturnValue({
        createSearchIndexes: createSearchIndexesMock,
      }),
    } as unknown as Db;

    await expect(ensureChunksVectorIndex(mockDb)).rejects.toThrow('Connection refused');
  });
});

describe.skipIf(!process.env.MONGODB_TEST_URI)(
  'integración con MongoDB (ensureChunksVectorIndex)',
  () => {
    let client: MongoClient;
    let db: Db;
    const testDbName = `docqa-test-chunks-${randomUUID()}`;

    beforeAll(async () => {
      client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
      await client.connect();
      db = client.db(testDbName);
    });

    afterAll(async () => {
      if (db) {
        await db.dropDatabase();
      }
      if (client) {
        await client.close();
      }
    });

    it('creates vector search index idempotently', async () => {
      await ensureChunksVectorIndex(db);
      await ensureChunksVectorIndex(db);

      const collection = db.collection('chunks');
      const indexes = await collection.listSearchIndexes().toArray();
      const vectorIndex = indexes.find((idx) => idx.name === CHUNKS_VECTOR_INDEX_NAME);
      expect(vectorIndex).toBeDefined();
    });
  },
);
