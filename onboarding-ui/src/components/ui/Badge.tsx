'use client';

import React from 'react';
import { cn } from './cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'info';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-accent/15 text-accent-foreground',
  info: 'bg-secondary text-secondary-foreground',
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
