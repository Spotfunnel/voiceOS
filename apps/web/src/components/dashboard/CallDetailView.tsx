'use client';

import React from 'react';
import {
  Phone,
  Mail,
  Calendar,
  User,
  MessageSquare,
} from 'lucide-react';
import { CallLog } from '@/contexts/DashboardDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface CallDetailViewProps {
  call: CallLog;
}

export function CallDetailView({ call }: CallDetailViewProps) {
  return (
    <div className="bg-muted/20 p-6 border-b space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Captured Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {call.captured_data?.name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{call.captured_data.name}</span>
              </div>
            )}
            {call.captured_data?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{call.captured_data.phone}</span>
              </div>
            )}
            {call.captured_data?.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{call.captured_data.email}</span>
              </div>
            )}
            {call.captured_data?.datetime && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{call.captured_data.datetime}</span>
              </div>
            )}
            {call.captured_data?.service && (
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span>{call.captured_data.service}</span>
              </div>
            )}
            {call.captured_data?.notes && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                <p>{call.captured_data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Call Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Call ID:</span>{' '}
              {call.call_id}
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span>{' '}
              {Math.round(call.duration_seconds / 60)} minutes
            </div>
            <div>
              <span className="text-muted-foreground">Start Time:</span>{' '}
              {new Date(call.start_time).toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">Priority:</span>{' '}
              {call.priority}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Full Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-4 rounded-lg max-h-96 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {call.transcript || 'No transcript available'}
            </pre>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => window.open(`tel:${call.caller_phone}`)}
        >
          Call Back
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(call.transcript)}
        >
          Copy Transcript
        </Button>
        {call.requires_action && (
          <Button size="sm" variant="secondary">
            Mark Resolved
          </Button>
        )}
      </div>
    </div>
  );
}
