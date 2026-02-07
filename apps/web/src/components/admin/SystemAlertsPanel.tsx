 import React from 'react';
 import { Badge } from '@/components/ui/Badge';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
 import { Button } from '@/components/ui/Button';
 import { SystemAlert } from '@/contexts/AdminDataContext';
 
 interface SystemAlertsPanelProps {
   alerts: SystemAlert[];
   onNavigate?: (path: string) => void;
 }
 
 export function SystemAlertsPanel({ alerts, onNavigate }: SystemAlertsPanelProps) {
   return (
     <Card className="border-border shadow-sm">
       <CardHeader>
         <CardTitle className="text-sm font-semibold">System Alerts</CardTitle>
       </CardHeader>
       <CardContent className="space-y-4">
         {alerts.length === 0 && (
           <p className="text-sm text-muted-foreground">No active alerts.</p>
         )}
         {alerts.map((alert) => (
           <div key={alert.id} className="rounded-lg border border-border/60 p-3">
             <div className="flex items-start justify-between gap-3">
               <div>
                 <div className="flex items-center gap-2">
                   <Badge
                     variant={alert.severity === 'critical' ? 'warning' : 'warning'}
                     className={alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' : undefined}
                   >
                     {alert.severity.toUpperCase()}
                   </Badge>
                   <p className="text-sm font-semibold text-foreground">{alert.message}</p>
                 </div>
                 {alert.details ? (
                   <p className="mt-1 text-xs text-muted-foreground">{alert.details}</p>
                 ) : null}
                 <p className="mt-1 text-xs text-muted-foreground">{alert.timestamp}</p>
               </div>
               {alert.drill_down_link ? (
                 <Button size="sm" variant="outline" onClick={() => onNavigate?.(alert.drill_down_link!)}>
                   Investigate
                 </Button>
               ) : null}
             </div>
           </div>
         ))}
       </CardContent>
     </Card>
   );
 }
