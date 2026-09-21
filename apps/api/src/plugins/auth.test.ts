import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config.js';
import { buildTestApp } from '../testing/build-test-app.js';

/**
 * No existe ningún endpoint protegido todavía (REQUIREMENTS.md §7 no lo
 * contempla más allá de auth), así que el decorator se testea con una ruta
 * definida aquí mismo, no en el árbol de rutas de la API.
 */
async function buildAppWithProtectedRoute(config: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  const { app } = await buildTestApp({ config });
  app.get('/__protected', { onRequest: app.authenticate }, (request) => ({ sub: request.user.sub }));
  await app.ready();
  return app;
}

describe('decorator authenticate', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('rechaza la petición sin cabecera Authorization', async () => {
    app = await buildAppWithProtectedRoute();

    const response = await app.inject({ method: 'GET', url: '/__protected' });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rechaza un token corrupto', async () => {
    app = await buildAppWithProtectedRoute();

    const response = await app.inject({
      method: 'GET',
      url: '/__protected',
      headers: { authorization: 'Bearer esto-no-es-un-jwt' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rechaza un token firmado con un secreto distinto', async () => {
    app = await buildAppWithProtectedRoute();
    const otroApp = await buildAppWithProtectedRoute({ JWT_SECRET: 'y'.repeat(32) });
    const tokenAjeno = otroApp.signAccessToken({ sub: 'u1', typ: 'access' });
    await otroApp.close();

    const response = await app.inject({
      method: 'GET',
      url: '/__protected',
      headers: { authorization: `Bearer ${tokenAjeno}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rechaza un token expirado', async () => {
    app = await buildAppWithProtectedRoute();
    const expirado = app.jwt.sign({ sub: 'u1', typ: 'access' }, { expiresIn: '-1s' });

    const response = await app.inject({
      method: 'GET',
      url: '/__protected',
      headers: { authorization: `Bearer ${expirado}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rechaza un token con audiencia distinta a la configurada', async () => {
    app = await buildAppWithProtectedRoute();
    const conOtraAudiencia = app.jwt.sign({ sub: 'u1', typ: 'access' }, { aud: 'otra-audiencia' });

    const response = await app.inject({
      method: 'GET',
      url: '/__protected',
      headers: { authorization: `Bearer ${conOtraAudiencia}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('acepta un token válido y expone request.user.sub', async () => {
    app = await buildAppWithProtectedRoute();
    const token = app.signAccessToken({ sub: 'user-123', typ: 'access' });

    const response = await app.inject({
      method: 'GET',
      url: '/__protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sub: 'user-123' });
  });
});
