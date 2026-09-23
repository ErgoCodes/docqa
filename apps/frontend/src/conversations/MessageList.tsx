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
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.length === 0 && !pendingQuestion && (
        <div className="text-muted-foreground flex h-full min-h-[200px] items-center justify-center text-center text-sm">
          Haz una pregunta sobre los documentos seleccionados para iniciar la conversación.
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

      <div ref={bottomRef} />
    </div>
  );
}
