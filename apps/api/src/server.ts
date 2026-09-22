import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config.js';
import type { AppDependencies } from './dependencies.js';
import { registerAuthRoutes } from './modules/auth/routes/auth.routes.js';
import { createAuthService } from './modules/auth/services/auth.service.js';
import { registerDocumentRoutes } from './modules/documents/routes/document.routes.js';
import { createDocumentService } from './modules/documents/services/document.service.js';
import { registerHealthRoutes } from './modules/health/routes/health.routes.js';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerMultipart } from './plugins/multipart.js';
import { createLoggerOptions, registerSecurity } from './plugins/security.js';

export interface BuildServerOptions {
  config: AppConfig;
  dependencies: AppDependencies;
  loggerOptions?: FastifyServerOptions['logger'];
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { config, dependencies, loggerOptions } = options;
  const app = Fastify({ logger: loggerOptions ?? createLoggerOptions(config) });

  registerErrorHandler(app);
  await registerSecurity(app, config);
  await registerMultipart(app);
  await registerAuth(app, config);

  const authService = createAuthService({
    users: dependencies.users,
    refreshTokens: dependencies.refreshTokens,
    hasher: dependencies.hasher,
    signAccessToken: (payload) => app.signAccessToken(payload),
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
    refreshFamilyMaxDays: config.REFRESH_FAMILY_MAX_DAYS,
  });

  const documentService = createDocumentService({
    documents: dependencies.documents,
    objectStorage: dependencies.objectStorage,
    ingestionQueue: dependencies.ingestionQueue,
  });

  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes, { service: authService });
  await app.register(registerDocumentRoutes, { service: documentService });

  return app;
}
