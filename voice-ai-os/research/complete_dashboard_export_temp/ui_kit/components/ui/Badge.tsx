
import React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

    const variants = {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-red-100 text-red-700 hover:bg-red-200", // Softened destructive
        success: "border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200", // "Healthy"
        warning: "border-transparent bg-amber-100 text-amber-700 hover:bg-amber-200", // "Attention"
        outline: "text-foreground",
    };

    return (
        <div className={cn(baseStyles, variants[variant], className)} {...props} />
    );
}
