import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadConfig } from './config.js';
import { createWorkerDependencies } from './dependencies.js';
import { createProcessor, QUEUE_NAME } from './queue.js';

const config = loadConfig();
const dependencies = await createWorkerDependencies(config);
const processor = createProcessor({ extraction: dependencies.extraction });

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker(QUEUE_NAME, processor, { connection, concurrency: config.WORKER_CONCURRENCY });

worker.on('ready', () => {
  console.log(`worker listening on queue "${QUEUE_NAME}"`);
});

async function shutdown(): Promise<void> {
  await worker.close();
  await connection.quit();
  await dependencies.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
