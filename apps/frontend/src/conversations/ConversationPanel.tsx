import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
      <div className="flex h-[80vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando conversación...</p>
      </div>
    );
  }

  if (isError || !conversation) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
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
    <Card className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden py-0">
      {/* Header */}
      <div className="border-b bg-muted/30 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            ← Volver
          </Link>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-sm font-semibold">
            Conversación <span className="text-muted-foreground font-normal">({scopeText})</span>
          </h2>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={conversation.messages}
        pendingQuestion={isPending ? pendingState.question : null}
        documentsMap={documentsMap}
      />

      {/* Error / Retry Banner */}
      {pendingState?.status === 'error' && (
        <div className="px-4 pb-2">
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

      {/* Input composer */}
      <div className="border-t bg-background p-4">
        <form
          onSubmit={(e) => {
            void handleSend(e);
          }}
          className="flex gap-2"
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
            className="min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
          />
          <Button
            type="submit"
            disabled={!inputQuestion.trim() || isPending}
            className="shrink-0 self-end"
          >
            {isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </form>
      </div>
    </Card>
  );
}
