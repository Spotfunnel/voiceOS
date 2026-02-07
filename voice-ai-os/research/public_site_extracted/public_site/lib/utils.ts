import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getIntentColor = (intent: string) => {
  if (!intent) return 'bg-muted text-muted-foreground border-border';

  const normalized = intent.toLowerCase().replace(/_/g, ' ');

  // Leads & Growth - Greens
  if (['new lead', 'commercial lead', 'upgrade request', 'old quote'].some(k => normalized.includes(k))) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 font-medium';
  }

  // Issues - Reds
  if (['complaint', 'off topic'].some(k => normalized.includes(k))) {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200/50 font-medium';
  }

  // Support & Service - Oranges (Requested)
  if (['support', 'general enquiry'].some(k => normalized.includes(k))) {
    return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200/50 font-medium';
  }

  // Scheduling/Callback - Yellows
  if (['reschedule', 'callback request'].some(k => normalized.includes(k))) {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/50 font-medium';
  }

  // Default
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-200/50 font-medium';
};
