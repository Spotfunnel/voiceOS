
import React from "react";
import { Card, CardContent } from "./Card";
import { cn } from "../../lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    icon?: React.ElementType;
    className?: string;
}

export function StatsCard({ title, value, trend, trendValue, icon: Icon, className }: StatsCardProps) {
    return (
        <Card className={cn("overflow-hidden hover:shadow-md transition-shadow duration-200", className)}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                    <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
                    {trend && (
                        <div className={cn("flex items-center text-xs font-medium",
                            trend === 'up' ? "text-emerald-600" :
                                trend === 'down' ? "text-red-500" : "text-slate-500"
                        )}>
                            {trend === 'up' && <ArrowUp className="w-3 h-3 mr-0.5" />}
                            {trend === 'down' && <ArrowDown className="w-3 h-3 mr-0.5" />}
                            {trend === 'neutral' && <Minus className="w-3 h-3 mr-0.5" />}
                            {trendValue}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
