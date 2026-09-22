import { z } from 'zod';

export const documentResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['processing', 'ready', 'error']),
  pages: z.number().int().nonnegative(),
  error: z.string().nullable(),
  createdAt: z.date(),
});

export type DocumentResponse = z.infer<typeof documentResponseSchema>;

export const documentListResponseSchema = z.array(documentResponseSchema);

export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

export const documentIdParamsSchema = z.object({ id: z.string().min(1) }).strict();

export type DocumentIdParams = z.infer<typeof documentIdParamsSchema>;
