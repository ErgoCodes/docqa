import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureIndexes } from '../../../db/indexes.js';
import { createInMemoryDocumentRepository } from '../../../testing/fakes.js';
import type { DocumentRepository } from '../interfaces/document.repository.js';
import type { NewDocument } from '../types/document.js';
import { createMongoDocumentRepository } from './mongo-document.repository.js';

function newDocumentInput(overrides: Partial<NewDocument> = {}): NewDocument {
  const now = new Date();
  return {
    userId: new ObjectId().toHexString(),
    title: 'test-document',
    storageKey: `${randomUUID()}/test.pdf`,
    pages: 3,
    status: 'processing',
    error: null,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Suite única ejecutada contra cada implementación de DocumentRepository, para
 * asegurar que el aislamiento por usuario (RNF-01) y la persistencia se comporten
 * exactamente igual en memoria y en Mongo real.
 */
function describeDocumentRepositoryContract(name: string, createRepository: () => DocumentRepository): void {
  describe(`DocumentRepository (${name})`, () => {
    let repository: DocumentRepository;

    beforeAll(() => {
      repository = createRepository();
    });

    it('inserta un documento y lo recupera por findById con su userId', async () => {
      const input = newDocumentInput({ title: 'informe' });
      const doc = await repository.insert(input);

      expect(doc.id).toBeDefined();
      expect(doc.userId).toBe(input.userId);
      expect(doc.title).toBe('informe');
      expect(doc.pages).toBe(3);
      expect(doc.status).toBe('processing');

      const found = await repository.findById(doc.id, input.userId);
      expect(found).toEqual(doc);
    });

    it('RNF-01: findById devuelve null si el documento pertenece a otro usuario', async () => {
      const userA = new ObjectId().toHexString();
      const userB = new ObjectId().toHexString();

      const docUserA = await repository.insert(newDocumentInput({ userId: userA, title: 'privado-a' }));

      // El usuario B intenta acceder al documento del usuario A
      const foundByUserB = await repository.findById(docUserA.id, userB);
      expect(foundByUserB).toBeNull();
    });

    it('findById devuelve null para un id que no existe', async () => {
      const userId = new ObjectId().toHexString();
      const nonExistentId = new ObjectId().toHexString();

      expect(await repository.findById(nonExistentId, userId)).toBeNull();
    });

    it('findAllByUser devuelve solo los documentos del usuario ordenados por createdAt descendente', async () => {
      const userX = new ObjectId().toHexString();
      const userY = new ObjectId().toHexString();

      const t1 = new Date('2026-09-01T10:00:00Z');
      const t2 = new Date('2026-09-02T10:00:00Z');
      const t3 = new Date('2026-09-03T10:00:00Z');

      const doc1 = await repository.insert(newDocumentInput({ userId: userX, title: 'doc-antiguo', createdAt: t1 }));
      const doc2 = await repository.insert(newDocumentInput({ userId: userX, title: 'doc-reciente', createdAt: t3 }));
      const doc3 = await repository.insert(newDocumentInput({ userId: userX, title: 'doc-medio', createdAt: t2 }));
      const docAjeno = await repository.insert(newDocumentInput({ userId: userY, title: 'doc-ajeno', createdAt: t2 }));

      const resultsX = await repository.findAllByUser(userX);

      expect(resultsX).toHaveLength(3);
      expect(resultsX[0]?.id).toBe(doc2.id);
      expect(resultsX[1]?.id).toBe(doc3.id);
      expect(resultsX[2]?.id).toBe(doc1.id);

      // RNF-01: el documento de userY no aparece en los resultados de userX
      expect(resultsX.map((d) => d.id)).not.toContain(docAjeno.id);

      const resultsY = await repository.findAllByUser(userY);
      expect(resultsY).toHaveLength(1);
      expect(resultsY[0]?.id).toBe(docAjeno.id);
    });

    it('findAllByUser devuelve array vacío si el usuario no tiene documentos', async () => {
      const randomUser = new ObjectId().toHexString();
      expect(await repository.findAllByUser(randomUser)).toEqual([]);
    });
  });
}

describeDocumentRepositoryContract('en memoria', createInMemoryDocumentRepository);

describe.skipIf(!process.env.MONGODB_TEST_URI)('integración con MongoDB (DocumentRepository)', () => {
  let client: MongoClient;
  let db: Db;
  const testDbName = `docqa-test-docs-${randomUUID()}`;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describeDocumentRepositoryContract('mongodb', () => createMongoDocumentRepository(db));
});
