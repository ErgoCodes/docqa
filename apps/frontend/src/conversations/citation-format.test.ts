import { describe, expect, it } from 'vitest';
import type { Citation, DocumentItem } from '@/api/types';
import { formatCitationLabel } from './citation-format';

describe('formatCitationLabel', () => {
  const citation: Citation = {
    chunkId: 'chunk-123',
    documentId: 'doc-456789abcdef',
    page: 4,
  };

  it('formats with document title if available in map', () => {
    const map = new Map<string, DocumentItem>([
      [
        'doc-456789abcdef',
        {
          id: 'doc-456789abcdef',
          title: 'Manual de usuario.pdf',
          status: 'ready',
          pages: 10,
          error: null,
          createdAt: '2026-09-01',
        },
      ],
    ]);

    expect(formatCitationLabel(citation, map)).toBe('Manual de usuario.pdf (pág. 4)');
  });

  it('formats with fallback short doc id if title not found', () => {
    expect(formatCitationLabel(citation)).toBe('Doc abcdef (pág. 4)');
  });
});
