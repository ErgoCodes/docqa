import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config.js';
import type { AppDependencies } from '../dependencies.js';
import { buildServer } from '../server.js';
import { createTestConfig } from './config.js';
import { createInMemoryDependencies } from './fakes.js';

export interface BuildTestAppOverrides {
  config?: Partial<AppConfig>;
  dependencies?: Partial<AppDependencies>;
  loggerOptions?: FastifyServerOptions['logger'];
}

export interface TestApp {
  app: FastifyInstance;
  config: AppConfig;
  dependencies: AppDependencies;
}

export async function buildTestApp(overrides: BuildTestAppOverrides = {}): Promise<TestApp> {
  const config = createTestConfig(overrides.config);
  const dependencies: AppDependencies = { ...createInMemoryDependencies(), ...overrides.dependencies };
  const app = await buildServer({ config, dependencies, loggerOptions: overrides.loggerOptions ?? false });

  return { app, config, dependencies };
}
