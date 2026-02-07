'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CallLog } from '@/contexts/DashboardDataContext';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CallDetailView } from './CallDetailView';

interface CallLogTableProps {
  calls: CallLog[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  isLoading: boolean;
}

export function CallLogTable({
  calls,
  selectedIds,
  onSelectionChange,
  isLoading,
}: CallLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getOutcomeBadgeVariant = (
    outcome: string
  ): 'default' | 'success' | 'warning' | 'info' => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
      lead_captured: 'success',
      callback_requested: 'info',
      faq_resolved: 'success',
      escalated: 'warning',
      failed: 'warning',
      in_progress: 'info',
    };
    return variants[outcome] || 'default';
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading calls...
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No calls found</p>
        <p className="text-sm">Adjust your filters or period to see more data</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border shadow-md overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 font-semibold text-sm">
        <div className="col-span-1"></div>
        <div className="col-span-3">Caller / Time</div>
        <div className="col-span-2">Duration</div>
        <div className="col-span-2">Outcome</div>
        <div className="col-span-3">Captured Info</div>
        <div className="col-span-1"></div>
      </div>

      <div>
        {calls.map((call) => (
          <div key={call.id}>
            <div className="flex md:grid md:grid-cols-12 items-center gap-4 p-4 border-b hover:bg-muted/30 transition-colors">
              <div className="md:col-span-1">
                <Checkbox
                  checked={selectedIds.has(call.id)}
                  onChange={() => toggleSelection(call.id)}
                />
              </div>

              <div className="flex-1 md:col-span-3">
                <p className="font-semibold">
                  {call.captured_data?.name || 'Unknown Caller'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {call.caller_phone}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(call.start_time))} ago
                </p>
              </div>

              <div className="hidden md:block md:col-span-2">
                <p className="text-sm">
                  {Math.round(call.duration_seconds / 60)} min
                </p>
              </div>

              <div className="md:col-span-2">
                <Badge variant={getOutcomeBadgeVariant(call.outcome)}>
                  {call.outcome.replace('_', ' ')}
                </Badge>
              </div>

              <div className="hidden md:block md:col-span-3 text-sm">
                {call.captured_data?.email && <p>{call.captured_data.email}</p>}
                {call.captured_data?.phone && <p>{call.captured_data.phone}</p>}
                {call.captured_data?.service && (
                  <p className="text-muted-foreground">
                    {call.captured_data.service}
                  </p>
                )}
              </div>

              <div className="md:col-span-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(call.id)}
                >
                  {expandedId === call.id ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {expandedId === call.id && <CallDetailView call={call} />}
          </div>
        ))}
      </div>
    </div>
  );
}
