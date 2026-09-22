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
