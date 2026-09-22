import type { Queue } from 'bullmq';
import type { IngestionQueue } from '../interfaces/ingestion-queue.js';

// Coincide con QUEUE_NAME en apps/worker/src/queue.ts. Al no haber un paquete
// compartido entre api y worker en este monorepo, se mantiene la constante aquí.
export const INGESTION_QUEUE_NAME = 'ingestion';

export function createBullmqIngestionQueue(queue: Queue): IngestionQueue {
  return {
    enqueue: async (documentId: string): Promise<void> => {
      await queue.add('ingest', { documentId });
    },
  };
}
