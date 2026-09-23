import * as React from 'react';
import { Label as RadixLabel } from 'radix-ui';
import { cn } from '@/lib/utils';

function Label({
  className,
  ...props
}: React.ComponentProps<typeof RadixLabel.Root>) {
  return (
    <RadixLabel.Root
      data-slot="label"
      className={cn(
        'text-sm font-medium leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
