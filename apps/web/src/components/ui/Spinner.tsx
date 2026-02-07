'use client';

import React from 'react';
import { cn } from './cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent',
        className
      )}
    />
  );
}
