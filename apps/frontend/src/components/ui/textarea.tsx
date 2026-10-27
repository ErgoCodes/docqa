import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input/80 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-ring/25 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex min-h-[80px] w-full rounded-lg border bg-background/50 px-3.5 py-2.5 text-base shadow-2xs transition-[border-color,box-shadow,background-color] duration-150 ease-[var(--ease-out)] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
