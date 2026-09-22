import { ObjectId, type Collection, type Db } from 'mongodb';
import type { ChunkReader } from '../interfaces/chunk-reader.js';
import type { Chunk } from '../types/chunk.js';

interface ChunkMongoDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  embedding: number[];
}

export function createMongoChunkReader(db: Db): ChunkReader {
  const collection: Collection<ChunkMongoDoc> = db.collection('chunks');

  return {
    findById: async (id: string, userId: string): Promise<Chunk | null> => {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) {
        return null;
      }

      const doc = await collection.findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      });

      if (!doc) {
        return null;
      }

      return {
        id: doc._id.toHexString(),
        documentId: doc.documentId.toHexString(),
        userId: doc.userId.toHexString(),
        page: doc.page,
        index: doc.index,
        text: doc.text,
      };
    },
  };
}
