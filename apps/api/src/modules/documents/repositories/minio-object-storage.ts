import type { Client } from 'minio';
import type { ObjectStorage } from '../interfaces/object-storage.js';

export function createMinioObjectStorage(client: Client, bucket: string): ObjectStorage {
  return {
    putObject: async (key: string, data: Buffer, contentType: string): Promise<void> => {
      await client.putObject(bucket, key, data, data.length, {
        'Content-Type': contentType,
      });
    },

    // MinIO does not throw when removing a key that no longer exists, which
    // makes retrying a failed document deletion safe.
    deleteObject: async (key: string): Promise<void> => {
      await client.removeObject(bucket, key);
    },
  };
}
