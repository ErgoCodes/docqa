import { randomUUID } from 'node:crypto';
import type { AppDependencies } from '../dependencies.js';
import type { NewRefreshToken, RefreshTokenRepository } from '../modules/auth/interfaces/refresh-token.repository.js';
import type { NewUser, UserRepository } from '../modules/auth/interfaces/user.repository.js';
import type { RefreshToken, RevokedReason } from '../modules/auth/types/refresh-token.js';
import { DuplicateEmailError, type User } from '../modules/auth/types/user.js';

export function createInMemoryUserRepository(): UserRepository {
  const usersByEmail = new Map<string, User>();
  const usersById = new Map<string, User>();

  return {
    insert: (user: NewUser): Promise<User> => {
      if (usersByEmail.has(user.email)) {
        return Promise.reject(new DuplicateEmailError(user.email));
      }
      const stored: User = { id: randomUUID(), ...user };
      usersByEmail.set(user.email, stored);
      usersById.set(stored.id, stored);
      return Promise.resolve(stored);
    },

    findByEmail: (email: string): Promise<User | null> => Promise.resolve(usersByEmail.get(email) ?? null),

    findById: (userId: string): Promise<User | null> => Promise.resolve(usersById.get(userId) ?? null),
  };
}

export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  const byHash = new Map<string, RefreshToken>();

  return {
    insert: (token: NewRefreshToken): Promise<RefreshToken> => {
      const stored: RefreshToken = {
        id: randomUUID(),
        ...token,
        rotatedAt: null,
        replacedByHash: null,
        revokedAt: null,
        revokedReason: null,
      };
      byHash.set(stored.tokenHash, stored);
      return Promise.resolve(stored);
    },

    findByTokenHash: (tokenHash: string): Promise<RefreshToken | null> =>
      Promise.resolve(byHash.get(tokenHash) ?? null),

    markRotated: (tokenHash: string, replacedByHash: string, now: Date): Promise<boolean> => {
      const existing = byHash.get(tokenHash);
      if (!existing || existing.rotatedAt !== null || existing.revokedAt !== null) {
        return Promise.resolve(false);
      }
      byHash.set(tokenHash, { ...existing, rotatedAt: now, replacedByHash, revokedAt: now, revokedReason: 'rotated' });
      return Promise.resolve(true);
    },

    revokeFamily: (familyId: string, reason: RevokedReason, now: Date): Promise<void> => {
      for (const [hash, token] of byHash) {
        if (token.familyId === familyId && token.revokedAt === null) {
          byHash.set(hash, { ...token, revokedAt: now, revokedReason: reason });
        }
      }
      return Promise.resolve();
    },
  };
}

export function createInMemoryDependencies(): AppDependencies {
  return {
    users: createInMemoryUserRepository(),
    refreshTokens: createInMemoryRefreshTokenRepository(),
    close: () => Promise.resolve(),
  };
}
