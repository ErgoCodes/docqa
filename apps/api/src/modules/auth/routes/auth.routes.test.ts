import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../testing/build-test-app.js';

interface AuthResponseBody {
  user: { id: string; email: string; createdAt: string };
  tokens: { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number };
}

interface TokensResponseBody {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

describe('rutas de auth', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('recorrido completo: registro, login, refresh, reutilización del token viejo, logout', async () => {
    ({ app } = await buildTestApp());

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'ana@example.com', password: 'contrasena-larga-123' },
    });
    expect(register.statusCode).toBe(201);
    const { tokens: registerTokens } = register.json<AuthResponseBody>();

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ana@example.com', password: 'contrasena-larga-123' },
    });
    expect(login.statusCode).toBe(200);

    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: registerTokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    const rotatedTokens = refresh.json<TokensResponseBody>();
    expect(rotatedTokens.refreshToken).not.toBe(registerTokens.refreshToken);

    const reuseOldToken = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: registerTokens.refreshToken },
    });
    expect(reuseOldToken.statusCode).toBe(401);
    expect(reuseOldToken.json<ErrorResponseBody>().error.code).toBe('INVALID_REFRESH_TOKEN');

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: rotatedTokens.refreshToken },
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.body).toBe('');

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: rotatedTokens.refreshToken },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  describe('POST /auth/register', () => {
    it('rechaza un email duplicado con 409', async () => {
      ({ app } = await buildTestApp());
      const payload = { email: 'dup@example.com', password: 'contrasena-larga-123' };

      await app.inject({ method: 'POST', url: '/auth/register', payload });
      const second = await app.inject({ method: 'POST', url: '/auth/register', payload });

      expect(second.statusCode).toBe(409);
      expect(second.json<ErrorResponseBody>().error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('rechaza una contraseña demasiado corta con 400', async () => {
      ({ app } = await buildTestApp());

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'ana@example.com', password: 'corta' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponseBody>().error.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza un email inválido con 400', async () => {
      ({ app } = await buildTestApp());

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'no-es-un-email', password: 'contrasena-larga-123' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('rechaza una contraseña incorrecta con 401 INVALID_CREDENTIALS', async () => {
      ({ app } = await buildTestApp());
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'ana@example.com', password: 'contrasena-larga-123' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ana@example.com', password: 'contrasena-equivocada' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponseBody>().error.code).toBe('INVALID_CREDENTIALS');
    });

    it('devuelve el mismo error para un email que no existe', async () => {
      ({ app } = await buildTestApp());

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'no-existe@example.com', password: 'cualquier-contrasena' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponseBody>().error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rechaza un token inexistente con 401 INVALID_REFRESH_TOKEN', async () => {
      ({ app } = await buildTestApp());

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'token-que-no-existe' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<ErrorResponseBody>().error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    it('es idempotente: 204 para un token que no existe', async () => {
      ({ app } = await buildTestApp());

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: { refreshToken: 'token-que-no-existe' },
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('RNF-02: la contraseña y los tokens nunca aparecen en los logs', () => {
    it('no escribe la contraseña ni el refresh token al registrar', async () => {
      const lines: string[] = [];
      ({ app } = await buildTestApp({
        loggerOptions: { level: 'trace', stream: { write: (line: string) => lines.push(line) } },
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'ana@example.com', password: 'contrasena-secretisima-1' },
      });
      const { tokens } = response.json<AuthResponseBody>();

      const logs = lines.join('');
      expect(logs).not.toContain('contrasena-secretisima-1');
      expect(logs).not.toContain(tokens.refreshToken);
      expect(logs).not.toContain(tokens.accessToken);
    });

    it('no escribe la contraseña al fallar el login', async () => {
      const lines: string[] = [];
      ({ app } = await buildTestApp({
        loggerOptions: { level: 'trace', stream: { write: (line: string) => lines.push(line) } },
      }));
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'ana@example.com', password: 'contrasena-secretisima-1' },
      });

      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ana@example.com', password: 'intento-fallido-de-contrasena' },
      });

      expect(lines.join('')).not.toContain('intento-fallido-de-contrasena');
    });
  });
});
