import type { FastifyPluginAsync } from 'fastify';
import {
  conversationIdParamsSchema,
  conversationResponseSchema,
  createConversationBodySchema,
  messageResponseSchema,
  sendMessageBodySchema,
} from '../schemas/conversation.schemas.js';
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

  app.post('/conversations/:id/messages', { preHandler: app.authenticate }, async (request, reply) => {
    const params = conversationIdParamsSchema.parse(request.params);
    const body = sendMessageBodySchema.parse(request.body);
    const result = await service.sendMessage(request.user.sub, params.id, body.question);
    void reply.header('X-Cache', 'MISS');
    return messageResponseSchema.parse(result);
  });

  return Promise.resolve();
};
