import type { TokenSpan } from './tokenizer.js';

export const DEFAULT_CHUNK_SIZE_TOKENS = 800;
export const DEFAULT_CHUNK_OVERLAP_TOKENS = 100;

export interface ChunkingOptions {
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
}

export interface ChunkWindow {
  spans: TokenSpan[];
  charStart: number;
  charEnd: number;
}

export function windowTokenSpans(
  spans: TokenSpan[],
  textLength: number,
  options: ChunkingOptions,
): ChunkWindow[] {
  const { chunkSizeTokens, chunkOverlapTokens } = options;

  if (!Number.isInteger(chunkSizeTokens) || chunkSizeTokens <= 0) {
    throw new Error('chunkSizeTokens must be a positive integer');
  }
  if (!Number.isInteger(chunkOverlapTokens) || chunkOverlapTokens < 0 || chunkOverlapTokens >= chunkSizeTokens) {
    throw new Error('chunkOverlapTokens must be a non-negative integer smaller than chunkSizeTokens');
  }

  const total = spans.length;
  if (total === 0) {
    return [];
  }

  const step = chunkSizeTokens - chunkOverlapTokens;
  const windows: ChunkWindow[] = [];
  let start = 0;

  while (start < total) {
    const end = Math.min(start + chunkSizeTokens, total);
    const windowSpans = spans.slice(start, end);
    const firstSpan = windowSpans[0];
    if (!firstSpan) {
      throw new Error('unreachable: window slice must contain at least one span');
    }

    const charStart = firstSpan.start;
    // Extends charEnd to the start of the next token (or text length if last window) to preserve punctuation and whitespace following the final token.
    const nextSpan = spans[end];
    const charEnd = nextSpan ? nextSpan.start : textLength;

    windows.push({ spans: windowSpans, charStart, charEnd });

    if (end === total) {
      break;
    }
    start += step;
  }

  return windows;
}
