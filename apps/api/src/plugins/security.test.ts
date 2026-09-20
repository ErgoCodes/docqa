import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../testing/build-test-app.js';

describe('seguridad HTTP', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('permite el origen configurado en CORS_ORIGIN', async () => {
    ({ app } = await buildTestApp({ config: { CORS_ORIGIN: 'http://localhost:5173' } }));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('no permite un origen distinto al configurado', async () => {
    ({ app } = await buildTestApp({ config: { CORS_ORIGIN: 'http://localhost:5173' } }));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://malicioso.example' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('añade cabeceras de seguridad a la respuesta', async () => {
    ({ app } = await buildTestApp());

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
