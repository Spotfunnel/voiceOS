 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
 import { GlobalHealthMetrics } from '@/contexts/AdminDataContext';
 
 interface ProviderHealthPanelProps {
   health: GlobalHealthMetrics | null;
 }
 
 function formatRate(value?: number) {
   if (value === undefined || value === null) return '—';
   return `${Math.round(value * 1000) / 10}%`;
 }
 
 function statusForRate(value?: number) {
   if (value === undefined || value === null) return 'text-muted-foreground';
   if (value >= 0.98) return 'text-emerald-600';
   if (value >= 0.95) return 'text-amber-600';
   return 'text-rose-600';
 }
 
 export function ProviderHealthPanel({ health }: ProviderHealthPanelProps) {
   const providers = [
     { label: 'STT Provider', value: health?.stt_success_rate },
     { label: 'LLM Provider', value: health?.llm_success_rate },
     { label: 'TTS Provider', value: health?.tts_success_rate },
     { label: 'Telephony', value: health?.telephony_success_rate },
   ];
 
   return (
     <Card className="border-border shadow-sm">
       <CardHeader>
         <CardTitle className="text-sm font-semibold">Provider Health</CardTitle>
       </CardHeader>
       <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
         {providers.map((provider) => (
           <div key={provider.label} className="rounded-lg border border-border/60 p-3">
             <p className="text-xs text-muted-foreground">{provider.label}</p>
             <p className={`text-lg font-semibold ${statusForRate(provider.value)}`}>
               {formatRate(provider.value)}
             </p>
           </div>
         ))}
       </CardContent>
     </Card>
   );
 }
