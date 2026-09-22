import type { AppConfig } from '../config.js';

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    API_PORT: 0,
    API_HOST: '127.0.0.1',
    CORS_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://localhost:27017/docqa-test',
    REDIS_URL: 'redis://localhost:6379',
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: 9000,
    MINIO_USE_SSL: false,
    MINIO_ROOT_USER: 'minioadmin',
    MINIO_ROOT_PASSWORD: 'changeme-local-only',
    MINIO_BUCKET: 'docqa-documents-test',
    JWT_SECRET: 'x'.repeat(32),
    JWT_ISSUER: 'docqa-api',
    JWT_AUDIENCE: 'docqa-client',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 7,
    REFRESH_FAMILY_MAX_DAYS: 30,
    ARGON2_MEMORY_COST: 8,
    ARGON2_TIME_COST: 1,
    ARGON2_PARALLELISM: 1,
    VOYAGE_API_KEY: 'test-voyage-key',
    EMBEDDINGS_MODEL: 'voyage-3-lite',
    CLAUDE_API_KEY: 'test-claude-key',
    CLAUDE_MODEL: 'claude-haiku-4-5',
    ...overrides,
  };
}
