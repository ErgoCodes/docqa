import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().startsWith('mongodb'),
  REDIS_URL: z.string().startsWith('redis'),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive(),
  MINIO_USE_SSL: z.enum(['true', 'false']).transform((v) => v === 'true'),
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  VOYAGE_API_KEY: z.string().min(1),
  EMBEDDINGS_MODEL: z.string().min(1).default('voyage-3-lite'),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${details}`);
  }

  return result.data;
}
