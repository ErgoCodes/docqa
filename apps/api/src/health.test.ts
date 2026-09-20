import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

describe('GET /health', () => {
  it('responds with ok status', async () => {
    const app = buildServer();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });
});
