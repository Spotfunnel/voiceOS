
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names safely, handling Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Mock data generator helper to ensure consistent state across page shells.
 */
export const mockId = () => Math.random().toString(36).substring(7);

export const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    }).format(date);
};

/**
 * Get color for intent/outcome badges
 */
export function getIntentColor(intent: string): string {
    const normalized = intent?.toLowerCase().replace(/_/g, ' ') || '';
    
    if (normalized.includes('lead') || normalized.includes('booking') || normalized.includes('booked')) {
        return 'success';
    }
    if (normalized.includes('support') || normalized.includes('question') || normalized.includes('enquiry')) {
        return 'primary';
    }
    if (normalized.includes('complaint') || normalized.includes('issue')) {
        return 'destructive';
    }
    if (normalized.includes('callback') || normalized.includes('reschedule')) {
        return 'warning';
    }
    return 'secondary';
}
