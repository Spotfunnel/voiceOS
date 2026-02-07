'use client';

import React, { useMemo, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { useDashboardData } from '@/contexts/DashboardDataContext';
import { MetricsCards } from './MetricsCards';
import { OutcomeChart } from './OutcomeChart';
import { CallLogTable } from './CallLogTable';
import { PeriodSelector } from './PeriodSelector';
import { LiveCallMonitor } from './LiveCallMonitor';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const OUTCOME_OPTIONS = [
  { id: 'lead_captured', label: 'Lead Captured' },
  { id: 'callback_requested', label: 'Callback Requested' },
  { id: 'faq_resolved', label: 'FAQ Resolved' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'failed', label: 'Failed' },
  { id: 'in_progress', label: 'In Progress' },
];

export function OverviewTab() {
  const {
    callLogs,
    metrics,
    liveCallId,
    period,
    setPeriod,
    searchQuery,
    setSearchQuery,
    selectedOutcomes,
    toggleOutcome,
    clearFilters,
    isLoading,
    exportCallLog,
  } = useDashboardData();

  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());

  const filteredCalls = useMemo(() => {
    let filtered = callLogs;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((call) => {
        const name = call.captured_data?.name?.toLowerCase() || '';
        const email = call.captured_data?.email?.toLowerCase() || '';
        const transcript = call.transcript?.toLowerCase() || '';
        return (
          call.caller_phone.includes(query) ||
          name.includes(query) ||
          email.includes(query) ||
          transcript.includes(query)
        );
      });
    }

    if (selectedOutcomes.size > 0) {
      filtered = filtered.filter((call) => selectedOutcomes.has(call.outcome));
    }

    return filtered;
  }, [callLogs, searchQuery, selectedOutcomes]);

  const handleExport = async () => {
    const idsToExport =
      selectedCallIds.size > 0
        ? Array.from(selectedCallIds)
        : filteredCalls.map((call) => call.id);
    if (idsToExport.length === 0) return;
    await exportCallLog(idsToExport);
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your voice AI performance
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {liveCallId && <LiveCallMonitor callId={liveCallId} />}

      <MetricsCards metrics={metrics} />

      <OutcomeChart calls={filteredCalls} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone, name, email, or transcript..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {OUTCOME_OPTIONS.map((option) => {
            const isActive = selectedOutcomes.has(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleOutcome(option.id)}
                className="transition-all duration-200"
              >
                <Badge
                  variant={isActive ? 'success' : 'default'}
                  className={isActive ? 'shadow-md' : ''}
                >
                  {option.label}
                </Badge>
              </button>
            );
          })}
          {selectedOutcomes.size > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={filteredCalls.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <CallLogTable
        calls={filteredCalls}
        selectedIds={selectedCallIds}
        onSelectionChange={setSelectedCallIds}
        isLoading={isLoading}
      />

      {selectedCallIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-auto">
          <div className="bg-primary text-primary-foreground shadow-xl rounded-xl p-4 flex items-center gap-3">
            <span className="font-semibold">
              {selectedCallIds.size} selected
            </span>
            <Button size="sm" variant="secondary" onClick={handleExport}>
              Export Selected
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedCallIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
