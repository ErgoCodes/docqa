import { describe, expect, it } from 'vitest';
import { chunkIdParamsSchema, chunkResponseSchema } from './chunk.schemas.js';

describe('chunkResponseSchema', () => {
  it('parses valid chunk data and strips extra fields like embedding and userId', () => {
    const rawChunk = {
      id: 'chunk-123',
      documentId: 'doc-456',
      userId: 'user-789',
      page: 3,
      index: 1,
      text: 'Sample chunk content for citations',
      embedding: [0.1, 0.2, 0.3],
      extraField: 'should-be-stripped',
    };

    const parsed = chunkResponseSchema.parse(rawChunk);

    expect(parsed).toEqual({
      id: 'chunk-123',
      documentId: 'doc-456',
      page: 3,
      index: 1,
      text: 'Sample chunk content for citations',
    });
    expect(parsed).not.toHaveProperty('embedding');
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('extraField');
  });

  it('rejects chunk when required fields are missing or invalid', () => {
    expect(() => chunkResponseSchema.parse({ id: '1', documentId: '2', page: -1, index: 0, text: '' })).toThrow();
    expect(() => chunkResponseSchema.parse({ id: '1', documentId: '2', page: 1, index: 'not-a-number', text: '' })).toThrow();
  });
});

describe('chunkIdParamsSchema', () => {
  it('accepts valid id string', () => {
    expect(chunkIdParamsSchema.parse({ id: 'chunk-123' })).toEqual({ id: 'chunk-123' });
  });

  it('rejects empty id or extra properties', () => {
    expect(() => chunkIdParamsSchema.parse({ id: '' })).toThrow();
    expect(() => chunkIdParamsSchema.parse({ id: 'chunk-123', extra: 'bad' })).toThrow();
  });
});
