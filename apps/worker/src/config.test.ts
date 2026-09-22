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
  VOYAGE_API_KEY: 'test-voyage-api-key',
  EMBEDDINGS_MODEL: 'voyage-3-lite',
};

describe('loadConfig', () => {
  it('parses valid environment variables and applies defaults', () => {
    const config = loadConfig(validEnv);

    expect(config.NODE_ENV).toBe('development');
    expect(config.WORKER_CONCURRENCY).toBe(2);
    expect(config.MINIO_USE_SSL).toBe(false);
    expect(config.MINIO_PORT).toBe(9000);
    expect(config.VOYAGE_API_KEY).toBe('test-voyage-api-key');
    expect(config.EMBEDDINGS_MODEL).toBe('voyage-3-lite');
  });

  it('applies default EMBEDDINGS_MODEL when omitted', () => {
    const envWithoutModel: Record<string, string> = { ...validEnv };
    delete envWithoutModel.EMBEDDINGS_MODEL;

    const config = loadConfig(envWithoutModel);

    expect(config.EMBEDDINGS_MODEL).toBe('voyage-3-lite');
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

  it('throws when VOYAGE_API_KEY is missing', () => {
    const envWithoutApiKey: Record<string, string> = { ...validEnv };
    delete envWithoutApiKey.VOYAGE_API_KEY;

    expect(() => loadConfig(envWithoutApiKey)).toThrow(/VOYAGE_API_KEY/);
  });

  it('throws with an informative message listing missing fields', () => {
    expect(() => loadConfig({})).toThrow(/Invalid configuration/);
  });

  it('never includes received secret value in error message', () => {
    const secretValue = 'super-secret-raw-value';

    expect.assertions(1);
    try {
      loadConfig({ ...validEnv, MONGODB_URI: secretValue });
    } catch (error) {
      expect(String(error)).not.toContain(secretValue);
    }
  });
});
