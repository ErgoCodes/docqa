import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../../errors.js';
import type { RateLimiter } from '../../rate-limit/interfaces/rate-limiter.js';
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
  questionRateLimiter: RateLimiter;
}

export const registerConversationRoutes: FastifyPluginAsync<ConversationRoutesOptions> = (
  app,
  { service, questionRateLimiter },
) => {
  const enforceQuestionRateLimit = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await questionRateLimiter.consume(`question:${request.user.sub}`);
    if (!result.allowed) {
      void reply.header('Retry-After', String(result.retryAfterSeconds));
      throw new AppError({
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        message: 'Has superado el límite de preguntas por minuto',
      });
    }
  };

  app.post('/conversations', { preHandler: app.authenticate }, async (request, reply) => {
    const body = createConversationBodySchema.parse(request.body ?? {});
    const conversation = await service.create(request.user.sub, body.documentIds);
    void reply.status(201);
    return conversationResponseSchema.parse(conversation);
  });

  app.get('/conversations/:id', { preHandler: app.authenticate }, async (request) => {
    const params = conversationIdParamsSchema.parse(request.params);
    const conversation = await service.getById(params.id, request.user.sub);
    return conversationResponseSchema.parse(conversation);
  });

  app.post('/conversations/:id/messages', { preHandler: [app.authenticate, enforceQuestionRateLimit] }, async (request, reply) => {
    const params = conversationIdParamsSchema.parse(request.params);
    const body = sendMessageBodySchema.parse(request.body);
    const result = await service.sendMessage(request.user.sub, params.id, body.question);
    void reply.header('X-Cache', result.cacheHit ? 'HIT' : 'MISS');
    return messageResponseSchema.parse(result.message);
  });

  return Promise.resolve();
};
