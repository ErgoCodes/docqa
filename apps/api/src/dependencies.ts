import { connectMongo } from './db/mongo.js';
import { ensureIndexes } from './db/indexes.js';
import type { AppConfig } from './config.js';
import type { PasswordHasher } from './modules/auth/interfaces/password-hasher.js';
import type { RefreshTokenRepository } from './modules/auth/interfaces/refresh-token.repository.js';
import type { UserRepository } from './modules/auth/interfaces/user.repository.js';
import { createMongoRefreshTokenRepository } from './modules/auth/repositories/mongo-refresh-token.repository.js';
import { createMongoUserRepository } from './modules/auth/repositories/mongo-user.repository.js';
import { createArgon2Hasher } from './modules/auth/utils/password-hasher.js';

export interface AppDependencies {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  hasher: PasswordHasher;
  close: () => Promise<void>;
}

export async function createMongoDependencies(config: AppConfig): Promise<AppDependencies> {
  const { client, db } = await connectMongo(config.MONGODB_URI);
  await ensureIndexes(db);

  return {
    users: createMongoUserRepository(db),
    refreshTokens: createMongoRefreshTokenRepository(db),
    hasher: createArgon2Hasher({
      memoryCost: config.ARGON2_MEMORY_COST,
      timeCost: config.ARGON2_TIME_COST,
      parallelism: config.ARGON2_PARALLELISM,
    }),
    close: () => client.close(),
  };
}
