'use client';

import React, { useState } from 'react';
import { LayoutDashboard, AlertCircle, Settings } from 'lucide-react';
import { cn } from '@/components/ui/cn';

type DashboardTab = 'overview' | 'action-required' | 'configuration';

const NAV_ITEMS = [
  { id: 'overview' as DashboardTab, label: 'Overview', icon: LayoutDashboard },
  { id: 'action-required' as DashboardTab, label: 'Action Required', icon: AlertCircle },
  { id: 'configuration' as DashboardTab, label: 'Configuration', icon: Settings },
];

interface DashboardLayoutProps {
  children: (activeTab: DashboardTab) => React.ReactNode;
  actionCount?: number;
}

export function DashboardLayout({ children, actionCount = 0 }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  return (
    <div className="min-h-screen bg-background">
      <nav className="glass sticky top-0 z-50 hidden items-center gap-1 border-b bg-card/80 px-6 md:flex">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'px-4 py-3 font-semibold transition-all duration-200 flex items-center gap-2',
                isActive
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.id === 'action-required' && actionCount > 0 && (
                <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  {actionCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="pb-24 md:pb-8">{children(activeTab)}</main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
        <div className="grid grid-cols-3 gap-0.5 p-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">
                  {item.label.split(' ')[0]}
                </span>
                {item.id === 'action-required' && actionCount > 0 && (
                  <span className="absolute top-1 right-2 bg-destructive text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {actionCount > 9 ? '9+' : actionCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
