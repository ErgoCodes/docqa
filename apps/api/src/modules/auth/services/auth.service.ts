import { randomUUID } from 'node:crypto';
import { AppError } from '../../../errors.js';
import type { RefreshTokenRepository } from '../interfaces/refresh-token.repository.js';
import type { PasswordHasher } from '../interfaces/password-hasher.js';
import type { UserRepository } from '../interfaces/user.repository.js';
import type { AccessTokenPayload } from '../types/access-token.js';
import { DuplicateEmailError, type User } from '../types/user.js';
import { generateRefreshToken, hashRefreshToken } from '../utils/refresh-token.js';

const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos';
const INVALID_REFRESH_TOKEN_MESSAGE = 'El token de renovación no es válido';

export interface AuthServiceDependencies {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  hasher: PasswordHasher;
  signAccessToken: (payload: AccessTokenPayload) => string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  refreshFamilyMaxDays: number;
  now?: () => Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface AuthService {
  register: (email: string, password: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
  logout: (refreshToken: string) => Promise<void>;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export function createAuthService(deps: AuthServiceDependencies): AuthService {
  const { users, refreshTokens, hasher, signAccessToken, accessTokenTtlSeconds, refreshTokenTtlDays, refreshFamilyMaxDays } =
    deps;
  const now = deps.now ?? ((): Date => new Date());

  // Memoizado por instancia: se calcula una sola vez con el hasher real de
  // este servicio (mismo coste que los usuarios de verdad), no en cada
  // intento de login con un email inexistente.
  let decoyHash: Promise<string> | undefined;
  function getDecoyHash(): Promise<string> {
    decoyHash ??= hasher.hash(randomUUID());
    return decoyHash;
  }

  async function issueNewSession(userId: string): Promise<AuthTokens> {
    const currentTime = now();
    const { token, tokenHash } = generateRefreshToken();

    await refreshTokens.insert({
      userId,
      familyId: randomUUID(),
      tokenHash,
      createdAt: currentTime,
      expiresAt: addDays(currentTime, refreshTokenTtlDays),
      familyExpiresAt: addDays(currentTime, refreshFamilyMaxDays),
    });

    return {
      accessToken: signAccessToken({ sub: userId, typ: 'access' }),
      refreshToken: token,
      tokenType: 'Bearer',
      expiresIn: accessTokenTtlSeconds,
    };
  }

  return {
    register: async (email: string, password: string): Promise<AuthResult> => {
      const passwordHash = await hasher.hash(password);

      let user: User;
      try {
        user = await users.insert({ email, passwordHash, createdAt: now() });
      } catch (error: unknown) {
        if (error instanceof DuplicateEmailError) {
          throw new AppError('EMAIL_ALREADY_REGISTERED', 409, 'Ya existe una cuenta con ese email');
        }
        throw error;
      }

      return { user: toAuthUser(user), tokens: await issueNewSession(user.id) };
    },

    login: async (email: string, password: string): Promise<AuthResult> => {
      const user = await users.findByEmail(email);

      if (!user) {
        // Sin esto, la diferencia de tiempo entre "email inexistente" (sin
        // verify) y "contraseña incorrecta" (con verify) delataría qué
        // emails están registrados, aunque el mensaje de error sea idéntico.
        await hasher.verify(await getDecoyHash(), password);
        throw new AppError('INVALID_CREDENTIALS', 401, INVALID_CREDENTIALS_MESSAGE);
      }

      const isValidPassword = await hasher.verify(user.passwordHash, password);
      if (!isValidPassword) {
        throw new AppError('INVALID_CREDENTIALS', 401, INVALID_CREDENTIALS_MESSAGE);
      }

      return { user: toAuthUser(user), tokens: await issueNewSession(user.id) };
    },

    refresh: async (refreshToken: string): Promise<AuthTokens> => {
      const tokenHash = hashRefreshToken(refreshToken);
      const record = await refreshTokens.findByTokenHash(tokenHash);

      if (!record) {
        throw new AppError('INVALID_REFRESH_TOKEN', 401, INVALID_REFRESH_TOKEN_MESSAGE);
      }

      const currentTime = now();

      if (record.rotatedAt !== null || record.revokedAt !== null) {
        // Un token ya rotado o revocado que vuelve a usarse es la señal de
        // un robo: se revoca toda la familia, no solo este token.
        await refreshTokens.revokeFamily(record.familyId, 'reuse_detected', currentTime);
        throw new AppError('INVALID_REFRESH_TOKEN', 401, INVALID_REFRESH_TOKEN_MESSAGE);
      }

      if (currentTime >= record.expiresAt || currentTime >= record.familyExpiresAt) {
        throw new AppError('INVALID_REFRESH_TOKEN', 401, INVALID_REFRESH_TOKEN_MESSAGE);
      }

      const user = await users.findById(record.userId);
      if (!user) {
        await refreshTokens.revokeFamily(record.familyId, 'user_deleted', currentTime);
        throw new AppError('INVALID_REFRESH_TOKEN', 401, INVALID_REFRESH_TOKEN_MESSAGE);
      }

      const { token: newToken, tokenHash: newTokenHash } = generateRefreshToken();
      const rotated = await refreshTokens.markRotated(tokenHash, newTokenHash, currentTime);

      if (!rotated) {
        // Otra petición ganó la carrera con este mismo token entre el
        // findByTokenHash de arriba y este compare-and-set: se trata igual
        // que una reutilización, o la protección sería decorativa.
        await refreshTokens.revokeFamily(record.familyId, 'reuse_detected', currentTime);
        throw new AppError('INVALID_REFRESH_TOKEN', 401, INVALID_REFRESH_TOKEN_MESSAGE);
      }

      await refreshTokens.insert({
        userId: record.userId,
        familyId: record.familyId,
        tokenHash: newTokenHash,
        createdAt: currentTime,
        expiresAt: addDays(currentTime, refreshTokenTtlDays),
        // Se preserva el tope absoluto original, no se extiende: si se
        // extendiera en cada rotación, una familia comprometida pero no
        // detectada podría renovarse para siempre.
        familyExpiresAt: record.familyExpiresAt,
      });

      return {
        accessToken: signAccessToken({ sub: record.userId, typ: 'access' }),
        refreshToken: newToken,
        tokenType: 'Bearer',
        expiresIn: accessTokenTtlSeconds,
      };
    },

    logout: async (refreshToken: string): Promise<void> => {
      const tokenHash = hashRefreshToken(refreshToken);
      const record = await refreshTokens.findByTokenHash(tokenHash);

      if (record && record.revokedAt === null) {
        await refreshTokens.revokeFamily(record.familyId, 'logout', now());
      }
    },
  };
}
