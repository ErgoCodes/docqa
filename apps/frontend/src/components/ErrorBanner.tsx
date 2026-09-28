import * as React from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ErrorBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
}

export function ErrorBanner({
  message,
  title = 'Error',
  onRetry,
  retryLabel = 'Reintentar',
  onDismiss,
  className,
  ...props
}: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/50 text-destructive bg-destructive/10 dark:border-destructive rounded-lg border p-4 text-sm flex flex-col gap-2',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {title && <h4 className="font-medium tracking-tight">{title}</h4>}
          <div className="text-sm opacity-90">{message}</div>
        </div>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onDismiss}
            className="text-destructive hover:bg-destructive/20 h-6 px-2"
          >
            ✕
          </Button>
        )}
      </div>
      {onRetry && (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-destructive/30 text-destructive hover:bg-destructive/20"
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
