import type { DocumentRepository } from '../modules/documents/interfaces/document.repository.js';
import type { Document, DocumentStatus } from '../modules/documents/types/document.js';

export interface InMemoryDocumentRepository extends DocumentRepository {
  seed: (doc: Document) => void;
}

export function createInMemoryDocumentRepository(
  seed: Document[] | Document = [],
): InMemoryDocumentRepository {
  const documents = new Map<string, Document>();

  function store(doc: Document): void {
    documents.set(doc.id, { ...doc });
  }

  const initial = Array.isArray(seed) ? seed : [seed];
  for (const doc of initial) {
    store(doc);
  }

  return {
    seed: store,

    findById: (id: string): Promise<Document | null> => {
      const doc = documents.get(id);
      return Promise.resolve(doc ? { ...doc } : null);
    },

    updateStatus: (id: string, status: DocumentStatus, error: string | null = null): Promise<void> => {
      const doc = documents.get(id);
      if (doc) {
        documents.set(id, {
          ...doc,
          status,
          error,
        });
      }
      return Promise.resolve();
    },
  };
}
