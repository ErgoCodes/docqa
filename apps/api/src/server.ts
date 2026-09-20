import Fastify, { type FastifyInstance } from 'fastify';
import { buildHealthResponse } from './health.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', () => buildHealthResponse());

  return app;
}
