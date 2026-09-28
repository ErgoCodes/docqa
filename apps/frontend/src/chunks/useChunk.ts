import { useQuery } from '@tanstack/react-query';
import { chunksApi } from '@/api/chunks';
import type { Chunk } from '@/api/types';

export function useChunk(chunkId: string | null) {
  return useQuery<Chunk>({
    queryKey: ['chunk', chunkId],
    queryFn: () => {
      if (!chunkId) {
        throw new Error('chunkId is required');
      }
      return chunksApi.getById(chunkId);
    },
    enabled: Boolean(chunkId),
    staleTime: Infinity,
  });
}
