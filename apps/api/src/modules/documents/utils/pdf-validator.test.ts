import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { validatePdf } from './pdf-validator.js';
import { AppError } from '../../../errors.js';

async function buildPdfBuffer(pageCount: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage();
  }
  return Buffer.from(await pdfDoc.save());
}

describe('validatePdf', () => {
  it('valida un PDF correcto de 1 página y devuelve el recuento de páginas', async () => {
    const buffer = await buildPdfBuffer(1);
    const result = await validatePdf(buffer);

    expect(result.pageCount).toBe(1);
  });

  it('valida un PDF correcto de múltiples páginas', async () => {
    const buffer = await buildPdfBuffer(5);
    const result = await validatePdf(buffer);

    expect(result.pageCount).toBe(5);
  });

  it('rechaza un buffer que no empieza con magic bytes %PDF-', async () => {
    const fakeBuffer = Buffer.from('Esto es solo texto plano');

    await expect(validatePdf(fakeBuffer)).rejects.toThrow(AppError);
    await expect(validatePdf(fakeBuffer)).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE', statusCode: 415 });
  });

  it('rechaza un buffer que empieza con %PDF- pero contiene datos corruptos o basura', async () => {
    const corruptBuffer = Buffer.from('%PDF-1.4\nesta cabecera es falsa y no es un pdf valido');

    await expect(validatePdf(corruptBuffer)).rejects.toThrow(AppError);
    await expect(validatePdf(corruptBuffer)).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE', statusCode: 415 });
  });

  it('rechaza un buffer vacío o menor a 5 bytes', async () => {
    await expect(validatePdf(Buffer.alloc(0))).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
    await expect(validatePdf(Buffer.from('%PD'))).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
  });
});
