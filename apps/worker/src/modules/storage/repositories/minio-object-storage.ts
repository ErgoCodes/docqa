import type { Client } from 'minio';
import type { ObjectStorage } from '../interfaces/object-storage.js';
import { streamToBuffer } from '../utils/stream-to-buffer.js';

export function createMinioObjectStorage(client: Client, bucket: string): ObjectStorage {
  return {
    getObject: async (key: string): Promise<Buffer> => {
      const stream = await client.getObject(bucket, key);
      return streamToBuffer(stream);
    },
  };
}
