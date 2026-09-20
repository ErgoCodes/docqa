import type { Job } from 'bullmq';

export const QUEUE_NAME = 'ingestion';

/**
 * Placeholder de ingesta — la extracción/fragmentación/embeddings reales
 * llegan en la Fase 2 (tareas de ingesta). Por ahora solo confirma que el
 * worker está cableado a la cola.
 */
export async function processor(job: Job): Promise<void> {
  await job.log(`processing job ${job.id} (placeholder, no-op)`);
}
