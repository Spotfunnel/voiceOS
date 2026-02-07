'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, PhoneCall, CheckCircle } from 'lucide-react';
import { useDashboardData } from '@/contexts/DashboardDataContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { formatDistanceToNow } from 'date-fns';

type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';

const PRIORITY_LABELS: Record<PriorityFilter, string> = {
  all: 'All',
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive',
  high: 'bg-accent/10 text-accent',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

export function ActionRequiredTab() {
  const { callLogs } = useDashboardData();
  const [filter, setFilter] = useState<PriorityFilter>('all');

  const actionItems = useMemo(() => {
    const filtered = callLogs.filter((call) => call.requires_action);
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return filtered.sort(
      (a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
    );
  }, [callLogs]);

  const visibleItems = useMemo(() => {
    if (filter === 'all') return actionItems;
    return actionItems.filter((call) => call.priority === filter);
  }, [actionItems, filter]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Action Required</h1>
          <p className="text-muted-foreground">
            Urgent calls that need follow-up
          </p>
        </div>
        <Badge variant="warning">{actionItems.length} pending</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRIORITY_LABELS) as PriorityFilter[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'default' : 'secondary'}
            onClick={() => setFilter(key)}
          >
            {PRIORITY_LABELS[key]}
          </Button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No action required right now.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleItems.map((call) => (
            <Card key={call.id} className="border-border shadow-md">
              <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'p-3 rounded-xl',
                      PRIORITY_STYLES[call.priority] || 'bg-muted text-muted-foreground'
                    )}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {call.captured_data?.name || 'Unknown Caller'}
                      </p>
                      <Badge variant="info">{call.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {call.caller_phone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(call.start_time))} ago
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => window.open(`tel:${call.caller_phone}`)}
                  >
                    <PhoneCall className="w-4 h-4 mr-2" />
                    Call Back
                  </Button>
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                  <Button size="sm" variant="secondary">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
