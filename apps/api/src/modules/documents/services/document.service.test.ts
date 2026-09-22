import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { ResponseCache } from '../../cache/interfaces/response-cache.js';
import type { ChunkDeleter } from '../../chunks/interfaces/chunk-deleter.js';
import type { DocumentRepository } from '../interfaces/document.repository.js';
import type { IngestionQueue } from '../interfaces/ingestion-queue.js';
import type { ObjectStorage } from '../interfaces/object-storage.js';
import { MAX_UPLOAD_BYTES, type Document, type NewDocument } from '../types/document.js';
import { createDocumentService } from './document.service.js';

async function buildPdfBuffer(pageCount: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage();
  }
  return Buffer.from(await pdfDoc.save());
}

function createMockDependencies() {
  const storedDocs = new Map<string, Document>();
  const storedObjects = new Map<string, { data: Buffer; contentType: string }>();
  const enqueuedJobs: string[] = [];

  const documents: DocumentRepository = {
    insert: vi.fn((doc: NewDocument): Promise<Document> => {
      const stored: Document = {
        id: `doc-${storedDocs.size + 1}`,
        ...doc,
      };
      storedDocs.set(stored.id, stored);
      return Promise.resolve(stored);
    }),
    findById: vi.fn((id: string, userId: string): Promise<Document | null> => {
      const doc = storedDocs.get(id);
      if (!doc || doc.userId !== userId) {
        return Promise.resolve(null);
      }
      return Promise.resolve(doc);
    }),
    findAllByUser: vi.fn((userId: string): Promise<Document[]> => {
      return Promise.resolve(Array.from(storedDocs.values()).filter((d) => d.userId === userId));
    }),
    deleteById: vi.fn((id: string, userId: string): Promise<boolean> => {
      const doc = storedDocs.get(id);
      if (!doc || doc.userId !== userId) {
        return Promise.resolve(false);
      }
      storedDocs.delete(id);
      return Promise.resolve(true);
    }),
  };

  const objectStorage: ObjectStorage = {
    putObject: vi.fn((key: string, data: Buffer, contentType: string): Promise<void> => {
      storedObjects.set(key, { data, contentType });
      return Promise.resolve();
    }),
    deleteObject: vi.fn((key: string): Promise<void> => {
      storedObjects.delete(key);
      return Promise.resolve();
    }),
  };

  const ingestionQueue: IngestionQueue = {
    enqueue: vi.fn((documentId: string): Promise<void> => {
      enqueuedJobs.push(documentId);
      return Promise.resolve();
    }),
  };

  const deletedChunksByDocument: string[] = [];
  const chunkDeleter: ChunkDeleter = {
    deleteByDocumentId: vi.fn((documentId: string): Promise<number> => {
      deletedChunksByDocument.push(documentId);
      return Promise.resolve(0);
    }),
  };

  const responseCache: ResponseCache = {
    get: vi.fn((): Promise<null> => Promise.resolve(null)),
    set: vi.fn((): Promise<void> => Promise.resolve()),
    getUserGeneration: vi.fn((): Promise<number> => Promise.resolve(0)),
    invalidateUser: vi.fn((): Promise<void> => Promise.resolve()),
  };

  return {
    documents,
    objectStorage,
    ingestionQueue,
    chunkDeleter,
    responseCache,
    storedDocs,
    storedObjects,
    enqueuedJobs,
    deletedChunksByDocument,
  };
}

describe('DocumentService', () => {
  describe('upload', () => {
    it('sube un PDF válido, lo guarda en storage, lo inserta en la BD, lo encola e invalida la caché del usuario', async () => {
      const deps = createMockDependencies();
      const fixedDate = new Date('2026-09-20T12:00:00Z');
      const service = createDocumentService({ ...deps, now: () => fixedDate });

      const buffer = await buildPdfBuffer(3);
      const result = await service.upload({
        userId: 'user-1',
        filename: 'reporte-final.pdf',
        buffer,
      });

      expect(result.id).toBe('doc-1');
      expect(result.userId).toBe('user-1');
      expect(result.title).toBe('reporte-final');
      expect(result.pages).toBe(3);
      expect(result.status).toBe('processing');
      expect(result.error).toBeNull();
      expect(result.createdAt).toEqual(fixedDate);
      expect(result.storageKey).toMatch(/^user-1\/[0-9a-f-]{36}\.pdf$/);

      expect(deps.objectStorage.putObject).toHaveBeenCalledWith(
        result.storageKey,
        buffer,
        'application/pdf',
      );
      expect(deps.documents.insert).toHaveBeenCalledTimes(1);
      expect(deps.ingestionQueue.enqueue).toHaveBeenCalledWith('doc-1');
      expect(deps.enqueuedJobs).toContain('doc-1');
      expect(deps.responseCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('rechaza un archivo que supera MAX_UPLOAD_BYTES sin llegar a parsearlo', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      // Buffer grande con magic bytes pero longitud superior a 10 MB
      const largeBuffer = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
      largeBuffer.set(Buffer.from('%PDF-'), 0);

      await expect(
        service.upload({ userId: 'user-1', filename: 'pesado.pdf', buffer: largeBuffer }),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 413 });

      expect(deps.objectStorage.putObject).not.toHaveBeenCalled();
      expect(deps.documents.insert).not.toHaveBeenCalled();
      expect(deps.ingestionQueue.enqueue).not.toHaveBeenCalled();
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
    });

    it('rechaza un archivo que no es un PDF válido', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const invalidBuffer = Buffer.from('esto no es un pdf');

      await expect(
        service.upload({ userId: 'user-1', filename: 'archivo.txt', buffer: invalidBuffer }),
      ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE', statusCode: 415 });

      expect(deps.objectStorage.putObject).not.toHaveBeenCalled();
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
    });

    it('rechaza un PDF con más de 50 páginas', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buffer = await buildPdfBuffer(51);

      await expect(
        service.upload({ userId: 'user-1', filename: 'libro-largo.pdf', buffer }),
      ).rejects.toMatchObject({ code: 'TOO_MANY_PAGES', statusCode: 422 });

      expect(deps.objectStorage.putObject).not.toHaveBeenCalled();
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('devuelve todos los documentos pertenecientes al usuario', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      await service.upload({ userId: 'user-1', filename: 'doc1.pdf', buffer: buf });
      await service.upload({ userId: 'user-1', filename: 'doc2.pdf', buffer: buf });
      await service.upload({ userId: 'user-2', filename: 'doc3.pdf', buffer: buf });

      const listUser1 = await service.list('user-1');
      expect(listUser1).toHaveLength(2);
      expect(listUser1.map((d) => d.title)).toEqual(['doc1', 'doc2']);

      const listUser2 = await service.list('user-2');
      expect(listUser2).toHaveLength(1);
      expect(listUser2[0]?.title).toBe('doc3');
    });
  });

  describe('getById', () => {
    it('devuelve el documento si existe y pertenece al usuario', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(2);
      const created = await service.upload({ userId: 'user-1', filename: 'mi-doc.pdf', buffer: buf });

      const found = await service.getById(created.id, 'user-1');
      expect(found).toEqual(created);
    });

    it('lanza DOCUMENT_NOT_FOUND (404) si el documento no existe', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      await expect(service.getById('no-existe', 'user-1')).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('lanza DOCUMENT_NOT_FOUND (404) si el documento pertenece a otro usuario', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      const created = await service.upload({ userId: 'user-2', filename: 'doc-ajeno.pdf', buffer: buf });

      await expect(service.getById(created.id, 'user-1')).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('remove', () => {
    it('borra un documento propio: chunks, archivo, registro e invalida la caché del usuario, en ese orden', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      const created = await service.upload({ userId: 'user-1', filename: 'a-borrar.pdf', buffer: buf });
      vi.clearAllMocks();

      await service.remove(created.id, 'user-1');

      expect(deps.chunkDeleter.deleteByDocumentId).toHaveBeenCalledWith(created.id, 'user-1');
      expect(deps.objectStorage.deleteObject).toHaveBeenCalledWith(created.storageKey);
      expect(deps.documents.deleteById).toHaveBeenCalledWith(created.id, 'user-1');
      expect(deps.responseCache.invalidateUser).toHaveBeenCalledWith('user-1');
      expect(deps.storedDocs.has(created.id)).toBe(false);
    });

    it('lanza DOCUMENT_NOT_FOUND (404) si el documento no existe', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      await expect(service.remove('no-existe', 'user-1')).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
    });

    it('RNF-01: lanza DOCUMENT_NOT_FOUND (404) si el documento es de otro usuario y no toca storage', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      const created = await service.upload({ userId: 'user-2', filename: 'doc-ajeno.pdf', buffer: buf });
      vi.clearAllMocks();

      await expect(service.remove(created.id, 'user-1')).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });

      expect(deps.chunkDeleter.deleteByDocumentId).not.toHaveBeenCalled();
      expect(deps.objectStorage.deleteObject).not.toHaveBeenCalled();
      expect(deps.documents.deleteById).not.toHaveBeenCalled();
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
      expect(deps.storedDocs.has(created.id)).toBe(true);
    });

    it('borra un documento que todavía no tiene chunks (chunkDeleter devuelve 0)', async () => {
      const deps = createMockDependencies();
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      const created = await service.upload({ userId: 'user-1', filename: 'sin-chunks.pdf', buffer: buf });
      vi.clearAllMocks();

      await expect(service.remove(created.id, 'user-1')).resolves.toBeUndefined();
      expect(deps.responseCache.invalidateUser).toHaveBeenCalledWith('user-1');
      expect(deps.storedDocs.has(created.id)).toBe(false);
    });

    it('si objectStorage.deleteObject falla, remove() rechaza y no borra el registro del documento ni invalida caché', async () => {
      const deps = createMockDependencies();
      const storageError = new Error('minio unavailable');
      vi.mocked(deps.objectStorage.deleteObject).mockRejectedValueOnce(storageError);
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      const created = await service.upload({ userId: 'user-1', filename: 'falla-storage.pdf', buffer: buf });
      vi.clearAllMocks();

      await expect(service.remove(created.id, 'user-1')).rejects.toThrow(storageError);

      expect(deps.chunkDeleter.deleteByDocumentId).toHaveBeenCalledWith(created.id, 'user-1');
      expect(deps.documents.deleteById).not.toHaveBeenCalled();
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
      expect(deps.storedDocs.has(created.id)).toBe(true);
    });

    it('si chunkDeleter.deleteByDocumentId falla, remove() rechaza y no toca storage, registro ni caché', async () => {
      const deps = createMockDependencies();
      const chunkError = new Error('mongo unavailable');
      vi.mocked(deps.chunkDeleter.deleteByDocumentId).mockRejectedValueOnce(chunkError);
      const service = createDocumentService(deps);

      const buf = await buildPdfBuffer(1);
      const created = await service.upload({ userId: 'user-1', filename: 'falla-chunks.pdf', buffer: buf });
      vi.clearAllMocks();

      await expect(service.remove(created.id, 'user-1')).rejects.toThrow(chunkError);

      expect(deps.objectStorage.deleteObject).not.toHaveBeenCalled();
      expect(deps.documents.deleteById).not.toHaveBeenCalled();
      expect(deps.responseCache.invalidateUser).not.toHaveBeenCalled();
      expect(deps.storedDocs.has(created.id)).toBe(true);
    });
  });
});
