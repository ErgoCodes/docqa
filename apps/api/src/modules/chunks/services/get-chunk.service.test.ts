import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../errors.js';
import type { ChunkReader } from '../interfaces/chunk-reader.js';
import type { Chunk } from '../types/chunk.js';
import { ChunkErrors } from '../types/chunk-errors.js';
import { createGetChunkService } from './get-chunk.service.js';

describe('GetChunkService', () => {
  function createMockDependencies() {
    const chunkReader: ChunkReader = {
      findById: vi.fn(),
    };

    return { chunkReader };
  }

  const sampleChunk: Chunk = {
    id: 'chunk-1',
    documentId: 'doc-1',
    userId: 'user-1',
    page: 2,
    index: 0,
    text: 'Extracted chunk text',
  };

  it('returns the chunk when found for the requesting user', async () => {
    const { chunkReader } = createMockDependencies();
    const service = createGetChunkService({ chunkReader });

    vi.mocked(chunkReader.findById).mockResolvedValue(sampleChunk);

    const result = await service.getById('chunk-1', 'user-1');

    expect(chunkReader.findById).toHaveBeenCalledWith('chunk-1', 'user-1');
    expect(result).toEqual(sampleChunk);
  });

  it('throws CHUNK_NOT_FOUND when chunk does not exist', async () => {
    const { chunkReader } = createMockDependencies();
    const service = createGetChunkService({ chunkReader });

    vi.mocked(chunkReader.findById).mockResolvedValue(null);

    await expect(service.getById('non-existent', 'user-1')).rejects.toThrow(
      new AppError(ChunkErrors.NOT_FOUND),
    );
  });

  it('RNF-01: throws CHUNK_NOT_FOUND when chunk belongs to another user', async () => {
    const { chunkReader } = createMockDependencies();
    const service = createGetChunkService({ chunkReader });

    vi.mocked(chunkReader.findById).mockResolvedValue(null);

    await expect(service.getById('chunk-1', 'other-user')).rejects.toThrow(
      new AppError(ChunkErrors.NOT_FOUND),
    );
    expect(chunkReader.findById).toHaveBeenCalledWith('chunk-1', 'other-user');
  });
});
