import React from 'react';
import { Phone, AlertCircle, UserCheck, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { DashboardMetrics } from '@/contexts/DashboardDataContext';

interface MetricsCardsProps {
  metrics: DashboardMetrics;
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      label: 'Total Calls',
      value: metrics.total_calls,
      icon: Phone,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Action Required',
      value: metrics.action_required,
      icon: AlertCircle,
      color: 'bg-destructive/10 text-destructive',
    },
    {
      label: 'Leads Captured',
      value: metrics.leads_captured,
      icon: UserCheck,
      color: 'bg-accent/10 text-accent',
    },
    {
      label: 'Success Rate',
      value: `${Math.round(metrics.success_rate * 100)}%`,
      icon: TrendingUp,
      color: 'bg-secondary text-secondary-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-border shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
