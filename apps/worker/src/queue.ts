import type { Job } from 'bullmq';
import type { PdfExtractionService } from './modules/extraction/services/pdf-extraction.service.js';
import type { IngestionJob } from './modules/ingestion/types/ingestion-job.js';

export const QUEUE_NAME = 'ingestion';

export interface ProcessorDependencies {
  extraction: PdfExtractionService;
}

export function createProcessor(deps: ProcessorDependencies) {
  return async (job: Job<IngestionJob>): Promise<void> => {
    const { documentId } = job.data;
    await job.log(`starting extraction for document ${documentId}`);

    const pages = await deps.extraction.run(documentId);

    if (pages === null) {
      await job.log(`document ${documentId} not found, skipping (likely deleted before processing)`);
      return;
    }

    await job.log(`extracted ${pages.length} pages for document ${documentId}`);
  };
}
