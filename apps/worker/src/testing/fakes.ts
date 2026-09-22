import type { DocumentRepository } from '../modules/documents/interfaces/document.repository.js';
import type { Document, DocumentStatus } from '../modules/documents/types/document.js';
import type { ChunkRepository } from '../modules/embeddings/interfaces/chunk.repository.js';
import type { EmbeddingsProvider } from '../modules/embeddings/interfaces/embeddings-provider.js';
import type { EmbeddedChunk } from '../modules/embeddings/types/embedded-chunk.js';

export interface InMemoryChunkRepository extends ChunkRepository {
  getAll(): EmbeddedChunk[];
}

export function createInMemoryChunkRepository(): InMemoryChunkRepository {
  const chunks: EmbeddedChunk[] = [];

  return {
    insertMany: (incoming: EmbeddedChunk[]): Promise<void> => {
      if (incoming.length === 0) {
        return Promise.resolve();
      }
      // Validate the whole batch before writing anything, matching the atomicity of
      // createMongoChunkRepository (which maps every chunk through `new ObjectId(...)`
      // before calling the driver's insertMany) so both contract-test variants behave
      // the same way on a partially-invalid batch: reject with zero chunks persisted.
      if (incoming.some((chunk) => !chunk.userId)) {
        return Promise.reject(new Error('EmbeddedChunk is missing userId'));
      }
      for (const chunk of incoming) {
        chunks.push({
          ...chunk,
          embedding: [...chunk.embedding],
        });
      }
      return Promise.resolve();
    },

    getAll: (): EmbeddedChunk[] => chunks.map((chunk) => ({
      ...chunk,
      embedding: [...chunk.embedding],
    })),
  };
}

export function createInMemoryEmbeddingsProvider(fixedEmbedding?: number[]): EmbeddingsProvider {
  const defaultEmbedding = fixedEmbedding ?? [0.1, 0.2, 0.3];

  return {
    embed: (texts: string[]): Promise<number[][]> =>
      Promise.resolve(texts.map(() => [...defaultEmbedding])),
  };
}

export interface InMemoryDocumentRepository extends DocumentRepository {
  getStatus(id: string): { status: DocumentStatus; error: string | null } | undefined;
}

export function createInMemoryDocumentRepository(seed: Document[] = []): InMemoryDocumentRepository {
  const documents = new Map<string, Document>(seed.map((doc) => [doc.id, { ...doc }]));

  return {
    findById: (id: string): Promise<Document | null> => {
      const doc = documents.get(id);
      return Promise.resolve(doc ? { ...doc } : null);
    },

    updateStatus: (id: string, status: DocumentStatus, error?: string | null): Promise<void> => {
      const doc = documents.get(id);
      if (doc) {
        doc.status = status;
        doc.error = error ?? null;
      }
      return Promise.resolve();
    },

    getStatus: (id: string): { status: DocumentStatus; error: string | null } | undefined => {
      const doc = documents.get(id);
      if (!doc) {
        return undefined;
      }
      return { status: doc.status, error: doc.error };
    },
  };
}
