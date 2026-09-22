import { ObjectId, type Collection, type Db } from 'mongodb';
import type { DocumentRepository } from '../interfaces/document.repository.js';
import type { Document, DocumentStatus } from '../types/document.js';

interface DocumentMongoDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  storageKey: string;
  pages: number;
  status: DocumentStatus;
  error: string | null;
  createdAt: Date;
}

function toDomain(doc: DocumentMongoDoc): Document {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    title: doc.title,
    storageKey: doc.storageKey,
    pages: doc.pages,
    status: doc.status,
    error: doc.error,
    createdAt: doc.createdAt,
  };
}

export function createMongoDocumentRepository(db: Db): DocumentRepository {
  const collection: Collection<DocumentMongoDoc> = db.collection('documents');

  return {
    findById: async (id: string): Promise<Document | null> => {
      if (!ObjectId.isValid(id)) {
        return null;
      }

      const doc = await collection.findOne({
        _id: new ObjectId(id),
      });

      return doc ? toDomain(doc) : null;
    },

    updateStatus: async (id: string, status: DocumentStatus, error: string | null = null): Promise<void> => {
      if (!ObjectId.isValid(id)) {
        return;
      }

      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, error } },
      );
    },
  };
}
