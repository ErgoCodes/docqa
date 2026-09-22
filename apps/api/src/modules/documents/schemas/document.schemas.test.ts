import { describe, expect, it } from 'vitest';
import { documentIdParamsSchema, documentListResponseSchema, documentResponseSchema } from './document.schemas.js';

describe('documentResponseSchema', () => {
  it('valida y parsea un documento de respuesta correcto descartando campos extras', () => {
    const rawDoc = {
      id: 'doc-123',
      userId: 'user-secret',
      storageKey: 'internal/key.pdf',
      title: 'Mi PDF',
      status: 'processing',
      pages: 12,
      error: null,
      createdAt: new Date(),
    };

    const parsed = documentResponseSchema.parse(rawDoc);

    expect(parsed).toEqual({
      id: 'doc-123',
      title: 'Mi PDF',
      status: 'processing',
      pages: 12,
      error: null,
      createdAt: rawDoc.createdAt,
    });
    expect(parsed).not.toHaveProperty('storageKey');
    expect(parsed).not.toHaveProperty('userId');
  });

  it('rechaza un documento con estado no válido', () => {
    const invalidDoc = {
      id: 'doc-123',
      title: 'Mi PDF',
      status: 'unknown_status',
      pages: 1,
      error: null,
      createdAt: new Date(),
    };

    expect(() => documentResponseSchema.parse(invalidDoc)).toThrow();
  });
});

describe('documentListResponseSchema', () => {
  it('valida un listado de documentos', () => {
    const rawList = [
      {
        id: 'doc-1',
        title: 'Doc 1',
        status: 'ready',
        pages: 5,
        error: null,
        createdAt: new Date(),
      },
    ];

    const parsed = documentListResponseSchema.parse(rawList);
    expect(parsed).toHaveLength(1);
  });
});

describe('documentIdParamsSchema', () => {
  it('valida un id no vacío', () => {
    expect(documentIdParamsSchema.parse({ id: 'doc-123' })).toEqual({ id: 'doc-123' });
  });

  it('rechaza un id vacío o campos adicionales', () => {
    expect(() => documentIdParamsSchema.parse({ id: '' })).toThrow();
    expect(() => documentIdParamsSchema.parse({ id: 'doc-123', extra: 'bad' })).toThrow();
  });
});
