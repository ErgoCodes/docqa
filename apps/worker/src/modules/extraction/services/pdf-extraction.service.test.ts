import { describe, expect, it, vi } from 'vitest';
import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { Document } from '../../documents/types/document.js';
import type { ObjectStorage } from '../../storage/interfaces/object-storage.js';
import type { PdfTextExtractor } from '../interfaces/pdf-text-extractor.js';
import { createPdfExtractionService } from './pdf-extraction.service.js';

describe('createPdfExtractionService', () => {
  const sampleDocument: Document = {
    id: 'doc-123',
    userId: 'user-456',
    title: 'sample.pdf',
    storageKey: 'user-456/doc-123.pdf',
    pages: 3,
    status: 'processing',
    error: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  function createMocks() {
    const documents: DocumentRepository = {
      findById: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const storage: ObjectStorage = {
      getObject: vi.fn(),
    };
    const extractor: PdfTextExtractor = {
      extract: vi.fn(),
    };

    return { documents, storage, extractor };
  }

  it('resolves to null and does not call updateStatus when document is not found', async () => {
    const mocks = createMocks();
    vi.mocked(mocks.documents.findById).mockResolvedValue(null);

    const service = createPdfExtractionService(mocks);
    const result = await service.run('missing-id');

    expect(result).toBeNull();
    expect(mocks.documents.updateStatus).not.toHaveBeenCalled();
    expect(mocks.storage.getObject).not.toHaveBeenCalled();
    expect(mocks.extractor.extract).not.toHaveBeenCalled();
  });

  it('rejects with download failure message and updates status to error when storage.getObject fails', async () => {
    const mocks = createMocks();
    vi.mocked(mocks.documents.findById).mockResolvedValue(sampleDocument);
    vi.mocked(mocks.storage.getObject).mockRejectedValue(new Error('S3 connection timeout'));

    const service = createPdfExtractionService(mocks);

    await expect(service.run('doc-123')).rejects.toThrow(
      'Failed to download PDF from object storage: S3 connection timeout',
    );
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith('doc-123', 'processing');
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith(
      'doc-123',
      'error',
      'No se pudo descargar el archivo para procesarlo',
    );
  });

  it('rejects with extraction failure message and updates status to error when extractor.extract fails', async () => {
    const mocks = createMocks();
    vi.mocked(mocks.documents.findById).mockResolvedValue(sampleDocument);
    vi.mocked(mocks.storage.getObject).mockResolvedValue(Buffer.from('fake-pdf'));
    vi.mocked(mocks.extractor.extract).mockRejectedValue(new Error('Corrupt PDF stream'));

    const service = createPdfExtractionService(mocks);

    await expect(service.run('doc-123')).rejects.toThrow(
      'Failed to extract text from PDF: Corrupt PDF stream',
    );
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith('doc-123', 'processing');
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith(
      'doc-123',
      'error',
      'El PDF está dañado o no se pudo leer',
    );
  });

  it('rejects with no extractable text when all pages have empty text', async () => {
    const mocks = createMocks();
    vi.mocked(mocks.documents.findById).mockResolvedValue(sampleDocument);
    vi.mocked(mocks.storage.getObject).mockResolvedValue(Buffer.from('scanned-pdf'));
    vi.mocked(mocks.extractor.extract).mockResolvedValue([
      { page: 1, text: '' },
      { page: 2, text: '' },
    ]);

    const service = createPdfExtractionService(mocks);

    await expect(service.run('doc-123')).rejects.toThrow(
      'PDF has no extractable text (likely a scanned document)',
    );
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith('doc-123', 'processing');
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith(
      'doc-123',
      'error',
      'No se pudo extraer texto del PDF (¿es un documento escaneado sin texto seleccionable?)',
    );
  });

  it('rejects with no extractable text when extractor returns an empty array of pages', async () => {
    const mocks = createMocks();
    vi.mocked(mocks.documents.findById).mockResolvedValue(sampleDocument);
    vi.mocked(mocks.storage.getObject).mockResolvedValue(Buffer.from('empty-pdf'));
    vi.mocked(mocks.extractor.extract).mockResolvedValue([]);

    const service = createPdfExtractionService(mocks);

    await expect(service.run('doc-123')).rejects.toThrow(
      'PDF has no extractable text (likely a scanned document)',
    );
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith('doc-123', 'processing');
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith(
      'doc-123',
      'error',
      'No se pudo extraer texto del PDF (¿es un documento escaneado sin texto seleccionable?)',
    );
  });

  it('extracts pages successfully on the happy path', async () => {
    const mocks = createMocks();
    const pdfBuffer = Buffer.from('valid-pdf-data');
    const extractedPages = [
      { page: 1, text: 'Page 1 contents' },
      { page: 2, text: 'Page 2 contents' },
    ];

    vi.mocked(mocks.documents.findById).mockResolvedValue(sampleDocument);
    vi.mocked(mocks.storage.getObject).mockResolvedValue(pdfBuffer);
    vi.mocked(mocks.extractor.extract).mockResolvedValue(extractedPages);

    const service = createPdfExtractionService(mocks);
    const result = await service.run('doc-123');

    expect(result).toEqual(extractedPages);
    expect(mocks.storage.getObject).toHaveBeenCalledWith(sampleDocument.storageKey);
    expect(mocks.extractor.extract).toHaveBeenCalledWith(pdfBuffer);
    expect(mocks.documents.updateStatus).toHaveBeenCalledTimes(1);
    expect(mocks.documents.updateStatus).toHaveBeenCalledWith('doc-123', 'processing');
  });

  it('never calls updateStatus with ready status across scenarios', async () => {
    const mocks = createMocks();
    vi.mocked(mocks.documents.findById).mockResolvedValue(sampleDocument);
    vi.mocked(mocks.storage.getObject).mockResolvedValue(Buffer.from('pdf'));
    vi.mocked(mocks.extractor.extract).mockResolvedValue([{ page: 1, text: 'Text' }]);

    const service = createPdfExtractionService(mocks);
    await service.run('doc-123');

    const updateStatusCalls = vi.mocked(mocks.documents.updateStatus).mock.calls;
    const readyCalls = updateStatusCalls.filter((call) => (call[1] as string) === 'ready');
    expect(readyCalls).toHaveLength(0);
  });
});
