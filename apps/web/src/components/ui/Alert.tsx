'use client';

import React from 'react';
import { cn } from './cn';

type AlertVariant = 'default' | 'warning' | 'success' | 'error';

const variants: Record<AlertVariant, string> = {
  default: 'border-border bg-card',
  warning: 'border-accent/40 bg-accent/10',
  success: 'border-primary/30 bg-primary/5',
  error: 'border-destructive/30 bg-destructive/10',
};

export function Alert({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm text-foreground',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
