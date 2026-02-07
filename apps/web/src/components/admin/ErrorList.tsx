 import React from 'react';
 import { Button } from '@/components/ui/Button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
 
 interface ErrorListItem {
   id: string;
   tenant: string;
   message: string;
   severity: 'low' | 'medium' | 'high' | 'critical';
   timestamp: string;
 }
 
 const PLACEHOLDER_ERRORS: ErrorListItem[] = [
   {
     id: 'err-1',
     tenant: 'Sydney Plumbing',
     message: 'Capture failure - email validation loop exhausted',
     severity: 'high',
     timestamp: '2026-02-05 14:23',
   },
   {
     id: 'err-2',
     tenant: 'Melbourne HVAC',
     message: 'Integration failure - n8n webhook timeout',
     severity: 'critical',
     timestamp: '2026-02-05 13:45',
   },
 ];
 
 export function ErrorList() {
   return (
     <Card className="border-border shadow-sm">
       <CardHeader>
         <CardTitle className="text-sm font-semibold">Recent Errors</CardTitle>
       </CardHeader>
       <CardContent className="space-y-3">
         {PLACEHOLDER_ERRORS.map((error) => (
           <div key={error.id} className="rounded-lg border border-border/60 p-3">
             <div className="flex items-start justify-between gap-4">
               <div>
                 <p className="text-sm font-semibold text-foreground">{error.message}</p>
                 <p className="text-xs text-muted-foreground">
                   {error.tenant} • {error.timestamp} • Severity: {error.severity}
                 </p>
               </div>
               <div className="flex gap-2">
                 <Button size="sm" variant="outline">
                   View Details
                 </Button>
                 <Button size="sm" variant="outline">
                   Replay
                 </Button>
               </div>
             </div>
           </div>
         ))}
       </CardContent>
     </Card>
   );
 }
