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
      className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
      data-role={message.role}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-none'
            : 'bg-card text-card-foreground border rounded-tl-none',
        )}
      >
        <div className="mb-1 text-[11px] font-semibold opacity-70">
          {isUser ? 'Tú' : 'DocQA'}
        </div>

        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
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

      <span className="text-muted-foreground mt-1 px-1 text-[10px]">
        {new Date(message.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}
