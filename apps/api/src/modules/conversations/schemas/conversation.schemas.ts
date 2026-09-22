import { z } from 'zod';

export const citationResponseSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  page: z.number().int().positive(),
});

export type CitationResponse = z.infer<typeof citationResponseSchema>;

export const messageResponseSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(citationResponseSchema),
  createdAt: z.date(),
});

export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const createConversationBodySchema = z
  .object({
    documentIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;

export const conversationResponseSchema = z.object({
  id: z.string(),
  documentIds: z.array(z.string()),
  messages: z.array(messageResponseSchema),
  createdAt: z.date(),
});

export type ConversationResponse = z.infer<typeof conversationResponseSchema>;

export const conversationIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export type ConversationIdParams = z.infer<typeof conversationIdParamsSchema>;

export const sendMessageBodySchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
  })
  .strict();

export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
