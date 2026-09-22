import { AppError } from '../../../errors.js';
import type { ChunkDeleter } from '../../chunks/interfaces/chunk-deleter.js';
import type { DocumentRepository } from '../interfaces/document.repository.js';
import type { IngestionQueue } from '../interfaces/ingestion-queue.js';
import type { ObjectStorage } from '../interfaces/object-storage.js';
import { MAX_PDF_PAGES, MAX_UPLOAD_BYTES, type Document } from '../types/document.js';
import { DocumentErrors } from '../types/document-errors.js';
import { buildStorageKey, sanitizeTitle } from '../utils/document-naming.js';
import { validatePdf } from '../utils/pdf-validator.js';

export interface DocumentServiceDependencies {
  documents: DocumentRepository;
  objectStorage: ObjectStorage;
  ingestionQueue: IngestionQueue;
  chunkDeleter: ChunkDeleter;
  now?: () => Date;
}

export interface UploadDocumentInput {
  userId: string;
  filename: string;
  buffer: Buffer;
}

export interface DocumentService {
  upload: (input: UploadDocumentInput) => Promise<Document>;
  list: (userId: string) => Promise<Document[]>;
  getById: (id: string, userId: string) => Promise<Document>;
  remove: (id: string, userId: string) => Promise<void>;
}

export function createDocumentService(deps: DocumentServiceDependencies): DocumentService {
  const { documents, objectStorage, ingestionQueue, chunkDeleter } = deps;
  const now = deps.now ?? ((): Date => new Date());

  return {
    upload: async (input: UploadDocumentInput): Promise<Document> => {
      const { userId, filename, buffer } = input;

      // Chequeo barato antes de parsear nada con pdf-lib.
      if (buffer.length > MAX_UPLOAD_BYTES) {
        throw new AppError(DocumentErrors.FILE_TOO_LARGE);
      }

      const { pageCount } = await validatePdf(buffer);

      if (pageCount > MAX_PDF_PAGES) {
        throw new AppError(DocumentErrors.TOO_MANY_PAGES);
      }

      const storageKey = buildStorageKey(userId);
      const title = sanitizeTitle(filename);

      // Subida a MinIO antes de insertar en Mongo: si Mongo falla después,
      // queda un blob huérfano inofensivo en MinIO, en vez de un registro en
      // Mongo que apunta a un archivo que nunca se subió.
      await objectStorage.putObject(storageKey, buffer, 'application/pdf');

      const doc = await documents.insert({
        userId,
        title,
        storageKey,
        pages: pageCount,
        status: 'processing',
        error: null,
        createdAt: now(),
      });

      // Si enqueue falla, el error se propaga sin rollback del insert/putObject
      // anteriores: revertirlos sería sobre-ingeniería para este alcance.
      await ingestionQueue.enqueue(doc.id);

      return doc;
    },

    list: async (userId: string): Promise<Document[]> => {
      return documents.findAllByUser(userId);
    },

    getById: async (id: string, userId: string): Promise<Document> => {
      const doc = await documents.findById(id, userId);

      if (!doc) {
        throw new AppError(DocumentErrors.DOCUMENT_NOT_FOUND);
      }

      return doc;
    },

    remove: async (id: string, userId: string): Promise<void> => {
      const doc = await documents.findById(id, userId);

      if (!doc) {
        throw new AppError(DocumentErrors.DOCUMENT_NOT_FOUND);
      }

      // The document row is deleted last on purpose: chunk deletion and
      // object storage deletion are both idempotent, so if either fails the
      // row survives and the same DELETE request can simply be retried. If
      // the row were deleted first, a later failure would leave orphaned
      // chunks/file with no way to retry through the API.
      await chunkDeleter.deleteByDocumentId(id, userId);
      await objectStorage.deleteObject(doc.storageKey);
      await documents.deleteById(id, userId);
    },
  };
}
