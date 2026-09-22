import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoyageEmbeddingsProvider } from './voyage-embeddings.provider.js';

describe('createVoyageEmbeddingsProvider', () => {
  const apiKey = 'test-voyage-key';
  const model = 'voyage-3-lite';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('embeds a single batch with expected headers, url, and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          object: 'list',
          data: [
            { object: 'embedding', embedding: [0.1, 0.2], index: 0 },
            { object: 'embedding', embedding: [0.3, 0.4], index: 1 },
          ],
          model,
          usage: { total_tokens: 10 },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingsProvider({ apiKey, model });
    const result = await provider.embed(['first query', 'second query']);

    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: ['first query', 'second query'],
        model,
        input_type: 'query',
      }),
    });
  });

  it('handles multiple batches and preserves global order across batches', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const parsedBody = JSON.parse(init.body as string) as { input: string[] };
      const data = parsedBody.input.map((text, idx) => ({
        object: 'embedding',
        embedding: [text.length],
        index: idx,
      }));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ object: 'list', data, model }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingsProvider({ apiKey, model, batchSize: 2 });
    const result = await provider.embed(['one', 'two', 'three', 'four', 'five']);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual([[3], [3], [5], [4], [4]]);
  });

  it('rejects if any batch fails', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 2) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            object: 'list',
            data: [{ object: 'embedding', embedding: [0.1], index: 0 }],
            model,
          }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingsProvider({ apiKey, model, batchSize: 1 });
    await expect(provider.embed(['first', 'second'])).rejects.toThrow();
  });

  it('includes status code in error message on non-200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingsProvider({ apiKey, model });
    await expect(provider.embed(['text'])).rejects.toThrow(/429/);
  });

  it('returns empty array and does not invoke fetch when texts array is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingsProvider({ apiKey, model });
    const result = await provider.embed([]);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sorts data by index before returning embeddings to handle out-of-order response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          object: 'list',
          data: [
            { object: 'embedding', embedding: [3], index: 2 },
            { object: 'embedding', embedding: [1], index: 0 },
            { object: 'embedding', embedding: [2], index: 1 },
          ],
          model,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingsProvider({ apiKey, model });
    const result = await provider.embed(['a', 'b', 'c']);

    expect(result).toEqual([[1], [2], [3]]);
  });
});
