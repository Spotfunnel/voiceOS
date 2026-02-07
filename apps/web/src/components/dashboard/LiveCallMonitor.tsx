'use client';

import React from 'react';
import { PhoneCall, Radio } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

interface LiveCallMonitorProps {
  callId: string;
}

export function LiveCallMonitor({ callId }: LiveCallMonitorProps) {
  return (
    <Card className="border-border shadow-md">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Live Call in Progress</p>
            <p className="text-xs text-muted-foreground">Call ID: {callId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Radio className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-semibold">Live</span>
        </div>
      </CardContent>
    </Card>
  );
}
