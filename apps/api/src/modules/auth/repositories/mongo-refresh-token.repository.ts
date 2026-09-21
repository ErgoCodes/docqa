import { ObjectId, type Collection, type Db } from 'mongodb';
import type { NewRefreshToken, RefreshTokenRepository } from '../interfaces/refresh-token.repository.js';
import type { RefreshToken, RevokedReason } from '../types/refresh-token.js';

interface RefreshTokenDocument {
  _id: ObjectId;
  userId: ObjectId;
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

function toDomain(doc: RefreshTokenDocument): RefreshToken {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    familyId: doc.familyId,
    tokenHash: doc.tokenHash,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    familyExpiresAt: doc.familyExpiresAt,
    rotatedAt: doc.rotatedAt,
    replacedByHash: doc.replacedByHash,
    revokedAt: doc.revokedAt,
    revokedReason: doc.revokedReason,
  };
}

export function createMongoRefreshTokenRepository(db: Db): RefreshTokenRepository {
  const collection: Collection<RefreshTokenDocument> = db.collection('refreshTokens');

  return {
    insert: async (token: NewRefreshToken): Promise<RefreshToken> => {
      const doc: RefreshTokenDocument = {
        _id: new ObjectId(),
        userId: new ObjectId(token.userId),
        familyId: token.familyId,
        tokenHash: token.tokenHash,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        familyExpiresAt: token.familyExpiresAt,
        rotatedAt: null,
        replacedByHash: null,
        revokedAt: null,
        revokedReason: null,
      };

      await collection.insertOne(doc);
      return toDomain(doc);
    },

    findByTokenHash: async (tokenHash: string): Promise<RefreshToken | null> => {
      const doc = await collection.findOne({ tokenHash });
      return doc ? toDomain(doc) : null;
    },

    markRotated: async (tokenHash: string, replacedByHash: string, now: Date): Promise<boolean> => {
      const result = await collection.findOneAndUpdate(
        { tokenHash, rotatedAt: null, revokedAt: null },
        { $set: { rotatedAt: now, replacedByHash, revokedAt: now, revokedReason: 'rotated' } },
      );
      return result !== null;
    },

    revokeFamily: async (familyId: string, reason: RevokedReason, now: Date): Promise<void> => {
      await collection.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now, revokedReason: reason } });
    },
  };
}
