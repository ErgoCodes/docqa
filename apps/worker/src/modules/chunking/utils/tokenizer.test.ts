import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenizer.js';

describe('tokenize', () => {
  it('tokeniza texto simple en español e inglés con puntuación, excluyendo espacios y signos', () => {
    const text = '¡Hola, mundo! This is a test.';
    const spans = tokenize(text);

    expect(spans).toEqual([
      { text: 'Hola', start: 1, end: 5 },
      { text: 'mundo', start: 7, end: 12 },
      { text: 'This', start: 14, end: 18 },
      { text: 'is', start: 19, end: 21 },
      { text: 'a', start: 22, end: 23 },
      { text: 'test', start: 24, end: 28 },
    ]);
  });

  it('devuelve un array vacío ante un texto vacío', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('devuelve un array vacío ante un texto compuesto únicamente por espacios en blanco', () => {
    expect(tokenize('   \t \n \r\n  ')).toEqual([]);
  });

  it('no rompe la tokenización con múltiples espacios o saltos de línea consecutivos', () => {
    const text = 'primera\n\n\nsegunda';
    const spans = tokenize(text);

    expect(spans).toEqual([
      { text: 'primera', start: 0, end: 7 },
      { text: 'segunda', start: 10, end: 17 },
    ]);
  });

  it('produce exactamente 1 span cubriendo todo el texto ante una sola palabra gigante sin espacios', () => {
    const text = 'supercalifragilisticoespialidoso';
    const spans = tokenize(text);

    expect(spans).toEqual([
      { text: 'supercalifragilisticoespialidoso', start: 0, end: 32 },
    ]);
  });
});
