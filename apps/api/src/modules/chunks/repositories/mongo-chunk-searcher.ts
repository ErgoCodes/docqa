import { ObjectId, type Collection, type Db } from 'mongodb';
import type { ChunkSearcher, SearchSimilarChunksParams } from '../interfaces/chunk-searcher.js';
import type { ChunkSearchResult } from '../types/chunk.js';

// Must stay in sync with apps/worker/src/modules/embeddings/repositories/chunks-vector-index.ts
// (no shared package between api and worker in this monorepo; intentional duplication).
export const CHUNKS_VECTOR_INDEX_NAME = 'chunks_vector_index';
export const EMBEDDING_DIMENSIONS = 512;

interface ChunkMongoDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  embedding: number[];
}

interface ChunkSearchMongoDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  score: number;
}

export function createMongoChunkSearcher(db: Db): ChunkSearcher {
  const collection: Collection<ChunkMongoDoc> = db.collection('chunks');

  return {
    searchSimilar: async (params: SearchSimilarChunksParams): Promise<ChunkSearchResult[]> => {
      // RNF-01: validate userId and fail closed before hitting Mongo to prevent cross-tenant data leakage.
      if (!ObjectId.isValid(params.userId)) {
        return [];
      }

      // An absent or empty documentIds array searches across all of the user's documents (RF-06).
      // A non-empty array with only invalid IDs produces $in: [], matching nothing and failing closed.
      const filter: Record<string, unknown> = { userId: new ObjectId(params.userId) };
      if (params.documentIds && params.documentIds.length > 0) {
        const validDocumentIds = params.documentIds
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));
        filter.documentId = { $in: validDocumentIds };
      }

      const limit = params.limit ?? 5;
      // MongoDB Atlas documented guidance: numCandidates ≈ 10-20x limit for good recall, capped at 10000.
      const numCandidates = Math.min(limit * 20, 10000);

      const results = await collection
        .aggregate<ChunkSearchMongoDoc>([
          {
            $vectorSearch: {
              index: CHUNKS_VECTOR_INDEX_NAME,
              path: 'embedding',
              queryVector: params.embedding,
              filter,
              numCandidates,
              limit,
            },
          },
          {
            $project: {
              _id: 1,
              documentId: 1,
              userId: 1,
              page: 1,
              index: 1,
              text: 1,
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ])
        .toArray();

      return results.map((doc) => ({
        id: doc._id.toHexString(),
        documentId: doc.documentId.toHexString(),
        userId: doc.userId.toHexString(),
        page: doc.page,
        index: doc.index,
        text: doc.text,
        score: doc.score,
      }));
    },
  };
}
