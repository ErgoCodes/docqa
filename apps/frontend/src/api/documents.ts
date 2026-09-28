import { apiClient } from './client';
import type { DocumentItem } from './types';

export const documentsApi = {
  list(): Promise<DocumentItem[]> {
    return apiClient.get<DocumentItem[]>('/documents');
  },

  getById(id: string): Promise<DocumentItem> {
    return apiClient.get<DocumentItem>(`/documents/${id}`);
  },

  upload(file: File): Promise<DocumentItem> {
    return apiClient.upload<DocumentItem>('/documents', file, 'file');
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/documents/${id}`);
  },
};
