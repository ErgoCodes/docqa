import { apiClient } from './client';
import type { Chunk } from './types';

export const chunksApi = {
  getById(id: string): Promise<Chunk> {
    return apiClient.get<Chunk>(`/chunks/${id}`);
  },
};
