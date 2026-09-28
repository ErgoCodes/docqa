interface PendingMessageBubbleProps {
  question: string;
}

export function PendingMessageBubble({ question }: PendingMessageBubbleProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* User question bubble */}
      <div className="flex flex-col items-end">
        <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-tr-none px-4 py-3 text-sm shadow-xs">
          <div className="mb-1 text-[11px] font-semibold opacity-70">Tú</div>
          <div className="whitespace-pre-wrap break-words">{question}</div>
        </div>
      </div>

      {/* Assistant generating indicator */}
      <div className="flex flex-col items-start">
        <div className="bg-card text-card-foreground max-w-[85%] rounded-2xl rounded-tl-none border px-4 py-3 text-sm shadow-xs">
          <div className="mb-1 text-[11px] font-semibold opacity-70">DocQA</div>
          <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" />
            <span className="ml-2 text-xs">Buscando fuentes y respondiendo...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
