import { healthResponseSchema, type HealthResponse } from '../schemas/health.schema.js';

export function buildHealthResponse(): HealthResponse {
  return healthResponseSchema.parse({
    status: 'ok',
    uptime: process.uptime(),
  });
}
