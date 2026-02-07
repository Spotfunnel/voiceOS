 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
 import { CostMetrics } from '@/contexts/AdminDataContext';
 import { Badge } from '@/components/ui/Badge';
 
 interface CostMonitoringPanelProps {
   cost: CostMetrics | null;
 }
 
 function formatCurrency(value?: number) {
   const amount = value ?? 0;
   return `$${amount.toFixed(2)}`;
 }
 
 export function CostMonitoringPanel({ cost }: CostMonitoringPanelProps) {
   const status = cost?.threshold_status ?? 'safe';
   const statusLabel = status.toUpperCase();
  const badgeVariant = status === 'safe' ? 'success' : status === 'warning' ? 'warning' : 'warning';
  const badgeClassName = status === 'critical' ? 'bg-destructive/10 text-destructive' : undefined;
 
   return (
     <Card className="border-border shadow-sm">
       <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="text-sm font-semibold">Cost Monitoring</CardTitle>
        <Badge variant={badgeVariant} className={badgeClassName}>
          {statusLabel}
        </Badge>
       </CardHeader>
       <CardContent className="grid gap-4 md:grid-cols-4">
         <div className="rounded-lg bg-muted/40 p-3">
           <p className="text-xs text-muted-foreground">Current Hour</p>
           <p className="text-lg font-semibold">{formatCurrency(cost?.current_hour)}</p>
         </div>
         <div className="rounded-lg bg-muted/40 p-3">
           <p className="text-xs text-muted-foreground">Today</p>
           <p className="text-lg font-semibold">{formatCurrency(cost?.today)}</p>
         </div>
         <div className="rounded-lg bg-muted/40 p-3">
           <p className="text-xs text-muted-foreground">This Month</p>
           <p className="text-lg font-semibold">{formatCurrency(cost?.month)}</p>
         </div>
         <div className="rounded-lg bg-muted/40 p-3">
           <p className="text-xs text-muted-foreground">Projected Month</p>
           <p className="text-lg font-semibold">{formatCurrency(cost?.projected_month)}</p>
         </div>
         <div className="md:col-span-4">
           <p className="text-xs text-muted-foreground">Threshold</p>
           <p className="text-sm font-semibold text-foreground">
             Alert when current hour exceeds {formatCurrency(cost?.threshold_hour ?? 100)}.
           </p>
         </div>
       </CardContent>
     </Card>
   );
 }
