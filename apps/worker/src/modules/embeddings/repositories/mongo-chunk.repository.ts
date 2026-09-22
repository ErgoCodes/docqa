import { ObjectId, type Collection, type Db } from 'mongodb';
import type { ChunkRepository } from '../interfaces/chunk.repository.js';
import type { EmbeddedChunk } from '../types/embedded-chunk.js';

interface ChunkMongoDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  embedding: number[];
}

export function createMongoChunkRepository(db: Db): ChunkRepository {
  const collection: Collection<ChunkMongoDoc> = db.collection('chunks');

  return {
    insertMany: async (chunks: EmbeddedChunk[]): Promise<void> => {
      if (chunks.length === 0) {
        return;
      }

      // RNF-01: Each chunk explicitly preserves the exact userId from the domain chunk.
      // Converting to ObjectId enforces 24-character hexadecimal format and rejects empty/malformed userIds.
      const docs: ChunkMongoDoc[] = chunks.map((chunk) => ({
        _id: new ObjectId(),
        documentId: new ObjectId(chunk.documentId),
        userId: new ObjectId(chunk.userId),
        page: chunk.page,
        index: chunk.index,
        text: chunk.text,
        embedding: chunk.embedding,
      }));

      await collection.insertMany(docs);
    },
  };
}
