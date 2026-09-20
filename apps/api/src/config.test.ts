import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv = {
  CORS_ORIGIN: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://localhost:27017/docqa',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('parsea un entorno válido y aplica los valores por defecto', () => {
    const config = loadConfig(validEnv);

    expect(config.API_PORT).toBe(3000);
    expect(config.API_HOST).toBe('0.0.0.0');
    expect(config.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(config.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('lanza con un mensaje legible cuando falta JWT_SECRET', () => {
    const envWithoutSecret = { CORS_ORIGIN: validEnv.CORS_ORIGIN, MONGODB_URI: validEnv.MONGODB_URI };

    expect(() => loadConfig(envWithoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('lanza cuando JWT_SECRET es demasiado corto', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'demasiado-corto' })).toThrow(
      /al menos 32 caracteres/,
    );
  });

  it('nunca incluye el valor recibido en el mensaje de error', () => {
    const secretoInvalido = 'valor-secreto-que-no-deberia-aparecer-en-logs';

    expect.assertions(1);
    try {
      loadConfig({ ...validEnv, JWT_SECRET: secretoInvalido.slice(0, 10) });
    } catch (error) {
      expect(String(error)).not.toContain(secretoInvalido.slice(0, 10));
    }
  });

  it('rechaza un CORS_ORIGIN que no sea una URL', () => {
    expect(() => loadConfig({ ...validEnv, CORS_ORIGIN: 'no-es-una-url' })).toThrow();
  });
});
