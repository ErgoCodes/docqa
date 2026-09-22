export interface IngestionQueue {
  enqueue: (documentId: string) => Promise<void>;
}
