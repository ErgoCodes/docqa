import { describe, expect, it } from 'vitest';
import { buildStorageKey, sanitizeTitle } from './document-naming.js';

describe('buildStorageKey', () => {
  it('genera una ruta con formato userId/uuid.pdf', () => {
    const userId = 'user-123';
    const key = buildStorageKey(userId);

    expect(key).toMatch(/^user-123\/[0-9a-f-]{36}\.pdf$/);
  });

  it('genera claves únicas en llamadas consecutivas', () => {
    const userId = 'user-123';
    const key1 = buildStorageKey(userId);
    const key2 = buildStorageKey(userId);

    expect(key1).not.toBe(key2);
  });
});

describe('sanitizeTitle', () => {
  it('elimina la extensión .pdf del final', () => {
    expect(sanitizeTitle('reporte-anual.pdf')).toBe('reporte-anual');
    expect(sanitizeTitle('DOCUMENTO.PDF')).toBe('DOCUMENTO');
  });

  it('elimina rutas de directorios para prevenir path traversal', () => {
    expect(sanitizeTitle('../../etc/passwd.pdf')).toBe('passwd');
    expect(sanitizeTitle('carpeta/subcarpeta/archivo.pdf')).toBe('archivo');
  });

  it('recorta espacios en blanco en los extremos', () => {
    expect(sanitizeTitle('   mi documento final.pdf   ')).toBe('mi documento final');
  });

  it('conserva el nombre si no tiene extensión .pdf', () => {
    expect(sanitizeTitle('nota-informativa')).toBe('nota-informativa');
  });

  it('utiliza el título por defecto si el resultado queda vacío', () => {
    expect(sanitizeTitle('')).toBe('documento.pdf');
    expect(sanitizeTitle('.pdf')).toBe('documento.pdf');
    expect(sanitizeTitle('    ')).toBe('documento.pdf');
  });
});
