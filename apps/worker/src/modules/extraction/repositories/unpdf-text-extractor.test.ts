import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createUnpdfTextExtractor } from './unpdf-text-extractor.js';

describe('createUnpdfTextExtractor', () => {
  it('extracts text from a single-page PDF with trimmed content', async () => {
    const extractor = createUnpdfTextExtractor();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage();
    page.drawText('  Hello DocQA  ', { font, x: 50, y: 700, size: 24 });
    const buffer = Buffer.from(await pdfDoc.save());

    const result = await extractor.extract(buffer);

    expect(result).toEqual([{ page: 1, text: 'Hello DocQA' }]);
  });

  it('extracts text from a multi-page PDF preserving 1-based page numbers in order', async () => {
    const extractor = createUnpdfTextExtractor();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page1 = pdfDoc.addPage();
    page1.drawText('Page 1 Content', { font, x: 50, y: 700, size: 20 });

    const page2 = pdfDoc.addPage();
    page2.drawText('Page 2 Content', { font, x: 50, y: 700, size: 20 });

    const page3 = pdfDoc.addPage();
    page3.drawText('Page 3 Content', { font, x: 50, y: 700, size: 20 });

    const buffer = Buffer.from(await pdfDoc.save());

    const result = await extractor.extract(buffer);

    expect(result).toEqual([
      { page: 1, text: 'Page 1 Content' },
      { page: 2, text: 'Page 2 Content' },
      { page: 3, text: 'Page 3 Content' },
    ]);
  });

  it('handles a blank page mixed among pages with text by returning an empty string', async () => {
    const extractor = createUnpdfTextExtractor();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page1 = pdfDoc.addPage();
    page1.drawText('First Page', { font, x: 50, y: 700, size: 20 });

    pdfDoc.addPage();

    const page3 = pdfDoc.addPage();
    page3.drawText('Third Page', { font, x: 50, y: 700, size: 20 });

    const buffer = Buffer.from(await pdfDoc.save());

    const result = await extractor.extract(buffer);

    expect(result).toEqual([
      { page: 1, text: 'First Page' },
      { page: 2, text: '' },
      { page: 3, text: 'Third Page' },
    ]);
  });

  it('rejects when buffer is not a valid PDF', async () => {
    const extractor = createUnpdfTextExtractor();
    const invalidBuffer = Buffer.from('not a pdf');

    await expect(extractor.extract(invalidBuffer)).rejects.toThrow();
  });
});
