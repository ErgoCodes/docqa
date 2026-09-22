import type { Chunk } from '../types/chunk.js';

export interface ChunkReader {
  findById: (id: string, userId: string) => Promise<Chunk | null>;
}
