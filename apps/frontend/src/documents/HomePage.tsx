import { DocumentScopePicker } from '@/conversations/DocumentScopePicker';
import { RecentConversationsList } from '@/conversations/RecentConversationsList';
import { DocumentList } from './DocumentList';
import { DocumentUploadForm } from './DocumentUploadForm';
import { useDocuments } from './useDocuments';

export function HomePage() {
  const { documents, isLoading } = useDocuments();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Tus Documentos y Consultas</h1>
        <p className="text-muted-foreground">
          Sube tus archivos PDF y realiza preguntas con respuestas citadas directamente desde el texto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Left column: Upload and scope picker to start chat */}
        <div className="space-y-6">
          <DocumentUploadForm />
          <DocumentScopePicker documents={documents} />
          <RecentConversationsList />
        </div>

        {/* Right column: Document list */}
        <div className="space-y-6">
          <DocumentList documents={documents} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
