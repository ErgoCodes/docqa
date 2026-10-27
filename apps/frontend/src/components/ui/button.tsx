import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-150 ease-[var(--ease-out)] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 select-none',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 active:bg-destructive/95 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-border/80 bg-background/80 backdrop-blur-xs shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/20 dark:hover:bg-input/40',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 active:bg-secondary/90',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/40 active:bg-accent/60',
        link: 'text-primary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: 'h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*="size-"])]:size-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 text-xs',
        lg: 'h-11 rounded-xl px-6 text-base has-[>svg]:px-4 font-semibold',
        icon: 'size-9 rounded-lg',
        'icon-xs': 'size-6 rounded-md [&_svg:not([class*="size-"])]:size-3',
        'icon-sm': 'size-8 rounded-md',
        'icon-lg': 'size-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
