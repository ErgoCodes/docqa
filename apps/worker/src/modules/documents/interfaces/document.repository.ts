import type { Document, DocumentStatus } from '../types/document.js';

// A diferencia de apps/api (donde findById exige userId por RNF-01), este
// repositorio opera en el contexto de confianza de un job de BullMQ: el
// documentId ya viene validado desde la cola, no desde input de usuario.
export interface DocumentRepository {
  findById: (id: string) => Promise<Document | null>;
  updateStatus: (id: string, status: DocumentStatus, error?: string | null) => Promise<void>;
}
