/* eslint-disable n/no-unsupported-features/node-builtins -- eslint-plugin-n flags global fetch as experimental until Node 21, but it has been stable and unflagged since Node 18; the monorepo requires Node >=20 (see package.json engines) */
import type { LlmGenerateInput, LlmProvider } from '../interfaces/llm-provider.js';

export interface GroqLlmProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

interface GroqChoice {
  message?: {
    content?: string | null;
  };
}

interface GroqChatCompletionResponse {
  choices?: GroqChoice[];
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 1024;

export function createGroqLlmProvider(config: GroqLlmProviderConfig): LlmProvider {
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    async generate(input: LlmGenerateInput): Promise<string> {
      const response = await globalThis.fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const excerpt = errorText.slice(0, 300);
        throw new Error(`Groq API request failed with status ${response.status}: ${excerpt}`);
      }

      const json = (await response.json()) as GroqChatCompletionResponse;
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}
