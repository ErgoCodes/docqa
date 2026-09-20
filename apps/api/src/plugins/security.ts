import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config.js';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  '*.password',
  'body.password',
  'refreshToken',
  '*.refreshToken',
  'accessToken',
  '*.accessToken',
  'passwordHash',
  '*.passwordHash',
];

/**
 * Defensa en profundidad, no el control principal: Fastify no registra
 * cuerpos ni cabeceras por defecto (su serializador de `req` solo emite
 * method/url/host/remoteAddress). Esto cubre el descuido de alguien
 * depurando con `request.log.info({ body: request.body })`.
 */
export function createLoggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  return {
    level: config.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTADO]' },
  };
}

/**
 * Se registran directamente sobre la instancia raíz (no dentro de un plugin
 * propio) para que sus hooks se apliquen a todas las rutas: @fastify/helmet
 * y @fastify/cors ya rompen su propio encapsulamiento internamente, pero
 * envolverlos en un plugin nuestro sin fastify-plugin crearía un contexto
 * hijo cuyos hooks no alcanzarían a las rutas registradas como hermanas.
 */
export async function registerSecurity(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  });

  await app.register(cors, {
    origin: [config.CORS_ORIGIN],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 86400,
  });
}
