import type { WorkerConfig } from './config.js';
import { connectMongo } from './db/mongo.js';
import type { DocumentRepository } from './modules/documents/interfaces/document.repository.js';
import { createMongoDocumentRepository } from './modules/documents/repositories/mongo-document.repository.js';
import { ensureChunksVectorIndex } from './modules/embeddings/repositories/chunks-vector-index.js';
import { createMongoChunkRepository } from './modules/embeddings/repositories/mongo-chunk.repository.js';
import { createVoyageEmbeddingsProvider } from './modules/embeddings/repositories/voyage-embeddings.provider.js';
import {
  createEmbedAndIndexChunksService,
  type EmbedAndIndexChunksService,
} from './modules/embeddings/services/embed-and-index-chunks.service.js';
import { createUnpdfTextExtractor } from './modules/extraction/repositories/unpdf-text-extractor.js';
import {
  createPdfExtractionService,
  type PdfExtractionService,
} from './modules/extraction/services/pdf-extraction.service.js';
import { createMinioObjectStorage } from './modules/storage/repositories/minio-object-storage.js';
import { connectMinio } from './storage/minio.js';

export interface WorkerDependencies {
  documents: DocumentRepository;
  extraction: PdfExtractionService;
  embedAndIndex: EmbedAndIndexChunksService;
  close: () => Promise<void>;
}

export async function createWorkerDependencies(config: WorkerConfig): Promise<WorkerDependencies> {
  const { client, db } = await connectMongo(config.MONGODB_URI);
  await ensureChunksVectorIndex(db);

  const minioClient = connectMinio(config);

  const documents = createMongoDocumentRepository(db);
  const storage = createMinioObjectStorage(minioClient, config.MINIO_BUCKET);
  const extractor = createUnpdfTextExtractor();
  const chunkRepository = createMongoChunkRepository(db);
  const embeddingsProvider = createVoyageEmbeddingsProvider({
    apiKey: config.VOYAGE_API_KEY,
    model: config.EMBEDDINGS_MODEL,
  });

  return {
    documents,
    extraction: createPdfExtractionService({ documents, storage, extractor }),
    embedAndIndex: createEmbedAndIndexChunksService({
      embeddingsProvider,
      chunkRepository,
      documentRepository: documents,
    }),
    close: async () => {
      await client.close();
    },
  };
}
