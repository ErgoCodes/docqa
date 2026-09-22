import type { Document, NewDocument } from '../types/document.js';

export interface DocumentRepository {
  insert: (document: NewDocument) => Promise<Document>;
  // userId es obligatorio a propósito (no opcional): hace imposible a nivel
  // de tipos llamar a este método sin pasar el filtro de aislamiento (RNF-01).
  findById: (id: string, userId: string) => Promise<Document | null>;
  findAllByUser: (userId: string) => Promise<Document[]>;
}
