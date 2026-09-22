import { ObjectId, type Collection, type Db } from 'mongodb';
import type { ChunkDeleter } from '../interfaces/chunk-deleter.js';

interface ChunkMongoDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  embedding: number[];
}

export function createMongoChunkDeleter(db: Db): ChunkDeleter {
  const collection: Collection<ChunkMongoDoc> = db.collection('chunks');

  return {
    // RNF-01: fail closed before hitting Mongo, in addition to (never instead
    // of) filtering by both documentId and userId in the query itself.
    deleteByDocumentId: async (documentId: string, userId: string): Promise<number> => {
      if (!ObjectId.isValid(documentId) || !ObjectId.isValid(userId)) {
        return 0;
      }

      const result = await collection.deleteMany({
        documentId: new ObjectId(documentId),
        userId: new ObjectId(userId),
      });

      return result.deletedCount;
    },
  };
}
