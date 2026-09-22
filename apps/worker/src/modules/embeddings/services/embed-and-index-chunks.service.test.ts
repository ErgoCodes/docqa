import { describe, expect, it, vi } from 'vitest';
import type { DocumentChunk } from '../../chunking/types/chunk.js';
import type { Document } from '../../documents/types/document.js';
import {
  createInMemoryChunkRepository,
  createInMemoryDocumentRepository,
  createInMemoryEmbeddingsProvider,
} from '../../../testing/fakes.js';
import type { ChunkRepository } from '../interfaces/chunk.repository.js';
import type { EmbeddingsProvider } from '../interfaces/embeddings-provider.js';
import { EMBEDDING_DIMENSIONS } from '../repositories/chunks-vector-index.js';
import { createEmbedAndIndexChunksService } from './embed-and-index-chunks.service.js';

describe('createEmbedAndIndexChunksService', () => {
  const validVector = Array<number>(EMBEDDING_DIMENSIONS).fill(0.01);

  function createSampleDocument(overrides?: Partial<Document>): Document {
    return {
      id: 'doc-1',
      userId: 'user-1',
      title: 'Sample Document',
      storageKey: 'sample-key',
      pages: 1,
      status: 'processing',
      error: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  function createSampleChunks(documentId = 'doc-1', userId = 'user-1'): DocumentChunk[] {
    return [
      { documentId, userId, page: 1, index: 0, text: 'First chunk text' },
      { documentId, userId, page: 1, index: 1, text: 'Second chunk text' },
      { documentId, userId, page: 1, index: 2, text: 'Third chunk text' },
    ];
  }

  it('1. happy path: indexes chunks and marks document as ready', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider = createInMemoryEmbeddingsProvider(validVector);

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId);
    await service.run(doc.id, chunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({ status: 'ready', error: null });

    const storedChunks = chunkRepository.getAll();
    expect(storedChunks).toHaveLength(3);
    for (let i = 0; i < chunks.length; i++) {
      expect(storedChunks[i]).toEqual({
        ...chunks[i],
        embedding: validVector,
      });
    }
  });

  it('2. document not found: throws error and does not insert chunks', async () => {
    const documentRepository = createInMemoryDocumentRepository([]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider = createInMemoryEmbeddingsProvider(validVector);

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks('non-existent-doc', 'user-1');
    await expect(service.run('non-existent-doc', chunks)).rejects.toThrow(
      'Document non-existent-doc not found',
    );

    expect(chunkRepository.getAll()).toEqual([]);
  });

  it('3. empty chunks: marks document as error and never calls embed', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embedSpy = vi.fn().mockResolvedValue([]);
    const embeddingsProvider: EmbeddingsProvider = { embed: embedSpy };

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    await service.run(doc.id, []);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({
      status: 'error',
      error: 'No se encontró contenido para indexar en el documento',
    });
    expect(embedSpy).not.toHaveBeenCalled();
    expect(chunkRepository.getAll()).toEqual([]);
  });

  it('4. all chunks with whitespace text: marks document as error and never calls embed', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embedSpy = vi.fn().mockResolvedValue([]);
    const embeddingsProvider: EmbeddingsProvider = { embed: embedSpy };

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const blankChunks: DocumentChunk[] = [
      { documentId: doc.id, userId: doc.userId, page: 1, index: 0, text: '   ' },
      { documentId: doc.id, userId: doc.userId, page: 1, index: 1, text: '' },
      { documentId: doc.id, userId: doc.userId, page: 1, index: 2, text: '  \n\t  ' },
    ];

    await service.run(doc.id, blankChunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({
      status: 'error',
      error: 'No se encontró contenido para indexar en el documento',
    });
    expect(embedSpy).not.toHaveBeenCalled();
    expect(chunkRepository.getAll()).toEqual([]);
  });

  it('5. whitespace chunk mixed with valid chunks: filters whitespace and indexes remaining chunks', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider = createInMemoryEmbeddingsProvider(validVector);

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const mixedChunks: DocumentChunk[] = [
      { documentId: doc.id, userId: doc.userId, page: 1, index: 0, text: 'Valid chunk 1' },
      { documentId: doc.id, userId: doc.userId, page: 1, index: 1, text: '   ' },
      { documentId: doc.id, userId: doc.userId, page: 1, index: 2, text: 'Valid chunk 2' },
    ];

    await service.run(doc.id, mixedChunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({ status: 'ready', error: null });

    const storedChunks = chunkRepository.getAll();
    expect(storedChunks).toHaveLength(2);
    expect(storedChunks[0]?.text).toBe('Valid chunk 1');
    expect(storedChunks[1]?.text).toBe('Valid chunk 2');
  });

  it('6. embeddings API failure: marks document as error and does not insert chunks', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider: EmbeddingsProvider = {
      embed: vi.fn().mockRejectedValue(new Error('network error')),
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId);
    await service.run(doc.id, chunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });
    expect(chunkRepository.getAll()).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it('7. insertMany failure: marks document as error', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository: ChunkRepository = {
      insertMany: vi.fn().mockRejectedValue(new Error('mongo write failed')),
    };
    const embeddingsProvider = createInMemoryEmbeddingsProvider(validVector);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId);
    await service.run(doc.id, chunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });

    consoleErrorSpy.mockRestore();
  });

  it('8. embeddings length mismatch: marks document as error and does not insert', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider: EmbeddingsProvider = {
      embed: vi.fn().mockResolvedValue([validVector]),
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId); // 3 chunks, but provider returns 1 vector
    await service.run(doc.id, chunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });
    expect(chunkRepository.getAll()).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it('9. embedding dimension mismatch: default 3 dimensions fails against 512 dimensions', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider = createInMemoryEmbeddingsProvider(); // default 3 dimensions [0.1, 0.2, 0.3]

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId);
    await service.run(doc.id, chunks);

    const status = documentRepository.getStatus(doc.id);
    expect(status).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });
    expect(chunkRepository.getAll()).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it('10. RNF-01 defense in depth: rejects chunks with mismatched userId or documentId without inserting', async () => {
    const doc = createSampleDocument({ userId: 'user-real' });
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider = createInMemoryEmbeddingsProvider(validVector);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    // Mismatched userId
    const chunksWithWrongUser: DocumentChunk[] = [
      { documentId: doc.id, userId: 'user-real', page: 1, index: 0, text: 'Chunk 1' },
      { documentId: doc.id, userId: 'otro-usuario', page: 1, index: 1, text: 'Chunk 2' },
    ];

    await service.run(doc.id, chunksWithWrongUser);

    expect(documentRepository.getStatus(doc.id)).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });
    expect(chunkRepository.getAll()).toEqual([]);

    // Mismatched documentId
    const chunksWithWrongDoc: DocumentChunk[] = [
      { documentId: 'other-doc-id', userId: 'user-real', page: 1, index: 0, text: 'Chunk 1' },
    ];

    await service.run(doc.id, chunksWithWrongDoc);

    expect(documentRepository.getStatus(doc.id)).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });
    expect(chunkRepository.getAll()).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it('11. verifies console.error is called with a formatted string message and not an error object', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const rawErrorMessage = 'connection dropped by remote server';
    const embeddingsProvider: EmbeddingsProvider = {
      embed: vi.fn().mockRejectedValue(new Error(rawErrorMessage)),
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId);
    await service.run(doc.id, chunks);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const loggedArg: unknown = consoleErrorSpy.mock.calls[0]?.[0];
    expect(typeof loggedArg).toBe('string');
    expect(loggedArg).toContain(rawErrorMessage);
    expect(loggedArg).toContain(doc.id);
    expect(loggedArg).not.toBeInstanceOf(Error);

    consoleErrorSpy.mockRestore();
  });

  it('handles non-Error thrown exceptions by formatting String(error)', async () => {
    const doc = createSampleDocument();
    const documentRepository = createInMemoryDocumentRepository([doc]);
    const chunkRepository = createInMemoryChunkRepository();
    const embeddingsProvider: EmbeddingsProvider = {
      embed: vi.fn().mockRejectedValue('raw-string-rejection'),
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = createEmbedAndIndexChunksService({
      documentRepository,
      chunkRepository,
      embeddingsProvider,
    });

    const chunks = createSampleChunks(doc.id, doc.userId);
    await service.run(doc.id, chunks);

    expect(documentRepository.getStatus(doc.id)).toEqual({
      status: 'error',
      error: 'No se pudieron generar o guardar los embeddings del documento',
    });
    const loggedArg: unknown = consoleErrorSpy.mock.calls[0]?.[0];
    expect(typeof loggedArg).toBe('string');
    expect(loggedArg).toContain('raw-string-rejection');

    consoleErrorSpy.mockRestore();
  });
});
