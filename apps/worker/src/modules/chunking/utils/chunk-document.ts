import type { ExtractedPage } from '../../extraction/types/extracted-page.js';
import type { DocumentChunk } from '../types/chunk.js';
import { tokenize } from './tokenizer.js';
import {
  windowTokenSpans,
  DEFAULT_CHUNK_SIZE_TOKENS,
  DEFAULT_CHUNK_OVERLAP_TOKENS,
  type ChunkingOptions,
} from './chunk-window.js';

export function chunkDocument(
  pages: ExtractedPage[],
  documentId: string,
  userId: string,
  options: Partial<ChunkingOptions> = {},
): DocumentChunk[] {
  const chunkSizeTokens = options.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE_TOKENS;
  const chunkOverlapTokens = options.chunkOverlapTokens ?? DEFAULT_CHUNK_OVERLAP_TOKENS;

  // ExtractedPage[] does not guarantee order; sorting by page ensures deterministic chunk indexing regardless of input order.
  const sortedPages = [...pages].sort((a, b) => a.page - b.page);

  const chunks: DocumentChunk[] = [];
  let index = 0;

  for (const page of sortedPages) {
    const spans = tokenize(page.text);
    const windows = windowTokenSpans(spans, page.text.length, { chunkSizeTokens, chunkOverlapTokens });

    for (const window of windows) {
      chunks.push({
        documentId,
        userId,
        page: page.page,
        index: index++,
        text: page.text.substring(window.charStart, window.charEnd).trimEnd(),
      });
    }
  }

  return chunks;
}
