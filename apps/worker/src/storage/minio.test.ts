import { describe, expect, it } from 'vitest';
import { connectMinio } from './minio.js';

describe('connectMinio', () => {
  it('instantiates Client with worker config parameters', () => {
    const client = connectMinio({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/test',
      REDIS_URL: 'redis://localhost:6379',
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_USE_SSL: false,
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'miniopassword',
      MINIO_BUCKET: 'test-bucket',
      WORKER_CONCURRENCY: 2,
    });

    expect(client).toBeDefined();
  });
});
