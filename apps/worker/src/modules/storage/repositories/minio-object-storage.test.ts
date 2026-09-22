import { Readable } from 'node:stream';
import type { Client } from 'minio';
import { describe, expect, it, vi } from 'vitest';
import { createMinioObjectStorage } from './minio-object-storage.js';

describe('createMinioObjectStorage', () => {
  it('fetches stream from minio client and returns buffer', async () => {
    const mockStream = Readable.from([Buffer.from('pdf payload')]);
    const mockClient = {
      getObject: vi.fn().mockResolvedValue(mockStream),
    } as unknown as Client;

    const storage = createMinioObjectStorage(mockClient, 'test-bucket');
    const result = await storage.getObject('documents/doc-1.pdf');

    expect(mockClient.getObject).toHaveBeenCalledWith('test-bucket', 'documents/doc-1.pdf');
    expect(result.toString('utf-8')).toBe('pdf payload');
  });
});
