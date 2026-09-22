import type { WorkerConfig } from './config.js';
import { connectMongo } from './db/mongo.js';
import { createMongoDocumentRepository } from './modules/documents/repositories/mongo-document.repository.js';
import { createUnpdfTextExtractor } from './modules/extraction/repositories/unpdf-text-extractor.js';
import {
  createPdfExtractionService,
  type PdfExtractionService,
} from './modules/extraction/services/pdf-extraction.service.js';
import { createMinioObjectStorage } from './modules/storage/repositories/minio-object-storage.js';
import { connectMinio } from './storage/minio.js';

export interface WorkerDependencies {
  extraction: PdfExtractionService;
  close: () => Promise<void>;
}

export async function createWorkerDependencies(config: WorkerConfig): Promise<WorkerDependencies> {
  const { client, db } = await connectMongo(config.MONGODB_URI);
  const minioClient = connectMinio(config);

  const documents = createMongoDocumentRepository(db);
  const storage = createMinioObjectStorage(minioClient, config.MINIO_BUCKET);
  const extractor = createUnpdfTextExtractor();

  return {
    extraction: createPdfExtractionService({ documents, storage, extractor }),
    close: async () => {
      await client.close();
    },
  };
}
