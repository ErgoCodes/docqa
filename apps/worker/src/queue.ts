import type { Job } from 'bullmq';
import { chunkDocument } from './modules/chunking/utils/chunk-document.js';
import type { DocumentRepository } from './modules/documents/interfaces/document.repository.js';
import type { EmbedAndIndexChunksService } from './modules/embeddings/services/embed-and-index-chunks.service.js';
import type { PdfExtractionService } from './modules/extraction/services/pdf-extraction.service.js';
import type { IngestionJob } from './modules/ingestion/types/ingestion-job.js';

export const QUEUE_NAME = 'ingestion';

export interface ProcessorDependencies {
  documents: DocumentRepository;
  extraction: PdfExtractionService;
  embedAndIndex: EmbedAndIndexChunksService;
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

    const document = await deps.documents.findById(documentId);
    if (document === null) {
      await job.log(`document ${documentId} deleted after extraction, skipping`);
      return;
    }

    const chunks = chunkDocument(pages, documentId, document.userId);
    await job.log(`built ${chunks.length} chunks for document ${documentId}`);

    await deps.embedAndIndex.run(documentId, chunks);
    await job.log(`finished embedding and indexing document ${documentId}`);
  };
}
