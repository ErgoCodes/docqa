import { describe, expect, it } from 'vitest';
import type { ExtractedPage } from '../../extraction/types/extracted-page.js';
import { chunkDocument } from './chunk-document.js';

describe('chunkDocument', () => {
  const documentId = 'doc-test-123';
  const userId = 'user-test-456';

  it('no genera chunks ante una página con texto vacío sin fallar', () => {
    const pages: ExtractedPage[] = [{ page: 1, text: '' }];
    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toEqual([]);
  });

  it('no genera chunks ante una página con solo espacios en blanco', () => {
    const pages: ExtractedPage[] = [{ page: 1, text: '   \n\t  \r\n  ' }];
    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toEqual([]);
  });

  it('genera exactamente 1 chunk para una página con pocas palabras', () => {
    const pages: ExtractedPage[] = [
      { page: 1, text: 'Este es un texto corto para probar un solo chunk.' },
    ];
    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      documentId,
      userId,
      page: 1,
      index: 0,
      text: 'Este es un texto corto para probar un solo chunk.',
    });
  });

  it('segmenta un texto largo con opciones personalizadas manteniendo índices secuenciales', () => {
    const words = Array.from({ length: 25 }, (_, i) => `palabra${i}`);
    const pages: ExtractedPage[] = [{ page: 1, text: words.join(' ') }];

    const chunks = chunkDocument(pages, documentId, userId, {
      chunkSizeTokens: 10,
      chunkOverlapTokens: 3,
    });

    expect(chunks).toHaveLength(4);

    expect(chunks[0]?.index).toBe(0);
    expect(chunks[1]?.index).toBe(1);
    expect(chunks[2]?.index).toBe(2);
    expect(chunks[3]?.index).toBe(3);

    expect(chunks[0]?.text).toBe(words.slice(0, 10).join(' '));
    expect(chunks[1]?.text).toBe(words.slice(7, 17).join(' '));
    expect(chunks[2]?.text).toBe(words.slice(14, 24).join(' '));
    expect(chunks[3]?.text).toBe(words.slice(21, 25).join(' '));
  });

  it('mantiene el solapamiento literal de palabras entre chunks consecutivos', () => {
    const words = Array.from({ length: 20 }, (_, i) => `item${i}`);
    const pages: ExtractedPage[] = [{ page: 1, text: words.join(' ') }];
    const overlap = 3;

    const chunks = chunkDocument(pages, documentId, userId, {
      chunkSizeTokens: 8,
      chunkOverlapTokens: overlap,
    });

    for (let i = 0; i < chunks.length - 1; i++) {
      const currentWords = chunks[i]?.text.split(/\s+/);
      const nextWords = chunks[i + 1]?.text.split(/\s+/);

      const tailWords = currentWords?.slice(-overlap);
      const headWords = nextWords?.slice(0, overlap);

      expect(tailWords).toEqual(headWords);
    }
  });

  it('procesa páginas de forma independiente sin mezclar texto entre páginas', () => {
    const pages: ExtractedPage[] = [
      { page: 1, text: 'Contenido de la primera página.' },
      { page: 2, text: 'Contenido de la segunda página.' },
    ];

    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.page).toBe(1);
    expect(chunks[0]?.index).toBe(0);
    expect(chunks[0]?.text).toBe('Contenido de la primera página.');

    expect(chunks[1]?.page).toBe(2);
    expect(chunks[1]?.index).toBe(1);
    expect(chunks[1]?.text).toBe('Contenido de la segunda página.');
  });

  it('mantiene la secuencia continua de índices cuando hay páginas vacías intermedias', () => {
    const pages: ExtractedPage[] = [
      { page: 1, text: 'Texto de la página uno.' },
      { page: 2, text: '' },
      { page: 3, text: '   ' },
      { page: 4, text: 'Texto de la página cuatro.' },
    ];

    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.page).toBe(1);
    expect(chunks[0]?.index).toBe(0);

    expect(chunks[1]?.page).toBe(4);
    expect(chunks[1]?.index).toBe(1);
  });

  it('ordena las páginas de forma ascendente aunque vengan desordenadas', () => {
    const pages: ExtractedPage[] = [
      { page: 3, text: 'Página tres' },
      { page: 1, text: 'Página uno' },
      { page: 2, text: 'Página dos' },
    ];

    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.page).toBe(1);
    expect(chunks[0]?.index).toBe(0);
    expect(chunks[0]?.text).toBe('Página uno');

    expect(chunks[1]?.page).toBe(2);
    expect(chunks[1]?.index).toBe(1);
    expect(chunks[1]?.text).toBe('Página dos');

    expect(chunks[2]?.page).toBe(3);
    expect(chunks[2]?.index).toBe(2);
    expect(chunks[2]?.text).toBe('Página tres');
  });

  it('funciona con los defaults reales (800/100) para páginas con más de 800 palabras sin options explícitas', () => {
    const words = Array.from({ length: 900 }, (_, i) => `palabra${i}`);
    const pages: ExtractedPage[] = [{ page: 1, text: words.join(' ') }];

    const chunks = chunkDocument(pages, documentId, userId);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.index).toBe(0);
    expect(chunks[0]?.text).toBe(words.slice(0, 800).join(' '));

    expect(chunks[1]?.index).toBe(1);
    expect(chunks[1]?.text).toBe(words.slice(700, 900).join(' '));
  });

  it('conserva la puntuación final al dividir chunks', () => {
    const pages: ExtractedPage[] = [
      { page: 1, text: 'Palabra1 palabra2! Palabra3 palabra4.' },
    ];

    const chunks = chunkDocument(pages, documentId, userId, {
      chunkSizeTokens: 2,
      chunkOverlapTokens: 0,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.text).toBe('Palabra1 palabra2!');
    expect(chunks[1]?.text).toBe('Palabra3 palabra4.');
  });

  it('propaga documentId y userId sin modificar a cada chunk generado', () => {
    const pages: ExtractedPage[] = [
      { page: 1, text: 'Primera página para prueba de ids.' },
      { page: 2, text: 'Segunda página para prueba de ids.' },
    ];

    const chunks = chunkDocument(pages, 'doc-prop-999', 'user-prop-888');

    for (const chunk of chunks) {
      expect(chunk.documentId).toBe('doc-prop-999');
      expect(chunk.userId).toBe('user-prop-888');
    }
  });
});
