import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { connectMongo } from './db/mongo.js';
import { ensureIndexes } from './db/indexes.js';
import { connectMinio, ensureBucket } from './storage/minio.js';
import type { AppConfig } from './config.js';
import type { PasswordHasher } from './modules/auth/interfaces/password-hasher.js';
import type { RefreshTokenRepository } from './modules/auth/interfaces/refresh-token.repository.js';
import type { UserRepository } from './modules/auth/interfaces/user.repository.js';
import { createMongoRefreshTokenRepository } from './modules/auth/repositories/mongo-refresh-token.repository.js';
import { createMongoUserRepository } from './modules/auth/repositories/mongo-user.repository.js';
import { createArgon2Hasher } from './modules/auth/utils/password-hasher.js';
import type { DocumentRepository } from './modules/documents/interfaces/document.repository.js';
import type { IngestionQueue } from './modules/documents/interfaces/ingestion-queue.js';
import type { ObjectStorage } from './modules/documents/interfaces/object-storage.js';
import {
  INGESTION_QUEUE_NAME,
  createBullmqIngestionQueue,
} from './modules/documents/repositories/bullmq-ingestion-queue.js';
import { createMinioObjectStorage } from './modules/documents/repositories/minio-object-storage.js';
import { createMongoDocumentRepository } from './modules/documents/repositories/mongo-document.repository.js';

export interface AppDependencies {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  documents: DocumentRepository;
  objectStorage: ObjectStorage;
  ingestionQueue: IngestionQueue;
  hasher: PasswordHasher;
  close: () => Promise<void>;
}

export async function createAppDependencies(config: AppConfig): Promise<AppDependencies> {
  const { client, db } = await connectMongo(config.MONGODB_URI);
  await ensureIndexes(db);

  const minioClient = connectMinio(config);
  await ensureBucket(minioClient, config.MINIO_BUCKET);

  const redisConnection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const bullmqQueue = new Queue(INGESTION_QUEUE_NAME, { connection: redisConnection });

  return {
    users: createMongoUserRepository(db),
    refreshTokens: createMongoRefreshTokenRepository(db),
    documents: createMongoDocumentRepository(db),
    objectStorage: createMinioObjectStorage(minioClient, config.MINIO_BUCKET),
    ingestionQueue: createBullmqIngestionQueue(bullmqQueue),
    hasher: createArgon2Hasher({
      memoryCost: config.ARGON2_MEMORY_COST,
      timeCost: config.ARGON2_TIME_COST,
      parallelism: config.ARGON2_PARALLELISM,
    }),
    close: async () => {
      await Promise.all([client.close(), bullmqQueue.close(), redisConnection.quit()]);
    },
  };
}
