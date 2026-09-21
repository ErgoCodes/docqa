import type { FastifyPluginAsync } from 'fastify';
import {
  authResultResponseSchema,
  authTokensResponseSchema,
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

export interface AuthRoutesOptions {
  service: AuthService;
}

export const registerAuthRoutes: FastifyPluginAsync<AuthRoutesOptions> = (app, { service }) => {
  app.post('/auth/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const result = await service.register(body.email, body.password);
    void reply.status(201);
    return authResultResponseSchema.parse(result);
  });

  app.post('/auth/login', async (request) => {
    const body = loginBodySchema.parse(request.body);
    const result = await service.login(body.email, body.password);
    return authResultResponseSchema.parse(result);
  });

  app.post('/auth/refresh', async (request) => {
    const body = refreshBodySchema.parse(request.body);
    const tokens = await service.refresh(body.refreshToken);
    return authTokensResponseSchema.parse(tokens);
  });

  // 204 aunque el token no exista o ya estuviera revocado: cerrar sesión
  // dos veces, o cerrar sesión de un token ya expirado, no es un error.
  app.post('/auth/logout', async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    await service.logout(body.refreshToken);
    void reply.status(204).send();
  });

  return Promise.resolve();
};
