import type { ExtractedPage } from '../types/extracted-page.js';

export interface PdfTextExtractor {
  extract: (buffer: Buffer) => Promise<ExtractedPage[]>;
}
