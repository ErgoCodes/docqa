import type { ChunkSearchResult } from '../types/chunk.js';

export interface SearchSimilarChunksParams {
  embedding: number[];
  userId: string;
  documentIds?: string[];
  limit?: number;
}

export interface ChunkSearcher {
  searchSimilar: (params: SearchSimilarChunksParams) => Promise<ChunkSearchResult[]>;
}
