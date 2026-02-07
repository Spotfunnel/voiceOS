'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, Phone } from 'lucide-react';
import { Button } from '@/shared_ui/components/ui/Button';
import { PullToRefresh } from '@/shared_ui/components/PullToRefresh';
import { useData } from '@/contexts/DataContext';
import { SpotFunnelLogo } from '@/customer_dashboard/SpotFunnelLogo';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: Home },
  { label: 'Action', href: '/dashboard/action-required', icon: ListChecks },
  { label: 'Calls', href: '/dashboard/call-logs', icon: Phone },
];

type DashboardShellProps = {
  children: React.ReactNode;
  userLabel?: string | null;
};

export default function DashboardShell({ children, userLabel }: DashboardShellProps) {
  const pathname = usePathname();
  const { fetchData } = useData();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 relative">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <SpotFunnelLogo size={32} color="var(--primary)" />
            <span className="font-extrabold text-xl tracking-tight text-foreground">SpotFunnel</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted/30 p-1 rounded-xl border border-border/40 backdrop-blur-md">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
                    isActive
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {userLabel ? (
              <span className="text-sm font-medium text-muted-foreground hidden lg:block">{userLabel}</span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <PullToRefresh onRefresh={fetchData}>
          <div className="container mx-auto px-4 py-6 sm:py-10 pb-20 md:pb-10 h-full overflow-y-auto">
            {children}
          </div>
        </PullToRefresh>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 safe-bottom">
        <div className="grid grid-cols-3 gap-0.5 p-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-primary/10 text-primary scale-105'
                    : 'text-muted-foreground active:bg-muted/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
