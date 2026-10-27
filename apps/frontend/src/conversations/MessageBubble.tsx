import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DocumentItem, Message } from '@/api/types';
import { cn } from '@/lib/utils';
import { CitationList } from './CitationList';

interface MessageBubbleProps {
  message: Message;
  documentsMap?: Map<string, DocumentItem>;
}

export function MessageBubble({ message, documentsMap }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex flex-col animate-message-enter w-full max-w-3xl mx-auto',
        isUser ? 'items-end' : 'items-start',
      )}
      data-role={message.role}
    >
      <div
        className={cn(
          'relative text-sm transition-[border-color,background-color] duration-150',
          isUser
            ? 'max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 shadow-2xs'
            : 'w-full rounded-2xl border border-border/60 bg-card px-5 py-4 text-card-foreground shadow-xs',
        )}
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase opacity-65">
          {isUser ? (
            <span>Tú</span>
          ) : (
            <div className="flex items-center gap-1.5 text-primary">
              <span className="size-2 rounded-full bg-primary" />
              <span>DocQA</span>
            </div>
          )}
        </div>

        {isUser ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationList citations={message.citations} documentsMap={documentsMap} />
        )}
      </div>

      <span className="text-muted-foreground/80 mt-1 px-1.5 text-[10px] tabular-nums">
        {new Date(message.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}
