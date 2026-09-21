import type { Db } from 'mongodb';

/**
 * createIndex es idempotente salvo que cambien las opciones de un índice ya
 * creado, en cuyo caso Mongo lanza IndexOptionsConflict y la API no arranca.
 * Suficiente para un proyecto de este tamaño; en producción sería una
 * migración versionada.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });

  const refreshTokens = db.collection('refreshTokens');
  await refreshTokens.createIndex({ tokenHash: 1 }, { unique: true });
  await refreshTokens.createIndex({ familyId: 1 });
  await refreshTokens.createIndex({ userId: 1 });
  // TTL de higiene, no de seguridad: el monitor de Mongo pasa cada ~60s, así
  // que la validez de un token siempre se comprueba en código comparando
  // expiresAt, nunca confiando en que el documento ya se haya borrado.
  await refreshTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
