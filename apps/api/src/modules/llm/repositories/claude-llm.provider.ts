/* eslint-disable n/no-unsupported-features/node-builtins -- eslint-plugin-n flags global fetch as experimental until Node 21, but it has been stable and unflagged since Node 18; the monorepo requires Node >=20 (see package.json engines) */
import type { LlmGenerateInput, LlmProvider } from '../interfaces/llm-provider.js';

export interface ClaudeLlmProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: string; text?: string }>;
  model: string;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 1024;

export function createClaudeLlmProvider(config: ClaudeLlmProviderConfig): LlmProvider {
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    async generate(input: LlmGenerateInput): Promise<string> {
      const response = await globalThis.fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxTokens,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const excerpt = errorText.slice(0, 300);
        throw new Error(`Claude API request failed with status ${response.status}: ${excerpt}`);
      }

      const json = (await response.json()) as AnthropicMessageResponse;
      return (json.content ?? [])
        .filter(
          (block): block is AnthropicTextBlock =>
            block.type === 'text' && typeof block.text === 'string',
        )
        .map((block) => block.text)
        .join('');
    },
  };
}
