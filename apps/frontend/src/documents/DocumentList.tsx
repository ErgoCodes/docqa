import type { DocumentItem } from '@/api/types';
import { DocumentStatusBadge } from './DocumentStatusBadge';

interface DocumentListProps {
  documents: DocumentItem[];
  isLoading: boolean;
  compact?: boolean;
}

export function DocumentList({ documents, isLoading, compact = false }: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm flex items-center justify-center gap-2">
        <span className="size-2 rounded-full bg-primary animate-pulse" />
        <span>Cargando documentos...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 p-8 text-center">
        <p className="text-sm font-medium text-foreground">No tienes documentos subidos aún</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Sube un PDF para comenzar a hacer consultas con citas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1 pb-1">
        <span>Documento</span>
        <span>Estado</span>
      </div>
      <div className="divide-border/60 divide-y rounded-xl border border-border/80 bg-card overflow-hidden">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm transition-colors duration-150 hover:bg-secondary/40 ${
              compact ? 'p-2.5' : 'p-3.5'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 shrink-0 text-muted-foreground"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="truncate font-medium text-foreground">{doc.title}</p>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs pl-6">
                {doc.pages > 0
                  ? `${doc.pages} ${doc.pages === 1 ? 'página' : 'páginas'}`
                  : 'Páginas pendientes'}{' '}
                • {new Date(doc.createdAt).toLocaleDateString()}
              </p>
              {doc.error && (
                <p className="text-destructive mt-1 text-xs pl-6">{doc.error}</p>
              )}
            </div>
            <div className="shrink-0 pl-6 sm:pl-0">
              <DocumentStatusBadge status={doc.status} error={doc.error} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
