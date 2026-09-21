import type { RefreshToken, RevokedReason } from '../types/refresh-token.js';

export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  familyExpiresAt: Date;
}

export interface RefreshTokenRepository {
  insert: (token: NewRefreshToken) => Promise<RefreshToken>;
  findByTokenHash: (tokenHash: string) => Promise<RefreshToken | null>;
  /**
   * Compare-and-set atómico: solo rota el token si sigue sin rotar ni
   * revocar. Devuelve false si otra petición concurrente ya lo rotó — sin
   * esto, dos rotaciones en paralelo del mismo token dejarían la detección
   * de reutilización sin efecto.
   */
  markRotated: (tokenHash: string, replacedByHash: string, now: Date) => Promise<boolean>;
  revokeFamily: (familyId: string, reason: RevokedReason, now: Date) => Promise<void>;
}
