import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { conversationsApi } from '@/api/conversations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DocumentList } from './DocumentList';
import { DocumentUploadForm } from './DocumentUploadForm';
import { RecentConversationsList } from '@/conversations/RecentConversationsList';
import { useDocuments } from './useDocuments';

export function HomePage() {
  const { documents, isLoading } = useDocuments();
  const navigate = useNavigate();
  const [initialQuestion, setInitialQuestion] = React.useState('');
  const [isStarting, setIsStarting] = React.useState(false);
  const [isDocsOpen, setIsDocsOpen] = React.useState(false);

  const readyDocuments = documents.filter((d) => d.status === 'ready');
  const hasReadyDocs = readyDocuments.length > 0;

  const handleStartWithQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStarting) return;

    setIsStarting(true);
    try {
      // Iniciar conversación con todos los documentos listos
      const conversation = await conversationsApi.create([]);
      const questionToSend = initialQuestion.trim();

      if (questionToSend) {
        // Enviar primera pregunta directamente
        await conversationsApi.sendMessage(conversation.id, questionToSend);
      }

      void navigate({
        to: '/conversations/$id',
        params: { id: conversation.id },
      });
    } catch {
      setIsStarting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleStartWithQuestion();
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center py-6 sm:py-12">
      <div className="w-full max-w-2xl px-4 space-y-8 text-center">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>RAG con citas exactas por página</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Tus documentos, con respuestas verificables
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Sube tus archivos PDF y realiza preguntas en lenguaje natural con citas directas al texto original.
          </p>
        </div>

        {/* Central Chat Input Card (Claude style) */}
        <div className="relative rounded-2xl border border-border/80 bg-card p-3 sm:p-4 text-left shadow-lg transition-[border-color,box-shadow] duration-200 focus-within:border-ring/60 focus-within:ring-4 focus-within:ring-ring/10">
          <form onSubmit={(e) => void handleStartWithQuestion(e)} className="space-y-3">
            <Textarea
              value={initialQuestion}
              onChange={(e) => setInitialQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasReadyDocs
                  ? 'Haz una pregunta sobre tus documentos (Enter para enviar)...'
                  : 'Sube un documento primero para comenzar a consultar...'
              }
              disabled={isStarting}
              className="min-h-[90px] w-full resize-none border-none bg-transparent p-1 text-base shadow-none focus-visible:ring-0 md:text-sm"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
              {/* Document Drawer/Modal Trigger */}
              <Dialog open={isDocsOpen} onOpenChange={setIsDocsOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>
                      {readyDocuments.length > 0
                        ? `${readyDocuments.length} ${readyDocuments.length === 1 ? 'doc listo' : 'docs listos'}`
                        : 'Gestionar documentos'}
                    </span>
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Tus Documentos</DialogTitle>
                    <DialogDescription>
                      Sube PDFs (máx. 10 MB, 50 pág.) para habilitar consultas con citas.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 pt-2">
                    <DocumentUploadForm onSuccess={() => setIsDocsOpen(false)} compact />
                    <DocumentList documents={documents} isLoading={isLoading} compact />
                  </div>
                </DialogContent>
              </Dialog>

              {/* Start / Send Button */}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={!hasReadyDocs || isStarting}
                  className="gap-2 h-8 px-4 text-xs font-semibold"
                >
                  <span>{isStarting ? 'Iniciando...' : 'Preguntar'}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Recent Conversations and Quick Actions */}
        <div className="max-w-xl mx-auto pt-2 text-left">
          <RecentConversationsList />
        </div>
      </div>
    </div>
  );
}
