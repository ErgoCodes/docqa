import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGIN: z.string().url(),
  MONGODB_URI: z.string().startsWith('mongodb'),
  REDIS_URL: z.string().startsWith('redis'),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive(),
  MINIO_USE_SSL: z.enum(['true', 'false']).transform((v) => v === 'true'),
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_ISSUER: z.string().default('docqa-api'),
  JWT_AUDIENCE: z.string().default('docqa-client'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_FAMILY_MAX_DAYS: z.coerce.number().int().positive().default(30),
  ARGON2_MEMORY_COST: z.coerce.number().int().min(8).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
});

export type AppConfig = z.infer<typeof configSchema>;

/**
 * El mensaje de error nunca incluye el valor recibido (solo `path` y `message`
 * de cada issue de Zod): un secreto mal formado no puede acabar en stderr.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${details}`);
  }

  return result.data;
}
