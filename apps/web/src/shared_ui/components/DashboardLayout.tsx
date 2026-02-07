'use client';

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Settings, Activity, BrainCircuit } from "lucide-react";
import { cn } from "../lib/utils";

interface LayoutProps {
    children: React.ReactNode;
    activeResult?: "overview" | "operations" | "new_agent" | "quality" | "intelligence";
}

const NAV_ITEMS = [
    { id: "overview", label: "Agent Overview", icon: Activity, href: "/admin/overview" },
    { id: "operations", label: "Operations", icon: Activity, href: "/admin/operations" },
    { id: "new_agent", label: "New Agent", icon: PlusCircle, href: "/admin/new-agent" },
    { id: "intelligence", label: "Intelligence", icon: BrainCircuit, href: "/admin/intelligence" },
    { id: "quality", label: "Quality", icon: LayoutDashboard, href: "/admin/quality" },
];

export function DashboardLayout({ children, activeResult = "operations" }: LayoutProps) {
    return (
        <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans text-foreground">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 border-r border-border flex-shrink-0 z-10 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] relative">
                <div className="p-6 border-b border-border flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-sm bg-primary" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">SpotFunnel</span>
                </div>

                <nav className="p-4 space-y-1">
                    <div className="px-2 py-2 text-xs font-bold opacity-50 uppercase tracking-wider">
                        Platform
                    </div>
                    {NAV_ITEMS.map((item) => {
                        const isActive = activeResult === item.id;
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "opacity-70")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="absolute bottom-0 left-0 w-full p-4 border-t border-border">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-secondary border border-border" />
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">Kai Operator</p>
                            <p className="text-xs text-muted-foreground truncate">kai@spotfunnel.com</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto min-h-screen bg-[hsl(var(--background))]">
                <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Dashboard</span>
                        <span className="opacity-30">/</span>
                        <span className="font-medium text-foreground capitalize">{activeResult.replace('_', ' ')}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full border border-success/20 shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            <span className="text-xs font-semibold">System Operational</span>
                        </div>
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto animate-enter">
                    {children}
                </div>
            </main>
        </div>
    );
}
