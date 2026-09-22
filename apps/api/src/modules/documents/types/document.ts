export type DocumentStatus = 'processing' | 'ready' | 'error';

export interface Document {
  id: string;
  userId: string;
  title: string;
  storageKey: string;
  pages: number;
  status: DocumentStatus;
  error: string | null;
  createdAt: Date;
}

export interface NewDocument {
  userId: string;
  title: string;
  storageKey: string;
  pages: number;
  status: DocumentStatus;
  error: null;
  createdAt: Date;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // RF-02: 10 MB
export const MAX_PDF_PAGES = 50; // RF-02: 50 páginas
