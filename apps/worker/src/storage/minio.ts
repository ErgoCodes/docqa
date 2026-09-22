import { Client } from 'minio';
import type { WorkerConfig } from '../config.js';

export function connectMinio(config: WorkerConfig): Client {
  return new Client({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_PORT,
    useSSL: config.MINIO_USE_SSL,
    accessKey: config.MINIO_ROOT_USER,
    secretKey: config.MINIO_ROOT_PASSWORD,
  });
}
