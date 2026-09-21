import type { FastifyInstance } from 'fastify';
import { AppError, mapErrorToResponse } from '../errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = mapErrorToResponse(error, request.id);

    if (statusCode >= 500) {
      request.log.error(error);
    }

    void reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const { statusCode, body } = mapErrorToResponse(
      new AppError({ code: 'NOT_FOUND', statusCode: 404, message: 'Recurso no encontrado' }),
      request.id,
    );
    void reply.status(statusCode).send(body);
  });
}
