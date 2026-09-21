import { describe, expect, it } from 'vitest';
import { createArgon2Hasher } from './password-hasher.js';

// memoryCost bajo a propósito: se ejecuta el argon2 real (no un mock), pero
// en ~1 ms en vez de ~50 ms, sin mockear el camino crítico.
const hasher = createArgon2Hasher({ memoryCost: 8, timeCost: 1, parallelism: 1 });

describe('createArgon2Hasher', () => {
  it('produce un hash argon2id distinto del texto plano', async () => {
    const hashed = await hasher.hash('una-contrasena-larga');

    expect(hashed).not.toBe('una-contrasena-larga');
    expect(hashed.startsWith('$argon2id$')).toBe(true);
  });

  it('verify devuelve true para la contraseña correcta', async () => {
    const hashed = await hasher.hash('una-contrasena-larga');

    expect(await hasher.verify(hashed, 'una-contrasena-larga')).toBe(true);
  });

  it('verify devuelve false para una contraseña incorrecta', async () => {
    const hashed = await hasher.hash('una-contrasena-larga');

    expect(await hasher.verify(hashed, 'otra-contrasena-distinta')).toBe(false);
  });

  it('dos hashes de la misma contraseña son distintos por la sal aleatoria', async () => {
    const [hashA, hashB] = await Promise.all([
      hasher.hash('misma-contrasena'),
      hasher.hash('misma-contrasena'),
    ]);

    expect(hashA).not.toBe(hashB);
  });
});
