import { MongoClient } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import { connectMongo } from './mongo.js';

describe('connectMongo', () => {
  it('throws informative English error when connection fails', async () => {
    vi.spyOn(MongoClient.prototype, 'connect').mockRejectedValueOnce(new Error('Connection refused'));

    await expect(connectMongo('mongodb://localhost:27017')).rejects.toThrow(
      'Could not connect to MongoDB. Have you run `docker compose up`? (Connection refused)',
    );
  });

  it('returns client and db on successful connection', async () => {
    vi.spyOn(MongoClient.prototype, 'connect').mockResolvedValueOnce({} as unknown as MongoClient);

    const connection = await connectMongo('mongodb://localhost:27017/test-db');
    expect(connection.client).toBeDefined();
    expect(connection.db).toBeDefined();
    await connection.client.close();
  });
});
