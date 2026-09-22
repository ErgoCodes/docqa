import type { EmbeddingsProvider } from '../../embeddings/interfaces/embeddings-provider.js';
import type { ChunkSearcher } from '../interfaces/chunk-searcher.js';
import type { ChunkSearchResult } from '../types/chunk.js';

export interface SearchChunksDependencies {
  embeddingsProvider: EmbeddingsProvider;
  chunkSearcher: ChunkSearcher;
}

export interface SearchChunksInput {
  userId: string;
  question: string;
  documentIds?: string[];
  limit?: number;
}

export interface SearchChunksService {
  searchChunks: (input: SearchChunksInput) => Promise<ChunkSearchResult[]>;
}

export function createSearchChunksService(deps: SearchChunksDependencies): SearchChunksService {
  const { embeddingsProvider, chunkSearcher } = deps;

  return {
    searchChunks: async (input: SearchChunksInput): Promise<ChunkSearchResult[]> => {
      const embeddings = await embeddingsProvider.embed([input.question]);
      const embedding = embeddings[0];

      // Defensive guard against contract violation by provider; not an expected runtime path.
      if (!embedding) {
        throw new Error('Embeddings provider returned no vector for the question');
      }

      return chunkSearcher.searchSimilar({
        embedding,
        userId: input.userId,
        documentIds: input.documentIds,
        limit: input.limit ?? 5,
      });
    },
  };
}
