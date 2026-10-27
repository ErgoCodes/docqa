import * as React from 'react';
import type { DocumentItem, Message } from '@/api/types';
import { MessageBubble } from './MessageBubble';
import { PendingMessageBubble } from './PendingMessageBubble';

interface MessageListProps {
  messages: Message[];
  pendingQuestion?: string | null;
  documentsMap?: Map<string, DocumentItem>;
}

export function MessageList({
  messages,
  pendingQuestion,
  documentsMap,
}: MessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingQuestion]);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
      {messages.length === 0 && !pendingQuestion && (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center p-8">
          <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center mb-4 text-primary border border-border/80">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Comienza la conversación
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Haz una pregunta sobre los documentos seleccionados para iniciar la consulta.
          </p>
        </div>
      )}

      {messages.map((message, index) => (
        <MessageBubble
          key={`${message.createdAt}-${index}`}
          message={message}
          documentsMap={documentsMap}
        />
      ))}

      {pendingQuestion && <PendingMessageBubble question={pendingQuestion} />}

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}
