/* eslint-disable n/no-unsupported-features/node-builtins -- eslint-plugin-n flags global fetch as experimental until Node 21, but it has been stable and unflagged since Node 18; the monorepo requires Node >=20 (see package.json engines) */
import type { EmbeddingsProvider } from '../interfaces/embeddings-provider.js';
import { toBatches } from '../utils/batch.js';

export interface VoyageEmbeddingsProviderConfig {
  apiKey: string;
  model: string;
  batchSize?: number;
}

interface VoyageEmbeddingItem {
  object: string;
  embedding: number[];
  index: number;
}

interface VoyageEmbeddingsResponse {
  object: string;
  data: VoyageEmbeddingItem[];
  model: string;
  usage?: {
    total_tokens: number;
  };
}

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const DEFAULT_BATCH_SIZE = 128;

export function createVoyageEmbeddingsProvider(
  config: VoyageEmbeddingsProviderConfig,
): EmbeddingsProvider {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) {
        return [];
      }

      const batches = toBatches(texts, batchSize);

      const batchResults = await Promise.all(
        batches.map(async (batch) => {
          const response = await globalThis.fetch(VOYAGE_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              input: batch,
              model: config.model,
              // Voyage's embedding models are asymmetric: the worker embeds the document corpus with input_type: 'document' when indexing chunks, while this API-side provider only ever embeds the user's search question, so it must use input_type: 'query' for retrieval quality.
              input_type: 'query',
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            const excerpt = errorText.slice(0, 300);
            throw new Error(`Voyage API request failed with status ${response.status}: ${excerpt}`);
          }

          const json = (await response.json()) as VoyageEmbeddingsResponse;
          const sorted = [...json.data].sort((a, b) => a.index - b.index);
          return sorted.map((item) => item.embedding);
        }),
      );

      return batchResults.flat();
    },
  };
}
