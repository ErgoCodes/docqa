import type { Db } from 'mongodb';

export const CHUNKS_VECTOR_INDEX_NAME = 'chunks_vector_index';
export const EMBEDDING_DIMENSIONS = 512; // tied to the voyage-3-lite model configured in EMBEDDINGS_MODEL; changing the model requires updating this and rebuilding the index

function isDuplicateIndexError(error: unknown): boolean {
  if (error instanceof Error && /already exists/i.test(error.message)) {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { codeName?: unknown; code?: unknown; message?: unknown };
    if (candidate.codeName === 'IndexAlreadyExists' || candidate.code === 68) {
      return true;
    }
    if (typeof candidate.message === 'string' && /already exists/i.test(candidate.message)) {
      return true;
    }
  }

  return false;
}

function isNamespaceExistsError(error: unknown): boolean {
  if (error instanceof Error && /already exists/i.test(error.message)) {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { codeName?: unknown; code?: unknown; message?: unknown };
    if (candidate.codeName === 'NamespaceExists' || candidate.code === 48) {
      return true;
    }
    if (typeof candidate.message === 'string' && /already exists/i.test(candidate.message)) {
      return true;
    }
  }

  return false;
}

async function ensureCollectionExists(db: Db, collectionName: string): Promise<void> {
  try {
    await db.createCollection(collectionName);
  } catch (error: unknown) {
    if (isNamespaceExistsError(error)) {
      return;
    }
    throw error;
  }
}

export async function ensureChunksVectorIndex(db: Db): Promise<void> {
  await ensureCollectionExists(db, 'chunks');

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
    if (isDuplicateIndexError(error)) {
      return;
    }
    throw error;
  }
}
