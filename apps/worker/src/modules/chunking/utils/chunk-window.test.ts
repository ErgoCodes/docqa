import { describe, expect, it } from 'vitest';
import type { TokenSpan } from './tokenizer.js';
import {
  DEFAULT_CHUNK_OVERLAP_TOKENS,
  DEFAULT_CHUNK_SIZE_TOKENS,
  windowTokenSpans,
} from './chunk-window.js';

function createSyntheticSpans(count: number, tokenLength = 4, gapLength = 1): { spans: TokenSpan[]; textLength: number } {
  const spans: TokenSpan[] = [];
  let currentPos = 0;
  for (let i = 0; i < count; i++) {
    const start = currentPos;
    const end = start + tokenLength;
    spans.push({
      text: `w${i}`,
      start,
      end,
    });
    currentPos = end + gapLength;
  }
  const lastSpan = spans[count - 1];
  const textLength = lastSpan ? lastSpan.end + gapLength : 0;
  return { spans, textLength };
}

describe('windowTokenSpans', () => {
  it('devuelve array vacío cuando N=0 spans', () => {
    const result = windowTokenSpans([], 0, {
      chunkSizeTokens: 800,
      chunkOverlapTokens: 100,
    });

    expect(result).toEqual([]);
  });

  it('produce exactamente 1 ventana cuando N es menor que chunkSizeTokens', () => {
    const { spans, textLength } = createSyntheticSpans(5);
    const result = windowTokenSpans(spans, textLength, {
      chunkSizeTokens: 800,
      chunkOverlapTokens: 100,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.spans).toEqual(spans);
    expect(result[0]?.charStart).toBe(0);
    expect(result[0]?.charEnd).toBe(textLength);
  });

  it('produce exactamente 1 ventana cuando N es exactamente igual a chunkSizeTokens', () => {
    const { spans, textLength } = createSyntheticSpans(8);
    const result = windowTokenSpans(spans, textLength, {
      chunkSizeTokens: 8,
      chunkOverlapTokens: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.spans).toEqual(spans);
    expect(result[0]?.spans).toHaveLength(8);
    expect(result[0]?.charStart).toBe(0);
    expect(result[0]?.charEnd).toBe(textLength);
  });

  it('verifica la matemática exacta del solapamiento con overlap real y varias ventanas', () => {
    const { spans, textLength } = createSyntheticSpans(10);
    const result = windowTokenSpans(spans, textLength, {
      chunkSizeTokens: 4,
      chunkOverlapTokens: 1,
    });

    expect(result).toHaveLength(3);

    expect(result[0]?.spans).toEqual(spans.slice(0, 4));
    expect(result[1]?.spans).toEqual(spans.slice(3, 7));
    expect(result[2]?.spans).toEqual(spans.slice(6, 10));

    expect(result[0]?.spans.slice(-1)).toEqual(result[1]?.spans.slice(0, 1));
    expect(result[1]?.spans.slice(-1)).toEqual(result[2]?.spans.slice(0, 1));
  });

  it('genera 3 ventanas de tamaños 800, 800 y 600 para N=2000 con los defaults del sistema', () => {
    const { spans, textLength } = createSyntheticSpans(2000);
    const result = windowTokenSpans(spans, textLength, {
      chunkSizeTokens: DEFAULT_CHUNK_SIZE_TOKENS,
      chunkOverlapTokens: DEFAULT_CHUNK_OVERLAP_TOKENS,
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.spans).toHaveLength(800);
    expect(result[1]?.spans).toHaveLength(800);
    expect(result[2]?.spans).toHaveLength(600);

    expect(result[0]?.spans[0]?.text).toBe('w0');
    expect(result[0]?.spans[799]?.text).toBe('w799');

    expect(result[1]?.spans[0]?.text).toBe('w700');
    expect(result[1]?.spans[799]?.text).toBe('w1499');

    expect(result[2]?.spans[0]?.text).toBe('w1400');
    expect(result[2]?.spans[599]?.text).toBe('w1999');
  });

  it('genera 2 ventanas de tamaños 800 y 101 para N=801 con los defaults del sistema', () => {
    const { spans, textLength } = createSyntheticSpans(801);
    const result = windowTokenSpans(spans, textLength, {
      chunkSizeTokens: DEFAULT_CHUNK_SIZE_TOKENS,
      chunkOverlapTokens: DEFAULT_CHUNK_OVERLAP_TOKENS,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.spans).toHaveLength(800);
    expect(result[1]?.spans).toHaveLength(101);

    expect(result[0]?.spans[0]?.text).toBe('w0');
    expect(result[0]?.spans[799]?.text).toBe('w799');

    expect(result[1]?.spans[0]?.text).toBe('w700');
    expect(result[1]?.spans[100]?.text).toBe('w800');
  });

  it('calcula charStart y charEnd extendiendo hasta el inicio del siguiente token o el fin del texto', () => {
    const spans: TokenSpan[] = [
      { text: 'hola', start: 0, end: 4 },
      { text: 'mundo', start: 7, end: 12 },
      { text: 'nuevo', start: 16, end: 21 },
    ];
    const textLength = 26;

    const result = windowTokenSpans(spans, textLength, {
      chunkSizeTokens: 1,
      chunkOverlapTokens: 0,
    });

    expect(result).toHaveLength(3);

    expect(result[0]?.charStart).toBe(0);
    expect(result[0]?.charEnd).toBe(7);

    expect(result[1]?.charStart).toBe(7);
    expect(result[1]?.charEnd).toBe(16);

    expect(result[2]?.charStart).toBe(16);
    expect(result[2]?.charEnd).toBe(26);
  });

  it('lanza error si chunkSizeTokens es menor o igual a 0 o no es entero', () => {
    const { spans, textLength } = createSyntheticSpans(5);

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 0, chunkOverlapTokens: 0 }),
    ).toThrow('chunkSizeTokens must be a positive integer');

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: -5, chunkOverlapTokens: 0 }),
    ).toThrow('chunkSizeTokens must be a positive integer');

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 3.5, chunkOverlapTokens: 0 }),
    ).toThrow('chunkSizeTokens must be a positive integer');
  });

  it('lanza error si chunkOverlapTokens es negativo o no es entero', () => {
    const { spans, textLength } = createSyntheticSpans(5);

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 10, chunkOverlapTokens: -1 }),
    ).toThrow('chunkOverlapTokens must be a non-negative integer smaller than chunkSizeTokens');

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 10, chunkOverlapTokens: 2.5 }),
    ).toThrow('chunkOverlapTokens must be a non-negative integer smaller than chunkSizeTokens');
  });

  it('lanza error si chunkOverlapTokens >= chunkSizeTokens pero permite chunkSizeTokens - 1', () => {
    const { spans, textLength } = createSyntheticSpans(5);

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 10, chunkOverlapTokens: 10 }),
    ).toThrow('chunkOverlapTokens must be a non-negative integer smaller than chunkSizeTokens');

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 10, chunkOverlapTokens: 11 }),
    ).toThrow('chunkOverlapTokens must be a non-negative integer smaller than chunkSizeTokens');

    expect(() =>
      windowTokenSpans(spans, textLength, { chunkSizeTokens: 10, chunkOverlapTokens: 9 }),
    ).not.toThrow();
  });
});
