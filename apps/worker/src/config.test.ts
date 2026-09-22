import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv = {
  MONGODB_URI: 'mongodb://localhost:27017/docqa',
  REDIS_URL: 'redis://localhost:6379',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_USE_SSL: 'false',
  MINIO_ROOT_USER: 'minioadmin',
  MINIO_ROOT_PASSWORD: 'changeme-local-only',
  MINIO_BUCKET: 'docqa-documents',
};

describe('loadConfig', () => {
  it('parses valid environment variables and applies defaults', () => {
    const config = loadConfig(validEnv);

    expect(config.NODE_ENV).toBe('development');
    expect(config.WORKER_CONCURRENCY).toBe(2);
    expect(config.MINIO_USE_SSL).toBe(false);
    expect(config.MINIO_PORT).toBe(9000);
  });

  it('correctly transforms MINIO_USE_SSL string to boolean', () => {
    const configFalse = loadConfig({ ...validEnv, MINIO_USE_SSL: 'false' });
    expect(configFalse.MINIO_USE_SSL).toBe(false);

    const configTrue = loadConfig({ ...validEnv, MINIO_USE_SSL: 'true' });
    expect(configTrue.MINIO_USE_SSL).toBe(true);
  });

  it('rejects invalid boolean values for MINIO_USE_SSL', () => {
    expect(() => loadConfig({ ...validEnv, MINIO_USE_SSL: 'yes' })).toThrow(/Invalid configuration/);
  });

  it('rejects invalid MONGODB_URI and REDIS_URL protocols', () => {
    expect(() => loadConfig({ ...validEnv, MONGODB_URI: 'postgres://localhost:5432' })).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ ...validEnv, REDIS_URL: 'http://localhost:6379' })).toThrow(/Invalid configuration/);
  });

  it('throws with an informative message listing missing fields', () => {
    expect(() => loadConfig({})).toThrow(/Invalid configuration/);
  });
});
