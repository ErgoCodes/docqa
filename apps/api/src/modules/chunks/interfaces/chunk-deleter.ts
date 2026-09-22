export interface ChunkDeleter {
  deleteByDocumentId: (documentId: string, userId: string) => Promise<number>;
}
