'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Types
export interface CallLog {
  id: string;
  call_id: string;
  tenant_id: string;
  caller_phone: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  outcome: 'lead_captured' | 'callback_requested' | 'faq_resolved' | 'escalated' | 'failed' | 'in_progress';
  transcript: string;
  captured_data: {
    name?: string;
    phone?: string;
    email?: string;
    service?: string;
    datetime?: string;
    notes?: string;
  };
  requires_action: boolean;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  created_at: string;
}

export interface DashboardMetrics {
  total_calls: number;
  action_required: number;
  leads_captured: number;
  success_rate: number;
}

export type TimePeriod = 'last-7-days' | 'last-30-days' | 'last-90-days' | 'all-time';

interface DashboardDataContextType {
  // Data
  callLogs: CallLog[];
  metrics: DashboardMetrics;
  liveCallId: string | null;
  
  // Filters
  period: TimePeriod;
  searchQuery: string;
  selectedOutcomes: Set<string>;
  
  // Actions
  setPeriod: (period: TimePeriod) => void;
  setSearchQuery: (query: string) => void;
  toggleOutcome: (outcome: string) => void;
  clearFilters: () => void;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Methods
  fetchData: () => Promise<void>;
  exportCallLog: (callIds: string[]) => Promise<void>;
}

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export function DashboardDataProvider({ children, tenantId }: { children: React.ReactNode; tenantId: string }) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_calls: 0,
    action_required: 0,
    leads_captured: 0,
    success_rate: 0,
  });
  const [liveCallId, setLiveCallId] = useState<string | null>(null);
  
  // Filters
  const [period, setPeriod] = useState<TimePeriod>('last-7-days');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set());
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch call logs and metrics
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dashboard/calls?tenant_id=${tenantId}&period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      
      const data = await response.json();
      setCallLogs(data.calls || []);
      setMetrics((prev) => data.metrics || prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, period]);
  
  // WebSocket for live updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/dashboard/${tenantId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Dashboard WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'call_started') {
        setLiveCallId(message.call_id);
      } else if (message.type === 'call_ended') {
        setLiveCallId(null);
        fetchData(); // Refresh call log
      } else if (message.type === 'call_updated') {
        // Update specific call in real-time
        setCallLogs((prev) =>
          prev.map((call) => (call.call_id === message.call_id ? { ...call, ...message.updates } : call))
        );
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      ws.close();
    };
  }, [tenantId, fetchData]);
  
  // Fetch data on mount and period change
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Filter actions
  const toggleOutcome = (outcome: string) => {
    const newSet = new Set(selectedOutcomes);
    if (newSet.has(outcome)) {
      newSet.delete(outcome);
    } else {
      newSet.add(outcome);
    }
    setSelectedOutcomes(newSet);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedOutcomes(new Set());
  };
  
  // Export functionality
  const exportCallLog = async (callIds: string[]) => {
    try {
      const response = await fetch('/api/dashboard/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, call_ids: callIds }),
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-log-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      throw err;
    }
  };
  
  return (
    <DashboardDataContext.Provider
      value={{
        callLogs,
        metrics,
        liveCallId,
        period,
        searchQuery,
        selectedOutcomes,
        setPeriod,
        setSearchQuery,
        toggleOutcome,
        clearFilters,
        isLoading,
        error,
        fetchData,
        exportCallLog,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return context;
}
