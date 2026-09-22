/* eslint-disable n/no-unsupported-features/node-builtins */
import type { FastifyInstance } from 'fastify';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../testing/build-test-app.js';
import { createInMemoryChunkSearcher, createInMemoryLlmProvider } from '../../../testing/fakes.js';

interface ConversationResponseBody {
  id: string;
  documentIds: string[];
  messages: MessageResponseBody[];
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

async function registerAndGetToken(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password-segura-123' },
  });
  const body = res.json<{ tokens: { accessToken: string } }>();
  return body.tokens.accessToken;
}

async function uploadDocument(app: FastifyInstance, token: string, filename: string): Promise<string> {
  const pdfBuffer = await buildPdfBuffer(1);
  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);

  const uploadRes = await app.inject({
    method: 'POST',
    url: '/documents',
    headers: { authorization: `Bearer ${token}` },
    payload: form,
  });

  const body = uploadRes.json<{ id: string }>();
  return body.id;
}

describe('conversation routes', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects unauthenticated requests to POST /conversations with 401', async () => {
    ({ app } = await buildTestApp());

    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
    });

    expect(res.statusCode).toBe(401);
  });

  it('creates conversation with empty body and defaults to empty documentIds and messages', async () => {
    ({ app } = await buildTestApp());
    const token = await registerAndGetToken(app, 'user1@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ConversationResponseBody>();
    expect(body.id).toBeDefined();
    expect(body.documentIds).toEqual([]);
    expect(body.messages).toEqual([]);
    expect(body.createdAt).toBeDefined();
  });

  it('creates conversation with valid documentIds referencing uploaded documents', async () => {
    ({ app } = await buildTestApp());
    const token = await registerAndGetToken(app, 'user2@example.com');

    const docId = await uploadDocument(app, token, 'manual.pdf');

    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${token}` },
      payload: { documentIds: [docId] },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ConversationResponseBody>();
    expect(body.id).toBeDefined();
    expect(body.documentIds).toEqual([docId]);
    expect(body.messages).toEqual([]);
    expect(body.createdAt).toBeDefined();
  });

  it('RNF-01: returns 404 CONVERSATION_DOCUMENT_NOT_FOUND when user B references a document of user A', async () => {
    ({ app } = await buildTestApp());
    const tokenUserA = await registerAndGetToken(app, 'userA@example.com');
    const tokenUserB = await registerAndGetToken(app, 'userB@example.com');

    const docUserAId = await uploadDocument(app, tokenUserA, 'private-doc-a.pdf');

    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${tokenUserB}` },
      payload: { documentIds: [docUserAId] },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CONVERSATION_DOCUMENT_NOT_FOUND');
  });

  describe('GET /conversations/:id', () => {
    it('rejects unauthenticated requests with 401', async () => {
      ({ app } = await buildTestApp());

      const res = await app.inject({
        method: 'GET',
        url: '/conversations/conv-123',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns conversation with full history (messages and citations)', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          userId: 'mock-user',
          page: 1,
          index: 0,
          text: 'Chunk content.',
          score: 0.9,
        },
      ];

      ({ app } = await buildTestApp({
        dependencies: {
          chunkSearcher: createInMemoryChunkSearcher(mockChunks),
          llmProvider: createInMemoryLlmProvider('Assistant response text.'),
        },
      }));

      const token = await registerAndGetToken(app, 'history-user@example.com');

      const createRes = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      const createdConv = createRes.json<ConversationResponseBody>();

      await app.inject({
        method: 'POST',
        url: `/conversations/${createdConv.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'What is in the document?' },
      });

      const getRes = await app.inject({
        method: 'GET',
        url: `/conversations/${createdConv.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(getRes.statusCode).toBe(200);
      const conversation = getRes.json<ConversationResponseBody>();
      expect(conversation.id).toBe(createdConv.id);
      expect(conversation.documentIds).toEqual([]);
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0]).toMatchObject({
        role: 'user',
        content: 'What is in the document?',
        citations: [],
      });
      expect(conversation.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Assistant response text.',
        citations: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            page: 1,
          },
        ],
      });
      expect(conversation.createdAt).toBeDefined();
    });

    it('RNF-01: returns 404 CONVERSATION_NOT_FOUND when user B requests conversation of user A', async () => {
      ({ app } = await buildTestApp());
      const tokenUserA = await registerAndGetToken(app, 'owner-get@example.com');
      const tokenUserB = await registerAndGetToken(app, 'intruder-get@example.com');

      const createRes = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { authorization: `Bearer ${tokenUserA}` },
        payload: {},
      });
      const conv = createRes.json<ConversationResponseBody>();

      const res = await app.inject({
        method: 'GET',
        url: `/conversations/${conv.id}`,
        headers: { authorization: `Bearer ${tokenUserB}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponseBody>();
      expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('returns 404 CONVERSATION_NOT_FOUND when conversation does not exist', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'user-notfound-get@example.com');

      const res = await app.inject({
        method: 'GET',
        url: '/conversations/non-existent-conv-id',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponseBody>();
      expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('rejects unauthenticated requests with 401', async () => {
      ({ app } = await buildTestApp());

      const res = await app.inject({
        method: 'POST',
        url: '/conversations/conv-123/messages',
        payload: { question: 'What is this about?' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects invalid body payload with 400', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'user-body@example.com');

      const createRes = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      const conv = createRes.json<ConversationResponseBody>();

      const res = await app.inject({
        method: 'POST',
        url: `/conversations/${conv.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { question: '   ' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('successfully sends message, returns assistant response with X-Cache: MISS header', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          userId: 'mock-user',
          page: 1,
          index: 0,
          text: 'Chunk content.',
          score: 0.9,
        },
      ];

      ({ app } = await buildTestApp({
        dependencies: {
          chunkSearcher: createInMemoryChunkSearcher(mockChunks),
          llmProvider: createInMemoryLlmProvider('Generated assistant answer based on chunk.'),
        },
      }));

      const token = await registerAndGetToken(app, 'user-chat@example.com');

      const createRes = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      const conv = createRes.json<ConversationResponseBody>();

      const res = await app.inject({
        method: 'POST',
        url: `/conversations/${conv.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'Explain the topic' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-cache']).toBe('MISS');

      const message = res.json<MessageResponseBody>();
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Generated assistant answer based on chunk.');
      expect(message.citations).toEqual([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          page: 1,
        },
      ]);
      expect(message.createdAt).toBeDefined();
    });

    it('RNF-01: returns 404 CONVERSATION_NOT_FOUND when user B sends a message to conversation of user A', async () => {
      ({ app } = await buildTestApp());
      const tokenUserA = await registerAndGetToken(app, 'owner@example.com');
      const tokenUserB = await registerAndGetToken(app, 'intruder@example.com');

      const createRes = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { authorization: `Bearer ${tokenUserA}` },
        payload: {},
      });
      const conv = createRes.json<ConversationResponseBody>();

      const res = await app.inject({
        method: 'POST',
        url: `/conversations/${conv.id}/messages`,
        headers: { authorization: `Bearer ${tokenUserB}` },
        payload: { question: 'Can I see your conversation?' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponseBody>();
      expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('returns 404 CONVERSATION_NOT_FOUND when conversation does not exist', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'user-notfound@example.com');

      const res = await app.inject({
        method: 'POST',
        url: '/conversations/non-existent-conv/messages',
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'Hello?' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<ErrorResponseBody>();
      expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });
});
