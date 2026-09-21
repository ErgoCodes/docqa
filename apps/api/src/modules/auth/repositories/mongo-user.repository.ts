import { MongoServerError, ObjectId, type Collection, type Db } from 'mongodb';
import type { NewUser, UserRepository } from '../interfaces/user.repository.js';
import { DuplicateEmailError, type User } from '../types/user.js';

interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

function toDomain(doc: UserDocument): User {
  return { id: doc._id.toHexString(), email: doc.email, passwordHash: doc.passwordHash, createdAt: doc.createdAt };
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11000;
}

export function createMongoUserRepository(db: Db): UserRepository {
  const collection: Collection<UserDocument> = db.collection('users');

  return {
    insert: async (user: NewUser): Promise<User> => {
      const doc: UserDocument = { _id: new ObjectId(), ...user };

      try {
        await collection.insertOne(doc);
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) {
          throw new DuplicateEmailError(user.email);
        }
        throw error;
      }

      return toDomain(doc);
    },

    findByEmail: async (email: string): Promise<User | null> => {
      const doc = await collection.findOne({ email });
      return doc ? toDomain(doc) : null;
    },

    findById: async (userId: string): Promise<User | null> => {
      if (!ObjectId.isValid(userId)) {
        return null;
      }
      const doc = await collection.findOne({ _id: new ObjectId(userId) });
      return doc ? toDomain(doc) : null;
    },
  };
}
