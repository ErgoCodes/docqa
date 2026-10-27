interface PendingMessageBubbleProps {
  question: string;
}

export function PendingMessageBubble({ question }: PendingMessageBubbleProps) {
  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto animate-message-enter">
      {/* User question bubble */}
      <div className="flex flex-col items-end">
        <div className="bg-primary text-primary-foreground max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-2xs">
          <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase opacity-65">Tú</div>
          <div className="whitespace-pre-wrap break-words leading-relaxed">{question}</div>
        </div>
      </div>

      {/* Assistant generating indicator */}
      <div className="flex flex-col items-start w-full">
        <div className="bg-card text-card-foreground w-full rounded-2xl border border-border/60 px-5 py-4 text-sm shadow-xs">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-primary">
            <span className="size-2 rounded-full bg-primary animate-ping" />
            <span>DocQA</span>
          </div>
          <div className="flex items-center gap-2.5 py-1 text-muted-foreground text-xs">
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary/70 animate-pulse-dot" style={{ animationDelay: '0ms' }} />
              <span className="size-2 rounded-full bg-primary/70 animate-pulse-dot" style={{ animationDelay: '200ms' }} />
              <span className="size-2 rounded-full bg-primary/70 animate-pulse-dot" style={{ animationDelay: '400ms' }} />
            </div>
            <span className="font-medium text-foreground/80">Consultando documentos y elaborando respuesta...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
