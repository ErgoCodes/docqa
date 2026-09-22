import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInMemoryDocumentRepository } from '../../../testing/fakes.js';
import type { DocumentRepository } from '../interfaces/document.repository.js';
import type { Document } from '../types/document.js';
import { createMongoDocumentRepository } from './mongo-document.repository.js';

function createFixtureDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: new ObjectId().toHexString(),
    userId: new ObjectId().toHexString(),
    title: 'test-document.pdf',
    storageKey: `${randomUUID()}/test.pdf`,
    pages: 3,
    status: 'processing',
    error: null,
    createdAt: new Date(),
    ...overrides,
  };
}

type RepositoryFactory = (seed?: Document) => Promise<DocumentRepository> | DocumentRepository;

function describeDocumentRepositoryContract(name: string, createRepository: RepositoryFactory): void {
  describe(`DocumentRepository (${name})`, () => {
    it('findById returns the seeded document', async () => {
      const fixture = createFixtureDocument();
      const repository = await createRepository(fixture);

      const found = await repository.findById(fixture.id);
      expect(found).toEqual(fixture);
    });

    it('findById returns null for a non-existent id', async () => {
      const repository = await createRepository();
      const nonExistentId = new ObjectId().toHexString();

      expect(await repository.findById(nonExistentId)).toBeNull();
    });

    it('findById returns null for a malformed id string', async () => {
      const repository = await createRepository();

      expect(await repository.findById('not-a-valid-object-id')).toBeNull();
    });

    it('updateStatus persists error message and clears it back to null when omitted', async () => {
      const fixture = createFixtureDocument({ status: 'processing', error: null });
      const repository = await createRepository(fixture);

      await repository.updateStatus(fixture.id, 'error', 'some message');
      const docAfterError = await repository.findById(fixture.id);
      expect(docAfterError?.status).toBe('error');
      expect(docAfterError?.error).toBe('some message');

      await repository.updateStatus(fixture.id, 'processing');
      const docAfterClear = await repository.findById(fixture.id);
      expect(docAfterClear?.status).toBe('processing');
      expect(docAfterClear?.error).toBeNull();
    });

    it('updateStatus on a non-existent id does not throw', async () => {
      const repository = await createRepository();
      const nonExistentId = new ObjectId().toHexString();

      await expect(repository.updateStatus(nonExistentId, 'ready')).resolves.not.toThrow();
      await expect(repository.updateStatus('malformed-id', 'ready')).resolves.not.toThrow();
    });
  });
}

describeDocumentRepositoryContract('in memory', (seed) => createInMemoryDocumentRepository(seed ? [seed] : []));

describe.skipIf(!process.env.MONGODB_TEST_URI)('integration with MongoDB (DocumentRepository)', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-docs-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describeDocumentRepositoryContract('mongodb', async (seed) => {
    if (seed) {
      await db.collection('documents').insertOne({
        _id: new ObjectId(seed.id),
        userId: new ObjectId(seed.userId),
        title: seed.title,
        storageKey: seed.storageKey,
        pages: seed.pages,
        status: seed.status,
        error: seed.error,
        createdAt: seed.createdAt,
      });
    }
    return createMongoDocumentRepository(db);
  });
});
