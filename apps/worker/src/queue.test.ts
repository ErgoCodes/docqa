import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
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

  it('calls run with documentId and logs start message', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue([{ page: 1, text: 'Hello' }]),
    };
    const processor = createProcessor({ extraction });
    const fakeJob = createFakeJob('doc-abc');

    await processor(fakeJob);

    expect(extraction.run).toHaveBeenCalledWith('doc-abc');
    expect(fakeJob.log).toHaveBeenCalledWith('starting extraction for document doc-abc');
  });

  it('resolves cleanly without throwing and logs not found message when document is null', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue(null),
    };
    const processor = createProcessor({ extraction });
    const fakeJob = createFakeJob('doc-deleted');

    await expect(processor(fakeJob)).resolves.toBeUndefined();
    expect(fakeJob.log).toHaveBeenCalledWith('starting extraction for document doc-deleted');
    expect(fakeJob.log).toHaveBeenCalledWith(
      'document doc-deleted not found, skipping (likely deleted before processing)',
    );
  });

  it('resolves and logs page count when extraction succeeds', async () => {
    const extraction: PdfExtractionService = {
      run: vi.fn().mockResolvedValue([
        { page: 1, text: 'Page 1' },
        { page: 2, text: 'Page 2' },
      ]),
    };
    const processor = createProcessor({ extraction });
    const fakeJob = createFakeJob('doc-ok');

    await expect(processor(fakeJob)).resolves.toBeUndefined();
    expect(fakeJob.log).toHaveBeenCalledWith('starting extraction for document doc-ok');
    expect(fakeJob.log).toHaveBeenCalledWith('extracted 2 pages for document doc-ok');
  });

  it('propagates rejection when extraction throws', async () => {
    const error = new Error('Extraction failed');
    const extraction: PdfExtractionService = {
      run: vi.fn().mockRejectedValue(error),
    };
    const processor = createProcessor({ extraction });
    const fakeJob = createFakeJob('doc-fail');

    await expect(processor(fakeJob)).rejects.toThrow('Extraction failed');
    expect(fakeJob.log).toHaveBeenCalledWith('starting extraction for document doc-fail');
  });
});
