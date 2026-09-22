import { z } from 'zod';

const citationResponseSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  page: z.number().int().positive(),
});

const messageResponseSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(citationResponseSchema),
  createdAt: z.date(),
});

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
