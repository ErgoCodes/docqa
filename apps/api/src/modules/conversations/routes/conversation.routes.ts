import type { FastifyPluginAsync } from 'fastify';
import { conversationResponseSchema, createConversationBodySchema } from '../schemas/conversation.schemas.js';
import type { ConversationService } from '../services/conversation.service.js';

export interface ConversationRoutesOptions {
  service: ConversationService;
}

export const registerConversationRoutes: FastifyPluginAsync<ConversationRoutesOptions> = (app, { service }) => {
  app.post('/conversations', { preHandler: app.authenticate }, async (request, reply) => {
    const body = createConversationBodySchema.parse(request.body ?? {});
    const conversation = await service.create(request.user.sub, body.documentIds);
    void reply.status(201);
    return conversationResponseSchema.parse(conversation);
  });

  return Promise.resolve();
};
