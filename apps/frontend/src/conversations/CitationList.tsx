import * as React from 'react';
import type { Citation, DocumentItem } from '@/api/types';
import { ChunkPreviewDialog } from '@/chunks/ChunkPreviewDialog';
import { formatCitationLabel } from './citation-format';

interface CitationListProps {
  citations: Citation[];
  documentsMap?: Map<string, DocumentItem>;
}

export function CitationList({ citations, documentsMap }: CitationListProps) {
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);

  if (!citations || citations.length === 0) {
    return null;
  }

  const selectedDocTitle = selectedCitation
    ? documentsMap?.get(selectedCitation.documentId)?.title
    : undefined;

  return (
    <div className="mt-3 border-t border-border/50 pt-2 text-xs">
      <p className="font-semibold text-muted-foreground mb-1.5">Fuentes citadas:</p>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((citation, idx) => {
          const label = formatCitationLabel(citation, documentsMap);
          return (
            <button
              key={`${citation.chunkId}-${idx}`}
              type="button"
              onClick={() => setSelectedCitation(citation)}
              className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors cursor-pointer border border-border"
              title="Haz clic para ver el fragmento citado"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3 text-muted-foreground"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <ChunkPreviewDialog
        open={Boolean(selectedCitation)}
        onOpenChange={(open) => {
          if (!open) setSelectedCitation(null);
        }}
        chunkId={selectedCitation?.chunkId ?? null}
        documentTitle={selectedDocTitle}
        page={selectedCitation?.page}
      />
    </div>
  );
}
