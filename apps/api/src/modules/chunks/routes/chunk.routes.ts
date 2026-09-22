import type { FastifyPluginAsync } from 'fastify';
import { chunkIdParamsSchema, chunkResponseSchema } from '../schemas/chunk.schemas.js';
import type { GetChunkService } from '../services/get-chunk.service.js';

export interface ChunkRoutesOptions {
  service: GetChunkService;
}

export const registerChunkRoutes: FastifyPluginAsync<ChunkRoutesOptions> = (app, { service }) => {
  app.get('/chunks/:id', { preHandler: app.authenticate }, async (request) => {
    const params = chunkIdParamsSchema.parse(request.params);
    const chunk = await service.getById(params.id, request.user.sub);
    return chunkResponseSchema.parse(chunk);
  });

  return Promise.resolve();
};
