import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { accessTokenPayloadSchema } from '../modules/auth/schemas/auth.schemas.js';
import type { AccessTokenPayload } from '../modules/auth/types/access-token.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // app.jwt.sign es la API síncrona de bajo nivel de @fastify/jwt (no
    // reply.jwtSign, que sí es async): no hay E/S, solo firma HMAC en memoria.
    signAccessToken: (payload: AccessTokenPayload) => string;
  }
}

/**
 * Igual que security.ts: se registra sobre la instancia raíz (no como un
 * plugin propio) para que app.decorate() y los hooks de @fastify/jwt
 * apliquen a todas las rutas, incluidas las registradas como hermanas.
 */
export async function registerAuth(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { iss: config.JWT_ISSUER, aud: config.JWT_AUDIENCE, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS },
    verify: { allowedIss: config.JWT_ISSUER, allowedAud: config.JWT_AUDIENCE },
  });

  app.decorate('signAccessToken', (payload: AccessTokenPayload): string => app.jwt.sign(payload));

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify();
    } catch {
      reply.header('WWW-Authenticate', 'Bearer');
      throw new AppError('UNAUTHORIZED', 401, 'Token de acceso ausente o inválido');
    }

    // request.user ya viene tipado como AccessTokenPayload por el
    // declaration merging de arriba; esto lo convierte en una garantía real.
    const result = accessTokenPayloadSchema.safeParse(request.user);
    if (!result.success) {
      reply.header('WWW-Authenticate', 'Bearer');
      throw new AppError('UNAUTHORIZED', 401, 'Token de acceso inválido');
    }
  });
}
