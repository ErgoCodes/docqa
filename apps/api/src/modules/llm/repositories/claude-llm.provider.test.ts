import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClaudeLlmProvider } from './claude-llm.provider.js';

describe('createClaudeLlmProvider', () => {
  const apiKey = 'test-claude-key';
  const model = 'claude-haiku-4-5';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates response with expected headers, url, and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'This is the answer from Claude.' }],
          model,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createClaudeLlmProvider({ apiKey, model });
    const result = await provider.generate({
      system: 'You are an assistant.',
      user: 'What is the answer?',
    });

    expect(result).toBe('This is the answer from Claude.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: 'You are an assistant.',
        messages: [{ role: 'user', content: 'What is the answer?' }],
      }),
    });
  });

  it('supports custom maxTokens option', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Short answer' }],
          model,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createClaudeLlmProvider({ apiKey, model, maxTokens: 2048 });
    await provider.generate({
      system: 'System prompt',
      user: 'User prompt',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: 'System prompt',
          messages: [{ role: 'user', content: 'User prompt' }],
        }),
      }),
    );
  });

  it('concatenates multiple text blocks in content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'First part. ' },
            { type: 'text', text: 'Second part.' },
          ],
          model,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createClaudeLlmProvider({ apiKey, model });
    const result = await provider.generate({
      system: 'sys',
      user: 'usr',
    });

    expect(result).toBe('First part. Second part.');
  });

  it('returns empty string when content is empty or contains no text blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [],
          model,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createClaudeLlmProvider({ apiKey, model });
    const result = await provider.generate({
      system: 'sys',
      user: 'usr',
    });

    expect(result).toBe('');
  });

  it('throws an error with status and excerpt on non-200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"error":{"type":"authentication_error","message":"invalid x-api-key"}}'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createClaudeLlmProvider({ apiKey, model });
    await expect(
      provider.generate({
        system: 'sys',
        user: 'usr',
      }),
    ).rejects.toThrow(/401.*invalid x-api-key/);
  });
});
