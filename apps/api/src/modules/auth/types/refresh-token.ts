export type RevokedReason = 'rotated' | 'reuse_detected' | 'user_deleted' | 'logout';

export interface RefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  familyExpiresAt: Date;
  rotatedAt: Date | null;
  replacedByHash: string | null;
  revokedAt: Date | null;
  revokedReason: RevokedReason | null;
}
