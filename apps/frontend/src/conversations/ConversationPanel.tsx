import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDocuments } from '@/documents/useDocuments';
import { MessageList } from './MessageList';
import { useConversationQuery } from './useConversationQuery';
import { usePendingQuestion } from './usePendingQuestion';
import { useSendMessageMutation } from './useSendMessageMutation';

interface ConversationPanelProps {
  conversationId: string;
}

export function ConversationPanel({ conversationId }: ConversationPanelProps) {
  const { data: conversation, isLoading, isError, error, refetch } = useConversationQuery(conversationId);
  const { documents } = useDocuments();
  const sendMessageMutation = useSendMessageMutation(conversationId);
  const pendingState = usePendingQuestion(conversationId);

  const [inputQuestion, setInputQuestion] = React.useState('');

  const documentsMap = React.useMemo(() => {
    const map = new Map();
    for (const doc of documents) {
      map.set(doc.id, doc);
    }
    return map;
  }, [documents]);

  const isPending = pendingState?.status === 'pending';

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputQuestion.trim();
    if (!trimmed || isPending) return;

    setInputQuestion('');
    try {
      await sendMessageMutation.mutateAsync({ question: trimmed, retryMode: 'ask' });
    } catch {
      // Error state captured by react-query and usePendingQuestion
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleRetry = () => {
    if (!pendingState) return;

    if (pendingState.isRefetchError) {
      void sendMessageMutation.mutateAsync({
        question: pendingState.question,
        retryMode: 'refreshOnly',
      });
    } else {
      void sendMessageMutation.mutateAsync({
        question: pendingState.question,
        retryMode: 'ask',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center gap-3">
        <span className="size-3 rounded-full bg-primary animate-pulse" />
        <p className="text-muted-foreground text-sm">Cargando conversación...</p>
      </div>
    );
  }

  if (isError || !conversation) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center gap-4 max-w-md mx-auto text-center px-4">
        <ErrorBanner
          title="Error al cargar la conversación"
          message={error?.message || 'Conversación no encontrada'}
          onRetry={() => void refetch()}
        />
        <Link to="/" className="text-primary hover:underline text-sm font-medium">
          ← Volver a inicio
        </Link>
      </div>
    );
  }

  const scopeText =
    conversation.documentIds.length === 0
      ? 'Todos los documentos'
      : `${conversation.documentIds.length} ${conversation.documentIds.length === 1 ? 'documento' : 'documentos'}`;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col max-w-4xl mx-auto">
      {/* Sticky Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 px-2 sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground text-xs sm:text-sm font-medium inline-flex items-center gap-1 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Volver</span>
          </Link>
          <div className="h-4 w-px bg-border/80" />
          <h2 className="text-xs sm:text-sm font-semibold truncate max-w-[280px] sm:max-w-md">
            Conversación{' '}
            <span className="text-muted-foreground font-normal">({scopeText})</span>
          </h2>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageList
          messages={conversation.messages}
          pendingQuestion={isPending ? pendingState.question : null}
          documentsMap={documentsMap}
        />
      </div>

      {/* Error / Retry Banner */}
      {pendingState?.status === 'error' && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <ErrorBanner
            title={
              pendingState.isRefetchError
                ? 'Error al refrescar conversación'
                : 'Error al procesar pregunta'
            }
            message={
              pendingState.isRefetchError
                ? 'La respuesta fue generada pero ocurrió un problema al recargar la conversación.'
                : pendingState.error?.message || 'Error al enviar la pregunta.'
            }
            retryLabel={
              pendingState.isRefetchError ? 'Refrescar conversación' : 'Reintentar pregunta'
            }
            onRetry={handleRetry}
          />
        </div>
      )}

      {/* Floating Bottom Composer */}
      <div className="p-2 sm:p-4 bg-background/95 backdrop-blur-xs">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border/80 bg-card p-2 sm:p-3 shadow-lg transition-[border-color,box-shadow] duration-200 focus-within:border-ring/60 focus-within:ring-4 focus-within:ring-ring/10">
          <form
            onSubmit={(e) => {
              void handleSend(e);
            }}
            className="flex flex-col gap-2"
          >
            <Textarea
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isPending
                  ? 'Esperando respuesta de DocQA...'
                  : 'Haz una pregunta sobre los documentos (Enter para enviar)...'
              }
              disabled={isPending}
              className="min-h-[50px] max-h-36 resize-none border-none bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
              rows={1}
            />
            <div className="flex items-center justify-between border-t border-border/40 pt-2 px-1">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Shift + Enter para nueva línea
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!inputQuestion.trim() || isPending}
                className="gap-1.5 h-8 px-3 text-xs font-semibold ml-auto"
              >
                <span>{isPending ? 'Enviando...' : 'Enviar'}</span>
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
          </form>
        </div>
      </div>
    </div>
  );
}
