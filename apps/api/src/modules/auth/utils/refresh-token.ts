import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
}

/**
 * El refresh token es opaco (no un JWT): su validez vive en Mongo de todos
 * modos, así que un JWT añadiría una segunda fuente de verdad que puede
 * contradecir a la primera. 32 bytes aleatorios en base64url (43 chars).
 */
export function generateRefreshToken(): GeneratedRefreshToken {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

// SHA-256 y no Argon2: con 256 bits de entropía no hay diccionario que
// atacar, así que el coste de un KDF no compra nada y sí haría lenta cada
// renovación. Argon2 es para secretos de baja entropía elegidos por humanos.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
