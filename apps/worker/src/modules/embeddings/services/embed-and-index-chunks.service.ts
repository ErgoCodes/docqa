import type { DocumentChunk } from '../../chunking/types/chunk.js';
import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { ChunkRepository } from '../interfaces/chunk.repository.js';
import type { EmbeddingsProvider } from '../interfaces/embeddings-provider.js';
import { EMBEDDING_DIMENSIONS } from '../repositories/chunks-vector-index.js';
import type { EmbeddedChunk } from '../types/embedded-chunk.js';

export interface EmbedAndIndexChunksDeps {
  embeddingsProvider: EmbeddingsProvider;
  chunkRepository: ChunkRepository;
  documentRepository: DocumentRepository;
}

export interface EmbedAndIndexChunksService {
  run(documentId: string, chunks: DocumentChunk[]): Promise<void>;
}

export function createEmbedAndIndexChunksService(
  deps: EmbedAndIndexChunksDeps,
): EmbedAndIndexChunksService {
  return {
    run: async (documentId: string, chunks: DocumentChunk[]): Promise<void> => {
      const document = await deps.documentRepository.findById(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      try {
        const validChunks = chunks.filter((chunk) => chunk.text.trim().length > 0);
        if (validChunks.length === 0) {
          await deps.documentRepository.updateStatus(
            documentId,
            'error',
            'No se encontró contenido para indexar en el documento',
          );
          return;
        }

        for (const chunk of validChunks) {
          if (chunk.documentId !== documentId || chunk.userId !== document.userId) {
            throw new Error(`Chunk documentId/userId mismatch for document ${documentId}`);
          }
        }

        const texts = validChunks.map((chunk) => chunk.text);
        const embeddings = await deps.embeddingsProvider.embed(texts);

        if (embeddings.length !== texts.length) {
          throw new Error(
            `Embeddings provider returned ${embeddings.length} vectors for ${texts.length} texts`,
          );
        }

        const firstEmbedding = embeddings[0];
        if (firstEmbedding && firstEmbedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embeddings provider returned vectors of ${firstEmbedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
          );
        }

        const embeddedChunks: EmbeddedChunk[] = validChunks.map((chunk, i) => ({
          ...chunk,
          embedding: embeddings[i] as number[],
        }));

        await deps.chunkRepository.insertMany(embeddedChunks);
        await deps.documentRepository.updateStatus(documentId, 'ready');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to embed and index chunks for document ${documentId}: ${message}`);
        await deps.documentRepository.updateStatus(
          documentId,
          'error',
          'No se pudieron generar o guardar los embeddings del documento',
        );
      }
    },
  };
}
