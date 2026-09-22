import type { DocumentChunk } from '../../chunking/types/chunk.js';

export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}
