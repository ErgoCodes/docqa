import { z } from 'zod';

const configSchema = z.object({
  MONGODB_URI: z.string().startsWith('mongodb'),
  VOYAGE_API_KEY: z.string().min(1),
  EMBEDDINGS_MODEL: z.string().min(1).default('voyage-3-lite'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${details}`);
  }

  return result.data;
}
