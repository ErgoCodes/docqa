import { ObjectId, type Collection, type Db } from 'mongodb';
import type { DocumentRepository } from '../interfaces/document.repository.js';
import type { Document, DocumentStatus, NewDocument } from '../types/document.js';

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
    insert: async (document: NewDocument): Promise<Document> => {
      const doc: DocumentMongoDoc = {
        _id: new ObjectId(),
        userId: new ObjectId(document.userId),
        title: document.title,
        storageKey: document.storageKey,
        pages: document.pages,
        status: document.status,
        error: document.error,
        createdAt: document.createdAt,
      };

      await collection.insertOne(doc);
      return toDomain(doc);
    },

    // RNF-01: filtrado directo por _id Y userId en la misma query de Mongo,
    // evitando recuperar documentos de otro usuario en memoria.
    findById: async (id: string, userId: string): Promise<Document | null> => {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) {
        return null;
      }

      const doc = await collection.findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      });

      return doc ? toDomain(doc) : null;
    },

    findAllByUser: async (userId: string): Promise<Document[]> => {
      if (!ObjectId.isValid(userId)) {
        return [];
      }

      const docs = await collection
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();

      return docs.map(toDomain);
    },
  };
}
