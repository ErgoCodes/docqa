import { extractText, getDocumentProxy } from 'unpdf';
import type { PdfTextExtractor } from '../interfaces/pdf-text-extractor.js';
import type { ExtractedPage } from '../types/extracted-page.js';

export function createUnpdfTextExtractor(): PdfTextExtractor {
  return {
    extract: async (buffer: Buffer): Promise<ExtractedPage[]> => {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: false });
      return text.map((pageText, index) => ({ page: index + 1, text: pageText.trim() }));
    },
  };
}
