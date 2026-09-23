import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES, validateDocumentFile } from './document-validation';

describe('validateDocumentFile', () => {
  it('returns null for valid PDF under 10MB', () => {
    const file = new File(['%PDF-1.4 test content'], 'sample.pdf', {
      type: 'application/pdf',
    });
    expect(validateDocumentFile(file)).toBeNull();
  });

  it('rejects non-pdf files', () => {
    const file = new File(['plain text'], 'sample.txt', {
      type: 'text/plain',
    });
    expect(validateDocumentFile(file)).toBe('El archivo debe ser un documento PDF válido');
  });

  it('rejects files larger than 10MB', () => {
    const bigFile = new File([new Uint8Array(MAX_FILE_SIZE_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    expect(validateDocumentFile(bigFile)).toBe('El archivo no puede superar los 10 MB');
  });
});
