import { Client } from 'minio';
import type { AppConfig } from '../config.js';

export function connectMinio(config: AppConfig): Client {
  return new Client({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_PORT,
    useSSL: config.MINIO_USE_SSL,
    accessKey: config.MINIO_ROOT_USER,
    secretKey: config.MINIO_ROOT_PASSWORD,
  });
}

export async function ensureBucket(client: Client, bucket: string): Promise<void> {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}
