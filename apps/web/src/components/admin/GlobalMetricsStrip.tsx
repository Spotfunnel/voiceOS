 import React from 'react';
 import { Card, CardContent } from '@/components/ui/Card';
 import { Badge } from '@/components/ui/Badge';
 import { GlobalHealthMetrics } from '@/contexts/AdminDataContext';
 
 interface GlobalMetricsStripProps {
   health: GlobalHealthMetrics | null;
 }
 
 function formatPercent(value: number) {
   return `${Math.round(value * 1000) / 10}%`;
 }
 
 export function GlobalMetricsStrip({ health }: GlobalMetricsStripProps) {
   const status = health?.status ?? 'warning';
   const statusLabel = status.toUpperCase();
  const statusVariant = status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'warning';
  const statusClassName = status === 'critical' ? 'bg-destructive/10 text-destructive' : undefined;
 
   const cards = [
     { label: 'Active Calls', value: health?.active_calls ?? 0 },
     { label: 'Calls Today', value: health?.calls_today ?? 0 },
     { label: 'Success Rate', value: formatPercent(health?.success_rate ?? 0) },
     { label: 'P95 Latency', value: `${health?.p95_latency_ms ?? 0} ms` },
   ];
 
   return (
     <Card className="border-border shadow-sm">
       <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
         <div className="flex items-center gap-3">
          <Badge variant={statusVariant} className={statusClassName}>
            {statusLabel}
          </Badge>
           <div>
             <p className="text-sm font-semibold text-foreground">System Health</p>
             <p className="text-xs text-muted-foreground">Updated {health?.timestamp ?? 'now'}</p>
           </div>
         </div>
         <div className="grid w-full grid-cols-2 gap-4 md:w-auto md:grid-cols-4">
           {cards.map((card) => (
             <div key={card.label} className="rounded-lg bg-muted/40 p-3">
               <p className="text-xs text-muted-foreground">{card.label}</p>
               <p className="text-lg font-semibold text-foreground">{card.value}</p>
             </div>
           ))}
         </div>
       </CardContent>
     </Card>
   );
 }
