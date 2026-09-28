import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/api/documents';
import type { DocumentItem } from '@/api/types';

export function useDocuments() {
  const queryClient = useQueryClient();

  const documentsQuery = useQuery<DocumentItem[]>({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list(),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasProcessing = data?.some((doc) => doc.status === 'processing');
      return hasProcessing ? 2000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  return {
    documents: documentsQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
    isError: documentsQuery.isError,
    error: documentsQuery.error,
    refetch: documentsQuery.refetch,
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
  };
}
