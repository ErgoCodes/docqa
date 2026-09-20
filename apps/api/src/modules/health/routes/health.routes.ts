import type { FastifyPluginAsync } from 'fastify';
import { buildHealthResponse } from '../services/health.service.js';

export const registerHealthRoutes: FastifyPluginAsync = (app) => {
  app.get('/health', () => buildHealthResponse());

  return Promise.resolve();
};
