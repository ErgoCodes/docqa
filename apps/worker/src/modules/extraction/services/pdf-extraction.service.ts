import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { ObjectStorage } from '../../storage/interfaces/object-storage.js';
import type { PdfTextExtractor } from '../interfaces/pdf-text-extractor.js';
import type { ExtractedPage } from '../types/extracted-page.js';
import { toErrorMessage } from '../utils/to-error-message.js';

export interface PdfExtractionServiceDependencies {
  documents: DocumentRepository;
  storage: ObjectStorage;
  extractor: PdfTextExtractor;
}

export interface PdfExtractionService {
  run: (documentId: string) => Promise<ExtractedPage[] | null>;
}

export function createPdfExtractionService(deps: PdfExtractionServiceDependencies): PdfExtractionService {
  return {
    run: async (documentId: string): Promise<ExtractedPage[] | null> => {
      const document = await deps.documents.findById(documentId);
      if (document === null) {
        return null;
      }

      await deps.documents.updateStatus(documentId, 'processing');

      let buffer: Buffer;
      try {
        buffer = await deps.storage.getObject(document.storageKey);
      } catch (error) {
        await deps.documents.updateStatus(documentId, 'error', 'No se pudo descargar el archivo para procesarlo');
        throw new Error(`Failed to download PDF from object storage: ${toErrorMessage(error)}`);
      }

      let pages: ExtractedPage[];
      try {
        pages = await deps.extractor.extract(buffer);
      } catch (error) {
        await deps.documents.updateStatus(documentId, 'error', 'El PDF está dañado o no se pudo leer');
        throw new Error(`Failed to extract text from PDF: ${toErrorMessage(error)}`);
      }

      const hasExtractableText = pages.some((page) => page.text.length > 0);
      if (!hasExtractableText) {
        await deps.documents.updateStatus(
          documentId,
          'error',
          'No se pudo extraer texto del PDF (¿es un documento escaneado sin texto seleccionable?)',
        );
        throw new Error('PDF has no extractable text (likely a scanned document)');
      }

      return pages;
    },
  };
}
