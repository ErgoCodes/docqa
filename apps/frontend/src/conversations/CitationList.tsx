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
    <div className="mt-3.5 border-t border-border/40 pt-3 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2 font-medium">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-muted-foreground"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
        </svg>
        <span>Fuentes citadas</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {citations.map((citation, idx) => {
          const label = formatCitationLabel(citation, documentsMap);
          return (
            <button
              key={`${citation.chunkId}-${idx}`}
              type="button"
              onClick={() => setSelectedCitation(citation)}
              className="group inline-flex items-center gap-1.5 rounded-md bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border/60 hover:bg-accent hover:border-border transition-[transform,background-color,border-color] duration-150 ease-[var(--ease-out)] active:scale-[0.97] cursor-pointer"
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
                className="size-3 text-muted-foreground group-hover:text-foreground transition-colors"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="truncate max-w-[240px]">{label}</span>
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
