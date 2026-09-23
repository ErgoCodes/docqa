import type { DocumentItem } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentStatusBadge } from './DocumentStatusBadge';

interface DocumentListProps {
  documents: DocumentItem[];
  isLoading: boolean;
}

export function DocumentList({ documents, isLoading }: DocumentListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentos disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-6 text-center text-sm">
            Cargando documentos...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentos disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-6 text-center text-sm">
            No tienes documentos subidos aún. Sube un PDF para comenzar.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Documentos disponibles ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-border divide-y rounded-md border">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-sm hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.title}</p>
                <p className="text-muted-foreground text-xs">
                  {doc.pages > 0 ? `${doc.pages} ${doc.pages === 1 ? 'página' : 'páginas'}` : 'Páginas pendientes'}{' '}
                  • {new Date(doc.createdAt).toLocaleDateString()}
                </p>
                {doc.error && (
                  <p className="text-destructive text-xs mt-0.5">{doc.error}</p>
                )}
              </div>
              <div className="shrink-0">
                <DocumentStatusBadge status={doc.status} error={doc.error} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
