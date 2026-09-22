import { loadConfig } from './config.js';
import { createAppDependencies } from './dependencies.js';
import { buildServer } from './server.js';

const config = loadConfig();
const dependencies = await createAppDependencies(config);
const app = await buildServer({ config, dependencies });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'apagando');
  await app.close();
  await dependencies.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: config.API_PORT, host: config.API_HOST });
} catch (error: unknown) {
  app.log.error(error);
  await dependencies.close();
  process.exit(1);
}
