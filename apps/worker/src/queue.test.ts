import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentRepository } from './modules/documents/interfaces/document.repository.js';
import type { EmbedAndIndexChunksService } from './modules/embeddings/services/embed-and-index-chunks.service.js';
import type { PdfExtractionService } from './modules/extraction/services/pdf-extraction.service.js';
import type { IngestionJob } from './modules/ingestion/types/ingestion-job.js';
import { createProcessor } from './queue.js';

describe('createProcessor', () => {
  function createFakeJob(documentId = 'doc-123') {
    return {
      id: 'job-1',
      data: { documentId },
      log: vi.fn().mockResolvedValue(1),
    } as unknown as Job<IngestionJob>;
  }

  function createFakeDocument(overrides: Partial<{ id: string; userId: string }> = {}) {
    return {
      id: overrides.id ?? 'doc-abc',
      userId: overrides.userId ?? 'user-1',
      title: 'title',
      storageKey: 'key',
      pages: 1,
      status: 'processing' as const,
      error: null,
      createdAt: new Date(),
    };
  }

  it('runs extraction, chunking and embed-and-index in order', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue([{ page: 1, text: 'Hello world' }]),
    };
    const documents: DocumentRepository = {
      findById: vi.fn().mockResolvedValue(createFakeDocument({ id: 'doc-abc', userId: 'user-1' })),
      updateStatus: vi.fn(),
    };
    const embedAndIndex: EmbedAndIndexChunksService = { run: vi.fn().mockResolvedValue(undefined) };
    const processor = createProcessor({ documents, extraction, embedAndIndex });
    const fakeJob = createFakeJob('doc-abc');

    await processor(fakeJob);

    expect(extraction.run).toHaveBeenCalledWith('doc-abc');
    expect(documents.findById).toHaveBeenCalledWith('doc-abc');
    expect(embedAndIndex.run).toHaveBeenCalledTimes(1);
    const [calledDocumentId, calledChunks] = (embedAndIndex.run as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, Array<{ documentId: string; userId: string; text: string }>];
    expect(calledDocumentId).toBe('doc-abc');
    expect(calledChunks.every((chunk) => chunk.documentId === 'doc-abc' && chunk.userId === 'user-1')).toBe(
      true,
    );
    expect(fakeJob.log).toHaveBeenCalledWith('starting extraction for document doc-abc');
    expect(fakeJob.log).toHaveBeenCalledWith('finished embedding and indexing document doc-abc');
  });

  it('resolves cleanly without throwing and logs not found message when document is null before extraction', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue(null),
    };
    const documents: DocumentRepository = { findById: vi.fn(), updateStatus: vi.fn() };
    const embedAndIndex: EmbedAndIndexChunksService = { run: vi.fn() };
    const processor = createProcessor({ documents, extraction, embedAndIndex });
    const fakeJob = createFakeJob('doc-deleted');

    await expect(processor(fakeJob)).resolves.toBeUndefined();
    expect(fakeJob.log).toHaveBeenCalledWith(
      'document doc-deleted not found, skipping (likely deleted before processing)',
    );
    expect(embedAndIndex.run).not.toHaveBeenCalled();
  });

  it('resolves without embedding when document is deleted between extraction and chunking', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue([{ page: 1, text: 'Page 1' }]),
    };
    const documents: DocumentRepository = { findById: vi.fn().mockResolvedValue(null), updateStatus: vi.fn() };
    const embedAndIndex: EmbedAndIndexChunksService = { run: vi.fn() };
    const processor = createProcessor({ documents, extraction, embedAndIndex });
    const fakeJob = createFakeJob('doc-race');

    await expect(processor(fakeJob)).resolves.toBeUndefined();
    expect(fakeJob.log).toHaveBeenCalledWith('document doc-race deleted after extraction, skipping');
    expect(embedAndIndex.run).not.toHaveBeenCalled();
  });

  it('propagates rejection when extraction throws', async () => {
    const error = new Error('Extraction failed');
    const extraction: PdfExtractionService = {
      run: vi.fn().mockRejectedValue(error),
    };
    const documents: DocumentRepository = { findById: vi.fn(), updateStatus: vi.fn() };
    const embedAndIndex: EmbedAndIndexChunksService = { run: vi.fn() };
    const processor = createProcessor({ documents, extraction, embedAndIndex });
    const fakeJob = createFakeJob('doc-fail');

    await expect(processor(fakeJob)).rejects.toThrow('Extraction failed');
    expect(fakeJob.log).toHaveBeenCalledWith('starting extraction for document doc-fail');
    expect(embedAndIndex.run).not.toHaveBeenCalled();
  });

  it('propagates rejection when embed-and-index throws', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue([{ page: 1, text: 'Page 1' }]),
    };
    const documents: DocumentRepository = {
      findById: vi.fn().mockResolvedValue(createFakeDocument()),
      updateStatus: vi.fn(),
    };
    const error = new Error('Embedding failed');
    const embedAndIndex: EmbedAndIndexChunksService = { run: vi.fn().mockRejectedValue(error) };
    const processor = createProcessor({ documents, extraction, embedAndIndex });
    const fakeJob = createFakeJob('doc-embed-fail');

    await expect(processor(fakeJob)).rejects.toThrow('Embedding failed');
  });
});
