import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function buildHealthResponse(): HealthResponse {
  return healthResponseSchema.parse({
    status: 'ok',
    uptime: process.uptime(),
  });
}
