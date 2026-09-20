import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config.js';
import type { AppDependencies } from './dependencies.js';
import { registerHealthRoutes } from './modules/health/routes/health.routes.js';
import { registerErrorHandler } from './plugins/error-handler.js';

export interface BuildServerOptions {
  config: AppConfig;
  dependencies: AppDependencies;
  loggerOptions?: FastifyServerOptions['logger'];
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { config, loggerOptions } = options;
  const app = Fastify({ logger: loggerOptions ?? { level: config.LOG_LEVEL } });

  registerErrorHandler(app);

  await app.register(registerHealthRoutes);

  return app;
}
