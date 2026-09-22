// Coincide con el payload que apps/api encola en
// apps/api/src/modules/documents/repositories/bullmq-ingestion-queue.ts
// (queue.add('ingest', { documentId })). Sin paquete compartido entre api y
// worker, el contrato se mantiene duplicado en ambos lados a propósito.
export interface IngestionJob {
  documentId: string;
}
