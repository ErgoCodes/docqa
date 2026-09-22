import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingsProvider } from '../../embeddings/interfaces/embeddings-provider.js';
import type { ChunkSearcher } from '../interfaces/chunk-searcher.js';
import type { ChunkSearchResult } from '../types/chunk.js';
import { createSearchChunksService } from './search-chunks.service.js';

describe('SearchChunksService', () => {
  function createMockDependencies() {
    const embeddingsProvider: EmbeddingsProvider = {
      embed: vi.fn(),
    };

    const chunkSearcher: ChunkSearcher = {
      searchSimilar: vi.fn(),
    };

    return { embeddingsProvider, chunkSearcher };
  }

  it('embeds question and searches similar chunks with default limit', async () => {
    const { embeddingsProvider, chunkSearcher } = createMockDependencies();
    const service = createSearchChunksService({ embeddingsProvider, chunkSearcher });

    const embedding = [0.1, 0.2, 0.3];
    const searchResults: ChunkSearchResult[] = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        userId: 'user-1',
        page: 1,
        index: 0,
        text: 'Some matched chunk text',
        score: 0.95,
      },
    ];

    vi.mocked(embeddingsProvider.embed).mockResolvedValue([embedding]);
    vi.mocked(chunkSearcher.searchSimilar).mockResolvedValue(searchResults);

    const result = await service.searchChunks({
      userId: 'user-1',
      question: 'What is the summary?',
    });

    expect(embeddingsProvider.embed).toHaveBeenCalledTimes(1);
    expect(embeddingsProvider.embed).toHaveBeenCalledWith(['What is the summary?']);
    expect(chunkSearcher.searchSimilar).toHaveBeenCalledTimes(1);
    expect(chunkSearcher.searchSimilar).toHaveBeenCalledWith({
      embedding,
      userId: 'user-1',
      documentIds: undefined,
      limit: 5,
    });
    expect(result).toEqual(searchResults);
  });

  it('passes custom limit and documentIds through to searchSimilar unchanged', async () => {
    const { embeddingsProvider, chunkSearcher } = createMockDependencies();
    const service = createSearchChunksService({ embeddingsProvider, chunkSearcher });

    const embedding = [0.4, 0.5, 0.6];
    const searchResults: ChunkSearchResult[] = [
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        userId: 'user-1',
        page: 2,
        index: 1,
        text: 'Another chunk',
        score: 0.88,
      },
    ];

    vi.mocked(embeddingsProvider.embed).mockResolvedValue([embedding]);
    vi.mocked(chunkSearcher.searchSimilar).mockResolvedValue(searchResults);

    const result = await service.searchChunks({
      userId: 'user-1',
      question: 'Specific query',
      documentIds: ['doc-1', 'doc-2'],
      limit: 10,
    });

    expect(embeddingsProvider.embed).toHaveBeenCalledWith(['Specific query']);
    expect(chunkSearcher.searchSimilar).toHaveBeenCalledWith({
      embedding,
      userId: 'user-1',
      documentIds: ['doc-1', 'doc-2'],
      limit: 10,
    });
    expect(result).toEqual(searchResults);
  });

  it('propagates rejection when embed rejects and does not call searchSimilar', async () => {
    const { embeddingsProvider, chunkSearcher } = createMockDependencies();
    const service = createSearchChunksService({ embeddingsProvider, chunkSearcher });

    const embedError = new Error('Embeddings provider failure');
    vi.mocked(embeddingsProvider.embed).mockRejectedValue(embedError);

    await expect(
      service.searchChunks({
        userId: 'user-1',
        question: 'Failing question',
      }),
    ).rejects.toThrow('Embeddings provider failure');

    expect(chunkSearcher.searchSimilar).not.toHaveBeenCalled();
  });

  it('rejects when embed resolves to an empty array and does not call searchSimilar', async () => {
    const { embeddingsProvider, chunkSearcher } = createMockDependencies();
    const service = createSearchChunksService({ embeddingsProvider, chunkSearcher });

    vi.mocked(embeddingsProvider.embed).mockResolvedValue([]);

    await expect(
      service.searchChunks({
        userId: 'user-1',
        question: 'Empty vector question',
      }),
    ).rejects.toThrow('Embeddings provider returned no vector for the question');

    expect(chunkSearcher.searchSimilar).not.toHaveBeenCalled();
  });

  it('resolves empty array without throwing when searchSimilar returns empty array', async () => {
    const { embeddingsProvider, chunkSearcher } = createMockDependencies();
    const service = createSearchChunksService({ embeddingsProvider, chunkSearcher });

    const embedding = [0.1, 0.2];
    vi.mocked(embeddingsProvider.embed).mockResolvedValue([embedding]);
    vi.mocked(chunkSearcher.searchSimilar).mockResolvedValue([]);

    const result = await service.searchChunks({
      userId: 'user-1',
      question: 'No matches question',
    });

    expect(result).toEqual([]);
    expect(chunkSearcher.searchSimilar).toHaveBeenCalledTimes(1);
  });
});
