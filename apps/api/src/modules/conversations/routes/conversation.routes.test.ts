/* eslint-disable n/no-unsupported-features/node-builtins */
import type { FastifyInstance } from 'fastify';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../testing/build-test-app.js';

interface ConversationResponseBody {
  id: string;
  documentIds: string[];
  messages: unknown[];
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
});
