import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGroqLlmProvider } from './groq-llm.provider.js';

describe('createGroqLlmProvider', () => {
  const apiKey = 'test-groq-key';
  const model = 'openai/gpt-oss-120b';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates response with expected url, headers and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'This is the answer from Groq.' } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGroqLlmProvider({ apiKey, model });
    const result = await provider.generate({
      system: 'You are an assistant.',
      user: 'What is the answer?',
    });

    expect(result).toBe('This is the answer from Groq.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: 'You are an assistant.' },
          { role: 'user', content: 'What is the answer?' },
        ],
      }),
    });
  });

  it('supports custom maxTokens option', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Short answer' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGroqLlmProvider({ apiKey, model, maxTokens: 2048 });
    await provider.generate({ system: 'System prompt', user: 'User prompt' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'User prompt' },
          ],
        }),
      }),
    );
  });

  it('returns empty string when there are no choices or content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGroqLlmProvider({ apiKey, model });
    const result = await provider.generate({ system: 'sys', user: 'usr' });

    expect(result).toBe('');
  });

  it('throws an error with status and excerpt on non-200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"error":{"message":"invalid api key"}}'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGroqLlmProvider({ apiKey, model });
    await expect(
      provider.generate({
        system: 'sys',
        user: 'usr',
      }),
    ).rejects.toThrow(/401.*invalid api key/);
  });
});
