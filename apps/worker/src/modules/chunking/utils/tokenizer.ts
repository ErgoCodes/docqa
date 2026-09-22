export interface TokenSpan {
  text: string;
  start: number;
  end: number;
}

// Uses Intl.Segmenter with word granularity instead of regex split or BPE to avoid external dependencies,
// prevent splitting mid-word, and leverage standard Unicode UAX #29 segmentation (supporting space-less scripts like CJK via Node's embedded ICU).
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

export function tokenize(text: string): TokenSpan[] {
  return Array.from(wordSegmenter.segment(text))
    .filter((segment) => segment.isWordLike)
    .map((segment) => ({
      text: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
    }));
}
