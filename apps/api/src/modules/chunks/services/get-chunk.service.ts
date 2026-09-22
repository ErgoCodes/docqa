import { AppError } from '../../../errors.js';
import type { ChunkReader } from '../interfaces/chunk-reader.js';
import type { Chunk } from '../types/chunk.js';
import { ChunkErrors } from '../types/chunk-errors.js';

export interface GetChunkServiceDependencies {
  chunkReader: ChunkReader;
}

export interface GetChunkService {
  getById: (id: string, userId: string) => Promise<Chunk>;
}

export function createGetChunkService(deps: GetChunkServiceDependencies): GetChunkService {
  const { chunkReader } = deps;

  return {
    getById: async (id: string, userId: string): Promise<Chunk> => {
      const chunk = await chunkReader.findById(id, userId);

      if (!chunk) {
        throw new AppError(ChunkErrors.NOT_FOUND);
      }

      return chunk;
    },
  };
}
