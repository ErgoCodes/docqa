import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv = {
  MONGODB_URI: 'mongodb://localhost:27017/docqa',
  VOYAGE_API_KEY: 'test-voyage-api-key',
  EMBEDDINGS_MODEL: 'voyage-3-lite',
  NODE_ENV: 'test',
};

describe('loadConfig', () => {
  it('parses valid complete environment successfully', () => {
    const config = loadConfig(validEnv);

    expect(config.MONGODB_URI).toBe('mongodb://localhost:27017/docqa');
    expect(config.VOYAGE_API_KEY).toBe('test-voyage-api-key');
    expect(config.EMBEDDINGS_MODEL).toBe('voyage-3-lite');
    expect(config.NODE_ENV).toBe('test');
  });

  it('applies default EMBEDDINGS_MODEL when omitted', () => {
    const envWithoutModel = {
      MONGODB_URI: validEnv.MONGODB_URI,
      VOYAGE_API_KEY: validEnv.VOYAGE_API_KEY,
    };

    const config = loadConfig(envWithoutModel);

    expect(config.EMBEDDINGS_MODEL).toBe('voyage-3-lite');
    expect(config.NODE_ENV).toBe('development');
  });

  it('throws when VOYAGE_API_KEY is missing', () => {
    const envWithoutApiKey = {
      MONGODB_URI: validEnv.MONGODB_URI,
    };

    expect(() => loadConfig(envWithoutApiKey)).toThrow(/VOYAGE_API_KEY/);
  });

  it('throws when MONGODB_URI does not start with mongodb', () => {
    const invalidMongoEnv = {
      ...validEnv,
      MONGODB_URI: 'http://localhost:27017',
    };

    expect(() => loadConfig(invalidMongoEnv)).toThrow(/MONGODB_URI/);
  });

  it('never includes received secret value in error message', () => {
    const secretValue = 'super-secret-raw-value';

    expect.assertions(1);
    try {
      loadConfig({
        ...validEnv,
        MONGODB_URI: secretValue,
      });
    } catch (error) {
      expect(String(error)).not.toContain(secretValue);
    }
  });
});
