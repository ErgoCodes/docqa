import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../interfaces/password-hasher.js';

export interface Argon2Options {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

/**
 * Argon2id (algoritmo por defecto de @node-rs/argon2). Los parámetros van
 * embebidos en el hash resultante (formato PHC), así que `verify` no
 * necesita que se le repitan: subir memoryCost/timeCost más adelante no
 * invalida los hashes ya guardados.
 */
export function createArgon2Hasher(options: Argon2Options): PasswordHasher {
  return {
    hash: (plain: string): Promise<string> => hash(plain, options),
    verify: (hashed: string, plain: string): Promise<boolean> => verify(hashed, plain),
  };
}
