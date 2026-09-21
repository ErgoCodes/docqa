import { randomBytes, randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureIndexes } from '../../../db/indexes.js';
import { createInMemoryRefreshTokenRepository, createInMemoryUserRepository } from '../../../testing/fakes.js';
import type { NewRefreshToken, RefreshTokenRepository } from '../interfaces/refresh-token.repository.js';
import type { UserRepository } from '../interfaces/user.repository.js';
import { DuplicateEmailError } from '../types/user.js';
import { createMongoRefreshTokenRepository } from './mongo-refresh-token.repository.js';
import { createMongoUserRepository } from './mongo-user.repository.js';

/**
 * Suite única ejecutada contra cada implementación de UserRepository, para
 * que el doble en memoria no pueda mentir sobre lo que Mongo hace de verdad
 * (el índice único, sobre todo).
 */
function describeUserRepositoryContract(name: string, createRepository: () => UserRepository): void {
  describe(`UserRepository (${name})`, () => {
    let repository: UserRepository;

    beforeAll(() => {
      repository = createRepository();
    });

    it('inserta un usuario y lo recupera por email', async () => {
      const user = await repository.insert({ email: 'ana@example.com', passwordHash: 'hash', createdAt: new Date() });

      expect(await repository.findByEmail('ana@example.com')).toEqual(user);
    });

    it('rechaza un email duplicado con DuplicateEmailError', async () => {
      await repository.insert({ email: 'dup@example.com', passwordHash: 'hash', createdAt: new Date() });

      await expect(
        repository.insert({ email: 'dup@example.com', passwordHash: 'otro-hash', createdAt: new Date() }),
      ).rejects.toThrow(DuplicateEmailError);
    });

    it('findByEmail devuelve null si el usuario no existe', async () => {
      expect(await repository.findByEmail('no-existe@example.com')).toBeNull();
    });

    it('findById recupera el usuario insertado por su id', async () => {
      const email = `id-${randomBytes(4).toString('hex')}@example.com`;
      const user = await repository.insert({ email, passwordHash: 'hash', createdAt: new Date() });

      expect(await repository.findById(user.id)).toEqual(user);
    });

    it('findById devuelve null para un id que no existe', async () => {
      expect(await repository.findById(new ObjectId().toHexString())).toBeNull();
    });
  });
}

function newTokenInput(overrides: Partial<NewRefreshToken> = {}): NewRefreshToken {
  const now = new Date();
  return {
    userId: new ObjectId().toHexString(),
    familyId: randomUUID(),
    tokenHash: randomBytes(32).toString('hex'),
    createdAt: now,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    familyExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * markRotated es el corazón de la detección de reutilización: la segunda
 * llamada sobre el mismo token debe devolver false tanto en memoria como en
 * Mongo, o la protección contra tokens robados sería decorativa.
 */
function describeRefreshTokenRepositoryContract(name: string, createRepository: () => RefreshTokenRepository): void {
  describe(`RefreshTokenRepository (${name})`, () => {
    let repository: RefreshTokenRepository;

    beforeAll(() => {
      repository = createRepository();
    });

    it('inserta un token y lo recupera por su hash', async () => {
      const input = newTokenInput();
      const token = await repository.insert(input);

      expect(await repository.findByTokenHash(input.tokenHash)).toEqual(token);
    });

    it('findByTokenHash devuelve null para un hash desconocido', async () => {
      expect(await repository.findByTokenHash('hash-inexistente')).toBeNull();
    });

    it('markRotated marca el token como rotado y devuelve true la primera vez', async () => {
      const token = await repository.insert(newTokenInput());
      const replacedByHash = randomBytes(32).toString('hex');

      const rotated = await repository.markRotated(token.tokenHash, replacedByHash, new Date());

      expect(rotated).toBe(true);
      const stored = await repository.findByTokenHash(token.tokenHash);
      expect(stored?.rotatedAt).not.toBeNull();
      expect(stored?.replacedByHash).toBe(replacedByHash);
    });

    it('markRotated devuelve false si el token ya estaba rotado', async () => {
      const token = await repository.insert(newTokenInput());
      await repository.markRotated(token.tokenHash, randomBytes(32).toString('hex'), new Date());

      const secondAttempt = await repository.markRotated(token.tokenHash, randomBytes(32).toString('hex'), new Date());

      expect(secondAttempt).toBe(false);
    });

    it('markRotated devuelve false para un token que no existe', async () => {
      expect(await repository.markRotated('hash-inexistente', 'x', new Date())).toBe(false);
    });

    it('revokeFamily revoca todos los tokens vivos de la familia con la razón dada', async () => {
      const familyId = randomUUID();
      const tokenA = await repository.insert(newTokenInput({ familyId }));
      const tokenB = await repository.insert(newTokenInput({ familyId }));

      await repository.revokeFamily(familyId, 'reuse_detected', new Date());

      const storedA = await repository.findByTokenHash(tokenA.tokenHash);
      const storedB = await repository.findByTokenHash(tokenB.tokenHash);
      expect(storedA?.revokedAt).not.toBeNull();
      expect(storedA?.revokedReason).toBe('reuse_detected');
      expect(storedB?.revokedAt).not.toBeNull();
      expect(storedB?.revokedReason).toBe('reuse_detected');
    });

    it('revokeFamily no toca tokens de otra familia', async () => {
      const ajeno = await repository.insert(newTokenInput());

      await repository.revokeFamily(randomUUID(), 'reuse_detected', new Date());

      expect((await repository.findByTokenHash(ajeno.tokenHash))?.revokedAt).toBeNull();
    });
  });
}

describeUserRepositoryContract('en memoria', createInMemoryUserRepository);
describeRefreshTokenRepositoryContract('en memoria', createInMemoryRefreshTokenRepository);

describe.skipIf(!process.env.MONGODB_TEST_URI)('integración con MongoDB', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describeUserRepositoryContract('mongodb', () => createMongoUserRepository(db));
  describeRefreshTokenRepositoryContract('mongodb', () => createMongoRefreshTokenRepository(db));
});
