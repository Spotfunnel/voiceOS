 'use client';
 
 import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
 
 export type HealthStatus = 'healthy' | 'warning' | 'critical';
 export type TenantStatus = 'healthy' | 'warning' | 'critical' | 'inactive';
 
 export interface GlobalHealthMetrics {
   status: HealthStatus;
   active_calls: number;
   calls_today: number;
   success_rate: number;
   error_rate: number;
   p95_latency_ms: number;
   stt_success_rate: number;
   llm_success_rate: number;
   tts_success_rate: number;
   telephony_success_rate: number;
   tool_failure_rate: number;
   escalation_rate: number;
   timestamp: string;
 }
 
 export interface TenantHealthRow {
   tenant_id: string;
   business_name: string;
   status: TenantStatus;
   calls_last_hour: number;
   calls_today: number;
   cost_today: number;
   minutes_used_month: number;
   cap_soft: number;
   cap_hard: number;
   cap_utilization: number;
   cap_proximity: 'safe' | 'warning' | 'critical';
   last_call_time: string | null;
   last_error_time: string | null;
   error_rate_last_hour: number;
 }
 
 export interface CostMetrics {
   current_hour: number;
   today: number;
   month: number;
   projected_month: number;
   threshold_hour: number;
   threshold_status: 'safe' | 'warning' | 'critical';
   breakdown: {
     stt: number;
     llm: number;
     tts: number;
     telephony: number;
   };
 }
 
 export interface SystemAlert {
   id: string;
   severity: 'warning' | 'critical';
   type: 'provider_degradation' | 'cost_spike' | 'latency_spike' | 'cap_approaching';
   message: string;
   details?: string;
   timestamp: string;
   drill_down_link?: string;
 }
 
 interface AdminDataContextValue {
   health: GlobalHealthMetrics | null;
   tenants: TenantHealthRow[];
   cost: CostMetrics | null;
   alerts: SystemAlert[];
   isLoading: boolean;
   error: string | null;
   refreshAll: () => Promise<void>;
 }
 
 const AdminDataContext = createContext<AdminDataContextValue | undefined>(undefined);
 
 const DEFAULT_COST: CostMetrics = {
   current_hour: 0,
   today: 0,
   month: 0,
   projected_month: 0,
   threshold_hour: 100,
   threshold_status: 'safe',
   breakdown: {
     stt: 0,
     llm: 0,
     tts: 0,
     telephony: 0,
   },
 };
 
 export function AdminDataProvider({ children }: { children: React.ReactNode }) {
   const [health, setHealth] = useState<GlobalHealthMetrics | null>(null);
   const [tenants, setTenants] = useState<TenantHealthRow[]>([]);
   const [cost, setCost] = useState<CostMetrics | null>(DEFAULT_COST);
   const [alerts, setAlerts] = useState<SystemAlert[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   const fetchJson = useCallback(async <T,>(url: string): Promise<T> => {
     const response = await fetch(url);
     if (!response.ok) {
       throw new Error(`Request failed: ${response.status}`);
     }
     return response.json() as Promise<T>;
   }, []);
 
   const refreshAll = useCallback(async () => {
     setIsLoading(true);
     setError(null);
     try {
       const [healthData, tenantsData, costData, alertsData] = await Promise.all([
         fetchJson<GlobalHealthMetrics>('/api/admin/operations/health'),
         fetchJson<TenantHealthRow[]>('/api/admin/operations/tenants'),
         fetchJson<CostMetrics>('/api/admin/operations/cost'),
         fetchJson<SystemAlert[]>('/api/admin/operations/alerts'),
       ]);
 
       setHealth(healthData);
       setTenants(tenantsData);
       setCost(costData);
       setAlerts(alertsData);
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to load admin metrics');
     } finally {
       setIsLoading(false);
     }
   }, [fetchJson]);
 
   useEffect(() => {
     refreshAll();
   }, [refreshAll]);
 
   useEffect(() => {
     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sessionToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('session_token='))
      ?.split('=')[1];
    const tokenQuery = sessionToken ? `?session_token=${encodeURIComponent(sessionToken)}` : '';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/admin/operations${tokenQuery}`;
     const ws = new WebSocket(wsUrl);
 
     ws.onmessage = (event) => {
       try {
         const message = JSON.parse(event.data);
         if (message?.health) {
           setHealth(message.health);
         }
         if (message?.tenants) {
           setTenants(message.tenants);
         }
         if (message?.cost) {
           setCost(message.cost);
         }
         if (message?.alerts) {
           setAlerts(message.alerts);
         }
       } catch (err) {
         console.warn('Failed to parse operations websocket message', err);
       }
     };
 
     ws.onerror = () => {
       // Non-fatal; fallback to polling via refreshAll
     };
 
     return () => {
       ws.close();
     };
   }, []);
 
   const value = useMemo(
     () => ({
       health,
       tenants,
       cost,
       alerts,
       isLoading,
       error,
       refreshAll,
     }),
     [alerts, cost, error, health, isLoading, refreshAll, tenants]
   );
 
   return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
 }
 
 export function useAdminData() {
   const context = useContext(AdminDataContext);
   if (!context) {
     throw new Error('useAdminData must be used within AdminDataProvider');
   }
   return context;
 }
