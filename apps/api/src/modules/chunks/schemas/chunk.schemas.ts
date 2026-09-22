import { z } from 'zod';

export const chunkIdParamsSchema = z.object({ id: z.string().min(1) }).strict();

export type ChunkIdParams = z.infer<typeof chunkIdParamsSchema>;

export const chunkResponseSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  page: z.number().int().nonnegative(),
  index: z.number().int().nonnegative(),
  text: z.string(),
});

export type ChunkResponse = z.infer<typeof chunkResponseSchema>;
