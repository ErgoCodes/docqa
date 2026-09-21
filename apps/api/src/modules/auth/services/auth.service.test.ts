import { describe, expect, it } from 'vitest';
import { createInMemoryRefreshTokenRepository, createInMemoryUserRepository } from '../../../testing/fakes.js';
import type { UserRepository } from '../interfaces/user.repository.js';
import { createArgon2Hasher } from '../utils/password-hasher.js';
import { hashRefreshToken } from '../utils/refresh-token.js';
import { createAuthService, type AuthService } from './auth.service.js';

// memoryCost bajo a propósito, igual que en password-hasher.test.ts: se usa
// el argon2 real (no un mock) sin pagar su coste en cada test.
const hasher = createArgon2Hasher({ memoryCost: 8, timeCost: 1, parallelism: 1 });

function createTestService(options: {
  now?: () => Date;
  refreshTokenTtlDays?: number;
  refreshFamilyMaxDays?: number;
} = {}): AuthService {
  return createAuthService({
    users: createInMemoryUserRepository(),
    refreshTokens: createInMemoryRefreshTokenRepository(),
    hasher,
    signAccessToken: (payload) => `access-for-${payload.sub}`,
    accessTokenTtlSeconds: 900,
    refreshTokenTtlDays: options.refreshTokenTtlDays ?? 7,
    refreshFamilyMaxDays: options.refreshFamilyMaxDays ?? 30,
    now: options.now,
  });
}

async function expectAppError(promise: Promise<unknown>, code: string, statusCode: number): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code, statusCode });
}

describe('AuthService', () => {
  describe('register', () => {
    it('crea un usuario y devuelve tokens', async () => {
      const service = createTestService();

      const result = await service.register('ana@example.com', 'contrasena-larga-123');

      expect(result.user.email).toBe('ana@example.com');
      expect(result.tokens.accessToken).toBe(`access-for-${result.user.id}`);
      expect(result.tokens.tokenType).toBe('Bearer');
      expect(result.tokens.expiresIn).toBe(900);
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('rechaza un email duplicado con EMAIL_ALREADY_REGISTERED', async () => {
      const service = createTestService();
      await service.register('dup@example.com', 'contrasena-larga-123');

      await expectAppError(
        service.register('dup@example.com', 'otra-contrasena-larga'),
        'EMAIL_ALREADY_REGISTERED',
        409,
      );
    });

    it('propaga sin convertir un error inesperado del repositorio', async () => {
      const usersThatFail: UserRepository = {
        insert: () => Promise.reject(new Error('fallo de conexión inesperado')),
        findByEmail: () => Promise.resolve(null),
        findById: () => Promise.resolve(null),
      };
      const service = createAuthService({
        users: usersThatFail,
        refreshTokens: createInMemoryRefreshTokenRepository(),
        hasher,
        signAccessToken: (payload) => `access-for-${payload.sub}`,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlDays: 7,
        refreshFamilyMaxDays: 30,
      });

      await expect(service.register('ana@example.com', 'contrasena-larga-123')).rejects.toThrow(
        'fallo de conexión inesperado',
      );
    });
  });

  describe('login', () => {
    it('devuelve tokens con la contraseña correcta', async () => {
      const service = createTestService();
      await service.register('ana@example.com', 'contrasena-larga-123');

      const result = await service.login('ana@example.com', 'contrasena-larga-123');

      expect(result.user.email).toBe('ana@example.com');
    });

    it('rechaza con INVALID_CREDENTIALS si la contraseña es incorrecta', async () => {
      const service = createTestService();
      await service.register('ana@example.com', 'contrasena-larga-123');

      await expectAppError(service.login('ana@example.com', 'contrasena-equivocada'), 'INVALID_CREDENTIALS', 401);
    });

    it('rechaza con el mismo error si el email no existe, sin lanzar por el hash señuelo', async () => {
      const service = createTestService();

      await expectAppError(
        service.login('no-existe@example.com', 'cualquier-contrasena'),
        'INVALID_CREDENTIALS',
        401,
      );
    });
  });

  describe('refresh', () => {
    it('rota el token: el nuevo funciona y el viejo deja de servir', async () => {
      const service = createTestService();
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      const rotated = await service.refresh(tokens.refreshToken);

      expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
      await expectAppError(service.refresh(tokens.refreshToken), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('detecta la reutilización de un token ya rotado y revoca la familia entera', async () => {
      const service = createTestService();
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      const rotated = await service.refresh(tokens.refreshToken);
      await expectAppError(service.refresh(tokens.refreshToken), 'INVALID_REFRESH_TOKEN', 401);

      // el sucesor legítimo también queda invalidado: la familia entera murió
      await expectAppError(service.refresh(rotated.refreshToken), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('revoca la familia y rechaza el refresh si el usuario asociado ya no existe', async () => {
      const refreshTokens = createInMemoryRefreshTokenRepository();
      const service = createAuthService({
        users: createInMemoryUserRepository(),
        refreshTokens,
        hasher,
        signAccessToken: (payload) => `access-for-${payload.sub}`,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlDays: 7,
        refreshFamilyMaxDays: 30,
      });
      const plainToken = 'token-de-un-usuario-que-fue-borrado';
      const currentTime = new Date();
      await refreshTokens.insert({
        userId: 'usuario-que-ya-no-existe',
        familyId: 'familia-huerfana',
        tokenHash: hashRefreshToken(plainToken),
        createdAt: currentTime,
        expiresAt: new Date(currentTime.getTime() + 60 * 60 * 1000),
        familyExpiresAt: new Date(currentTime.getTime() + 60 * 60 * 1000),
      });

      await expectAppError(service.refresh(plainToken), 'INVALID_REFRESH_TOKEN', 401);

      const stored = await refreshTokens.findByTokenHash(hashRefreshToken(plainToken));
      expect(stored?.revokedReason).toBe('user_deleted');
    });

    it('rechaza un token que no existe', async () => {
      const service = createTestService();

      await expectAppError(service.refresh('token-que-no-existe'), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('rechaza un token expirado', async () => {
      let currentTime = new Date('2026-01-01T00:00:00.000Z');
      const service = createTestService({ now: () => currentTime, refreshTokenTtlDays: 7 });
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      currentTime = new Date('2026-01-09T00:00:00.000Z'); // 8 días después de un TTL de 7

      await expectAppError(service.refresh(tokens.refreshToken), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('rechaza un token vigente pero fuera del tope absoluto de familia', async () => {
      let currentTime = new Date('2026-01-01T00:00:00.000Z');
      const service = createTestService({ now: () => currentTime, refreshTokenTtlDays: 30, refreshFamilyMaxDays: 1 });
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      currentTime = new Date('2026-01-03T00:00:00.000Z'); // familyMaxDays=1 ya venció, aunque el TTL del token no

      await expectAppError(service.refresh(tokens.refreshToken), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('no extiende el tope de familia al rotar', async () => {
      let currentTime = new Date('2026-01-01T00:00:00.000Z');
      const service = createTestService({ now: () => currentTime, refreshTokenTtlDays: 30, refreshFamilyMaxDays: 5 });
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      currentTime = new Date('2026-01-02T00:00:00.000Z');
      const rotated = await service.refresh(tokens.refreshToken);

      currentTime = new Date('2026-01-07T00:00:00.000Z'); // 6 días desde el registro: el tope de 5 ya pasó
      await expectAppError(service.refresh(rotated.refreshToken), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('con dos rotaciones concurrentes del mismo token, solo una gana', async () => {
      const service = createTestService();
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      const results = await Promise.allSettled([service.refresh(tokens.refreshToken), service.refresh(tokens.refreshToken)]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('logout', () => {
    it('invalida el refresh token: una renovación posterior falla', async () => {
      const service = createTestService();
      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');

      await service.logout(tokens.refreshToken);

      await expectAppError(service.refresh(tokens.refreshToken), 'INVALID_REFRESH_TOKEN', 401);
    });

    it('es idempotente: no lanza para un token inexistente o ya cerrado', async () => {
      const service = createTestService();

      await expect(service.logout('token-que-no-existe')).resolves.toBeUndefined();

      const { tokens } = await service.register('ana@example.com', 'contrasena-larga-123');
      await service.logout(tokens.refreshToken);

      await expect(service.logout(tokens.refreshToken)).resolves.toBeUndefined();
    });
  });
});
