import { describe, expect, it } from 'vitest';
import { buildCacheKey } from './cache-key.js';

describe('buildCacheKey', () => {
  it('returns a 64-character hex string for valid inputs', () => {
    const key = buildCacheKey({
      userId: 'user-123',
      documentIds: ['doc-a', 'doc-b'],
      question: 'What is the summary?',
      generation: 0,
    });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the exact same key for identical inputs', () => {
    const input = {
      userId: 'user-1',
      documentIds: ['doc-1', 'doc-2'],
      question: 'How does caching work?',
      generation: 0,
    };

    expect(buildCacheKey(input)).toBe(buildCacheKey(input));
  });

  it('produces the same key regardless of the order of documentIds', () => {
    const key1 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-z', 'doc-a', 'doc-m'],
      question: 'explain the topic',
      generation: 0,
    });

    const key2 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-a', 'doc-m', 'doc-z'],
      question: 'explain the topic',
      generation: 0,
    });

    expect(key1).toBe(key2);
  });

  it('normalizes question by trimming, lowercasing, and collapsing multiple spaces', () => {
    const keyCanonical = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'what is rag architecture?',
      generation: 0,
    });

    const keyVariants = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: '   WHAT   is   RAG   architecture?   ',
      generation: 0,
    });

    expect(keyVariants).toBe(keyCanonical);
  });

  it('produces different keys for different userIds', () => {
    const keyUser1 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'same question',
      generation: 0,
    });

    const keyUser2 = buildCacheKey({
      userId: 'user-2',
      documentIds: ['doc-1'],
      question: 'same question',
      generation: 0,
    });

    expect(keyUser1).not.toBe(keyUser2);
  });

  it('produces different keys for different generations (invalidation)', () => {
    const keyGen0 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'same question',
      generation: 0,
    });

    const keyGen1 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'same question',
      generation: 1,
    });

    expect(keyGen0).not.toBe(keyGen1);
  });

  it('produces different keys for different documentIds', () => {
    const keyDocsA = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'same question',
      generation: 0,
    });

    const keyDocsB = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-2'],
      question: 'same question',
      generation: 0,
    });

    expect(keyDocsA).not.toBe(keyDocsB);
  });

  it('produces different keys for different questions', () => {
    const keyQ1 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'question one',
      generation: 0,
    });

    const keyQ2 = buildCacheKey({
      userId: 'user-1',
      documentIds: ['doc-1'],
      question: 'question two',
      generation: 0,
    });

    expect(keyQ1).not.toBe(keyQ2);
  });

  it('handles empty documentIds correctly', () => {
    const key = buildCacheKey({
      userId: 'user-1',
      documentIds: [],
      question: 'all docs question',
      generation: 0,
    });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
