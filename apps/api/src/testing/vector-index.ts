import type { Db } from 'mongodb';
import {
  CHUNKS_VECTOR_INDEX_NAME,
  EMBEDDING_DIMENSIONS,
} from '../modules/chunks/repositories/mongo-chunk-searcher.js';

interface SearchIndexInfo {
  name: string;
  queryable?: boolean;
  status?: string;
}

function isAlreadyExistsError(error: unknown, code: number, codeName: string): boolean {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: number; codeName?: string; message?: string };
    if (candidate.code === code || candidate.codeName === codeName) {
      return true;
    }
    if (typeof candidate.message === 'string' && /already exists/i.test(candidate.message)) {
      return true;
    }
  }
  return false;
}

export async function ensureChunksVectorIndexForTests(db: Db): Promise<void> {
  try {
    await db.createCollection('chunks');
  } catch (error: unknown) {
    if (!isAlreadyExistsError(error, 48, 'NamespaceExists')) {
      throw error;
    }
  }

  const collection = db.collection('chunks');

  try {
    await collection.createSearchIndexes([
      {
        name: CHUNKS_VECTOR_INDEX_NAME,
        type: 'vectorSearch',
        definition: {
          fields: [
            { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMENSIONS, similarity: 'cosine' },
            { type: 'filter', path: 'userId' },
            { type: 'filter', path: 'documentId' },
          ],
        },
      },
    ]);
  } catch (error: unknown) {
    if (!isAlreadyExistsError(error, 68, 'IndexAlreadyExists')) {
      throw error;
    }
  }

  const timeoutMs = 60_000;
  const pollIntervalMs = 500;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const indexes = (await collection.listSearchIndexes(CHUNKS_VECTOR_INDEX_NAME).toArray()) as SearchIndexInfo[];
    const targetIndex = indexes.find((idx) => idx.name === CHUNKS_VECTOR_INDEX_NAME);

    if (targetIndex) {
      if (
        targetIndex.queryable === true ||
        (targetIndex.queryable === undefined && targetIndex.status === 'READY')
      ) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Search index "${CHUNKS_VECTOR_INDEX_NAME}" on collection "chunks" did not become queryable within ${timeoutMs}ms.`
  );
}
