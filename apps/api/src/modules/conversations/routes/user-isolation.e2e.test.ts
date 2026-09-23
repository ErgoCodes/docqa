/* eslint-disable n/no-unsupported-features/node-builtins */
import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppDependencies } from '../../../dependencies.js';
import { buildTestApp } from '../../../testing/build-test-app.js';
import { createInMemoryLlmProvider } from '../../../testing/fakes.js';
import { ensureChunksVectorIndexForTests } from '../../../testing/vector-index.js';
import { createMongoUserRepository } from '../../auth/repositories/mongo-user.repository.js';
import { createMongoChunkReader } from '../../chunks/repositories/mongo-chunk-reader.js';
import { createMongoChunkSearcher, EMBEDDING_DIMENSIONS } from '../../chunks/repositories/mongo-chunk-searcher.js';
import type { EmbeddingsProvider } from '../../embeddings/interfaces/embeddings-provider.js';
import { createMongoDocumentRepository } from '../../documents/repositories/mongo-document.repository.js';
import { NO_CHUNKS_FOUND_MESSAGE } from '../services/conversation.service.js';

interface TestChunkDoc {
  _id: ObjectId;
  documentId: ObjectId;
  userId: ObjectId;
  page: number;
  index: number;
  text: string;
  embedding: number[];
}

interface DocumentResponseBody {
  id: string;
  title: string;
  status: 'processing' | 'ready' | 'error';
  pages: number;
  error: string | null;
  createdAt: string;
}

interface ConversationResponseBody {
  id: string;
  documentIds: string[];
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    citations: Array<{
      chunkId: string;
      documentId: string;
      page: number;
    }>;
    createdAt: string;
  }>;
  createdAt: string;
}

interface MessageResponseBody {
  role: 'user' | 'assistant';
  content: string;
  citations: Array<{
    chunkId: string;
    documentId: string;
    page: number;
  }>;
  createdAt: string;
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

async function buildPdfBuffer(pageCount: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage();
  }
  return Buffer.from(await pdfDoc.save());
}

async function registerUser(
  app: FastifyInstance,
  email: string,
): Promise<{ userId: string; token: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password-segura-123' },
  });
  const body = res.json<{ user: { id: string }; tokens: { accessToken: string } }>();
  return { userId: body.user.id, token: body.tokens.accessToken };
}

async function uploadDocument(
  app: FastifyInstance,
  token: string,
  filename: string,
): Promise<string> {
  const pdfBuffer = await buildPdfBuffer(1);
  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);

  const res = await app.inject({
    method: 'POST',
    url: '/documents',
    headers: { authorization: `Bearer ${token}` },
    payload: form,
  });

  const body = res.json<{ id: string }>();
  return body.id;
}

function hashToken(token: string): number {
  return createHash('sha256').update(token).digest().readUInt32BE(0) % EMBEDDING_DIMENSIONS;
}

function textToVector(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const token of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    const idx = hashToken(token);
    vector[idx] = (vector[idx] ?? 0) + 1;
  }
  return vector.map((value) => value + 0.00001);
}

function createDeterministicEmbeddingsProvider(): EmbeddingsProvider {
  return { embed: (texts: string[]) => Promise.resolve(texts.map(textToVector)) };
}

function unitLikeVector(overrides: Record<number, number> = {}): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.00001);
  vector[0] = 1.00001;
  for (const [index, value] of Object.entries(overrides)) {
    vector[Number(index)] = Number.isInteger(value) ? value + 0.00001 : value;
  }
  return vector;
}

describe.skipIf(!process.env.MONGODB_TEST_URI)('user isolation e2e (RNF-01)', () => {
  const FIXED_LLM_ANSWER = 'The enterprise software segment drove 42% revenue growth in Q3 2026.';
  const SHARED_QUESTION = 'What does the Q3 financial report say about revenue growth this quarter?';
  const secretText =
    'The Q3 2026 financial report shows revenue growth of forty two percent, driven by the enterprise software segment.';
  const controlText = 'control chunk for numCandidates isolation check';

  let client: MongoClient;
  let db: Db;
  let app: FastifyInstance;
  let dependencies: AppDependencies;
  const testDbName = `docqa-test-user-isolation-${randomUUID()}`;

  let tokenA: string;
  let userAId: string;
  let tokenB: string;
  let userBId: string;
  const userCId = new ObjectId();

  let aDocumentId: string;
  let bDocumentId: string;
  const secretChunkId = new ObjectId();
  const controlChunkId = new ObjectId();

  let convoAScopedId: string;
  let convoASharedId: string;
  let convoBSharedId: string;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_TEST_URI ?? '');
    await client.connect();
    db = client.db(testDbName);
    await ensureChunksVectorIndexForTests(db);

    const testApp = await buildTestApp({
      dependencies: {
        users: createMongoUserRepository(db),
        documents: createMongoDocumentRepository(db),
        chunkSearcher: createMongoChunkSearcher(db),
        chunkReader: createMongoChunkReader(db),
        embeddingsProvider: createDeterministicEmbeddingsProvider(),
        llmProvider: createInMemoryLlmProvider(FIXED_LLM_ANSWER),
      },
    });
    app = testApp.app;
    dependencies = testApp.dependencies;

    const userA = await registerUser(app, 'user-a-isolation@example.com');
    userAId = userA.userId;
    tokenA = userA.token;

    const userB = await registerUser(app, 'user-b-isolation@example.com');
    userBId = userB.userId;
    tokenB = userB.token;

    aDocumentId = await uploadDocument(app, tokenA, 'financial-report-a.pdf');
    bDocumentId = await uploadDocument(app, tokenB, 'financial-report-b.pdf');

    const secretChunkDoc: TestChunkDoc = {
      _id: secretChunkId,
      documentId: new ObjectId(aDocumentId),
      userId: new ObjectId(userAId),
      page: 1,
      index: 0,
      text: secretText,
      embedding: textToVector(secretText),
    };

    const controlChunkDoc: TestChunkDoc = {
      _id: controlChunkId,
      documentId: new ObjectId(aDocumentId),
      userId: new ObjectId(userAId),
      page: 1,
      index: 1,
      text: controlText,
      embedding: unitLikeVector({ 100: 5 }),
    };

    const decoyChunks: TestChunkDoc[] = Array.from({ length: 200 }, (_, i) => ({
      _id: new ObjectId(),
      documentId: new ObjectId(),
      userId: userCId,
      page: 1,
      index: i,
      text: `userC decoy chunk ${i}`,
      embedding: unitLikeVector({ 1: 0.001 * (i + 1) }),
    }));

    await db.collection<TestChunkDoc>('chunks').insertMany([
      secretChunkDoc,
      controlChunkDoc,
      ...decoyChunks,
    ]);

    const startTime = Date.now();
    while (Date.now() - startTime < 45_000) {
      const probeSecret = await dependencies.chunkSearcher.searchSimilar({
        embedding: textToVector(secretText),
        userId: userAId,
      });
      const probeControl = await dependencies.chunkSearcher.searchSimilar({
        embedding: unitLikeVector(),
        userId: userAId,
      });
      const probeDecoys = await dependencies.chunkSearcher.searchSimilar({
        embedding: unitLikeVector(),
        userId: userCId.toHexString(),
      });

      if (
        probeSecret.some((c) => c.id === secretChunkId.toHexString()) &&
        probeControl.some((c) => c.id === controlChunkId.toHexString()) &&
        probeDecoys.length > 0
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const convoAScopedRes = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { documentIds: [aDocumentId] },
    });
    convoAScopedId = convoAScopedRes.json<ConversationResponseBody>().id;

    const convoASharedRes = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { documentIds: [] },
    });
    convoASharedId = convoASharedRes.json<ConversationResponseBody>().id;

    const convoBSharedRes = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { documentIds: [] },
    });
    convoBSharedId = convoBSharedRes.json<ConversationResponseBody>().id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await db?.dropDatabase();
    await client?.close();
  });

  it("B cannot list A's documents", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(200);
    const docs = res.json<DocumentResponseBody[]>();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe(bDocumentId);
    expect(docs.some((doc) => doc.id === aDocumentId)).toBe(false);
  });

  it("B cannot view A's document detail", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/documents/${aDocumentId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it("B cannot delete A's document, which survives intact", async () => {
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/documents/${aDocumentId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(deleteRes.statusCode).toBe(404);
    const deleteBody = deleteRes.json<ErrorResponseBody>();
    expect(deleteBody.error.code).toBe('DOCUMENT_NOT_FOUND');

    const getRes = await app.inject({
      method: 'GET',
      url: `/documents/${aDocumentId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(getRes.statusCode).toBe(200);
    const doc = getRes.json<DocumentResponseBody>();
    expect(doc.id).toBe(aDocumentId);
  });

  it("B cannot retrieve A's chunk by id", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/chunks/${secretChunkId.toHexString()}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CHUNK_NOT_FOUND');
  });

  it("B cannot create a conversation scoped to A's document", async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { documentIds: [aDocumentId] },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CONVERSATION_DOCUMENT_NOT_FOUND');
  });

  it("B cannot read A's conversation", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/conversations/${convoAScopedId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
  });

  it("B cannot send a message into A's conversation", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/conversations/${convoAScopedId}/messages`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { question: 'Attempting cross-tenant access' },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
  });

  it("B does not receive A's chunks in a semantically matching HTTP search, nor A's cached answer", async () => {
    const firstUserARes = await app.inject({
      method: 'POST',
      url: `/conversations/${convoASharedId}/messages`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { question: SHARED_QUESTION },
    });

    expect(firstUserARes.statusCode).toBe(200);
    expect(firstUserARes.headers['x-cache']).toBe('MISS');
    const firstUserAMsg = firstUserARes.json<MessageResponseBody>();
    expect(firstUserAMsg.content).toBe(FIXED_LLM_ANSWER);
    expect(firstUserAMsg.citations).toEqual(
      expect.arrayContaining([
        {
          chunkId: secretChunkId.toHexString(),
          documentId: aDocumentId,
          page: 1,
        },
      ]),
    );

    const secondUserARes = await app.inject({
      method: 'POST',
      url: `/conversations/${convoASharedId}/messages`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { question: SHARED_QUESTION },
    });

    expect(secondUserARes.statusCode).toBe(200);
    expect(secondUserARes.headers['x-cache']).toBe('HIT');
    const secondUserAMsg = secondUserARes.json<MessageResponseBody>();
    expect(secondUserAMsg.content).toBe(FIXED_LLM_ANSWER);
    expect(secondUserAMsg.citations).toEqual(firstUserAMsg.citations);

    const userBRes = await app.inject({
      method: 'POST',
      url: `/conversations/${convoBSharedId}/messages`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { question: SHARED_QUESTION },
    });

    expect(userBRes.statusCode).toBe(200);
    expect(userBRes.headers['x-cache']).toBe('MISS');
    const userBMsg = userBRes.json<MessageResponseBody>();
    expect(userBMsg.content).toBe(NO_CHUNKS_FOUND_MESSAGE);
    expect(userBMsg.citations).toEqual([]);
  });

  it("RNF-01 (low-level): vector search returns nothing for B even with A's real chunk indexed", async () => {
    const results = await dependencies.chunkSearcher.searchSimilar({
      embedding: textToVector(secretText),
      userId: userBId,
    });

    expect(results).toEqual([]);
  });

  it('RNF-01 (numCandidates architecture): A still finds its own chunk despite 200 globally-superior-scoring decoys from another user', async () => {
    const results = await dependencies.chunkSearcher.searchSimilar({
      embedding: unitLikeVector(),
      userId: userAId,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe(controlChunkId.toHexString());
    expect(results.some((c) => c.id === controlChunkId.toHexString())).toBe(true);
    for (const chunk of results) {
      expect(chunk.userId).toBe(userAId);
    }
  });

  it('decoys are real and indexed (sanity control)', async () => {
    const results = await dependencies.chunkSearcher.searchSimilar({
      embedding: unitLikeVector(),
      userId: userCId.toHexString(),
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it('RNF-01 (low-level): B gets nothing even against the decoy-heavy synthetic query vector', async () => {
    const results = await dependencies.chunkSearcher.searchSimilar({
      embedding: unitLikeVector(),
      userId: userBId,
    });

    expect(results).toEqual([]);
  });
});
