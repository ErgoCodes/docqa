import { PDFDocument } from 'pdf-lib';
import { AppError } from '../../../errors.js';
import { DocumentErrors } from '../types/document-errors.js';

const PDF_MAGIC_BYTES = Buffer.from('%PDF-');

export interface ValidatedPdf {
  pageCount: number;
}

/**
 * Valida que el buffer corresponda a un PDF auténtico y no corrupto.
 * Comprueba primero los magic bytes (%PDF-) para fallar rápido en casos obvios,
 * y luego realiza un parseo estructural completo mediante pdf-lib.
 */
export async function validatePdf(buffer: Buffer): Promise<ValidatedPdf> {
  if (buffer.length < PDF_MAGIC_BYTES.length || !buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    throw new AppError(DocumentErrors.INVALID_FILE_TYPE);
  }

  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    return { pageCount };
  } catch {
    throw new AppError(DocumentErrors.INVALID_FILE_TYPE);
  }
}
