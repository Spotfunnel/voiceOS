'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

// Call type matching voice-core schema
export type Call = {
  id: string;
  created_at: string;
  tenant_id?: string;
  customer_phone: string;
  call_id?: string;
  caller_name?: string;
  booking_status?: string;
  summary?: string;
  transcript?: string;
  intent?: string;
  resolution_status?: string;
  date?: string;
  called_at?: string;
  customer_address?: string;
  customer_email?: string;
  archived?: boolean;
  status?: 'incoming' | 'completed' | 'booked';
  duration?: number;
  recording_url?: string;
  analysis?: string;
  labels?: string[];
  cost?: number;
  outcome?: string;
  timestamp?: string;
  appointment_date?: string;
  appointment_time?: string;
};

export type DashboardEvent = {
  id: string;
  type: string;
  title: string;
  details: string;
  timestamp: Date;
};

type DataContextType = {
  calls: Call[];
  events: DashboardEvent[];
  pendingJobs: number;
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  updateCall: (id: string, updates: Partial<Call>) => Promise<void>;
  archiveCalls: (ids: string[]) => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const convertCallsToEvents = (callsData: Call[]): DashboardEvent[] => {
    return callsData
      .map((call) => {
        const type = call.booking_status || 'unknown';
        const title = call.intent
          ? call.intent
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          : 'New Interaction';

        return {
          id: call.id,
          type,
          title,
          details: `${call.customer_phone}${call.caller_name ? ' • ' + call.caller_name : ''}`,
          timestamp: new Date(call.created_at),
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch calls from FastAPI backend
      const response = await fetch('/api/calls', {
        credentials: 'include', // Include session cookie
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calls: ${response.statusText}`);
      }

      const data = await response.json();
      const callsData = data.calls || [];

      setCalls(callsData);
      setEvents(convertCallsToEvents(callsData));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      toast.error('Error loading data', { description: errorMessage });
      console.error('Error fetching data:', err);
      setCalls([]);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCall = async (id: string, updates: Partial<Call>) => {
    try {
      const response = await fetch(`/api/calls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update call');
      }

      // Optimistic update
      setCalls((current) => current.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      toast.success('Call updated');
    } catch (err) {
      console.error('Error updating call:', err);
      toast.error('Failed to update call');
    }
  };

  const archiveCalls = async (ids: string[]) => {
    try {
      const response = await fetch('/api/calls/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive calls');
      }

      // Remove archived calls from state
      setCalls((current) => current.filter((c) => !ids.includes(c.id)));
      toast.success(`${ids.length} call${ids.length > 1 ? 's' : ''} archived`);
    } catch (err) {
      console.error('Error archiving calls:', err);
      toast.error('Failed to archive calls');
    }
  };

  useEffect(() => {
    fetchData();

    // Set up WebSocket connection for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/calls`;
    
    let ws: WebSocket;
    
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_call' || data.type === 'call_updated') {
            fetchData(); // Refresh on new call or update
            if (data.type === 'new_call') {
              toast.info('New Call', {
                description: data.call?.customer_phone || 'Incoming call',
              });
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
    } catch (err) {
      console.error('Failed to establish WebSocket connection:', err);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Calculate pending jobs
  const pendingJobs = calls.filter((c) => c.booking_status === 'booked').length;

  return (
    <DataContext.Provider
      value={{
        calls,
        events,
        pendingJobs,
        isLoading,
        error,
        fetchData,
        updateCall,
        archiveCalls,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
