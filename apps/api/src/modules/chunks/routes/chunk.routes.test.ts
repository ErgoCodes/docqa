import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../testing/build-test-app.js';
import { createInMemoryChunkReader } from '../../../testing/fakes.js';
import type { Chunk } from '../types/chunk.js';

interface ChunkResponseBody {
  id: string;
  documentId: string;
  page: number;
  index: number;
  text: string;
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

async function registerUser(app: FastifyInstance, email: string): Promise<{ userId: string; accessToken: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password-segura-123' },
  });
  const body = res.json<{ user: { id: string }; tokens: { accessToken: string } }>();
  return { userId: body.user.id, accessToken: body.tokens.accessToken };
}

describe('chunk routes', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects unauthenticated requests to GET /chunks/:id with 401', async () => {
    ({ app } = await buildTestApp());

    const res = await app.inject({
      method: 'GET',
      url: '/chunks/chunk-123',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with the chunk data for the authenticated owner', async () => {
    const memoryChunks: Chunk[] = [];
    const chunkReader = createInMemoryChunkReader(memoryChunks);

    ({ app } = await buildTestApp({ dependencies: { chunkReader } }));

    const user = await registerUser(app, 'owner@example.com');
    const chunk: Chunk = {
      id: 'chunk-1',
      documentId: 'doc-1',
      userId: user.userId,
      page: 4,
      index: 2,
      text: 'This is the cited snippet text.',
    };
    memoryChunks.push(chunk);

    const res = await app.inject({
      method: 'GET',
      url: `/chunks/${chunk.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ChunkResponseBody>();
    expect(body).toEqual({
      id: 'chunk-1',
      documentId: 'doc-1',
      page: 4,
      index: 2,
      text: 'This is the cited snippet text.',
    });
    expect(body).not.toHaveProperty('userId');
  });

  it('returns 404 CHUNK_NOT_FOUND when the chunk does not exist', async () => {
    ({ app } = await buildTestApp());
    const user = await registerUser(app, 'user@example.com');

    const res = await app.inject({
      method: 'GET',
      url: '/chunks/non-existent-chunk',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CHUNK_NOT_FOUND');
  });

  it('RNF-01: returns 404 (not 403) CHUNK_NOT_FOUND when user B requests a chunk belonging to user A', async () => {
    const memoryChunks: Chunk[] = [];
    const chunkReader = createInMemoryChunkReader(memoryChunks);

    ({ app } = await buildTestApp({ dependencies: { chunkReader } }));

    const userA = await registerUser(app, 'userA@example.com');
    const userB = await registerUser(app, 'userB@example.com');

    const chunkOfUserA: Chunk = {
      id: 'chunk-user-a',
      documentId: 'doc-user-a',
      userId: userA.userId,
      page: 1,
      index: 0,
      text: 'Secret chunk belonging only to user A',
    };
    memoryChunks.push(chunkOfUserA);

    const res = await app.inject({
      method: 'GET',
      url: `/chunks/${chunkOfUserA.id}`,
      headers: { authorization: `Bearer ${userB.accessToken}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponseBody>();
    expect(body.error.code).toBe('CHUNK_NOT_FOUND');
  });
});
