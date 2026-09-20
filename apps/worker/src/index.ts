import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { processor, QUEUE_NAME } from './queue.js';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);

const worker = new Worker(QUEUE_NAME, processor, { connection, concurrency });

worker.on('ready', () => {
  console.log(`worker listening on queue "${QUEUE_NAME}"`);
});

async function shutdown(): Promise<void> {
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
