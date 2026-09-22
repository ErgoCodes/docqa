import type { EmbeddedChunk } from '../types/embedded-chunk.js';

export interface ChunkRepository {
  insertMany(chunks: EmbeddedChunk[]): Promise<void>;
}
