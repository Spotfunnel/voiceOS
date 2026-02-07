'use client';

import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CallLog } from '@/contexts/DashboardDataContext';

interface OutcomeChartProps {
  calls: CallLog[];
}

const OUTCOME_LABELS: Record<string, string> = {
  lead_captured: 'Lead Captured',
  callback_requested: 'Callback Requested',
  faq_resolved: 'FAQ Resolved',
  escalated: 'Escalated',
  failed: 'Failed',
  in_progress: 'In Progress',
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--secondary-foreground))',
  'hsl(var(--foreground))',
];

export function OutcomeChart({ calls }: OutcomeChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    calls.forEach((call) => {
      counts[call.outcome] = (counts[call.outcome] || 0) + 1;
    });

    return Object.entries(counts).map(([key, value]) => ({
      name: OUTCOME_LABELS[key] || key,
      value,
    }));
  }, [calls]);

  return (
    <Card className="border-border shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Outcome Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No outcomes yet for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                label
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
