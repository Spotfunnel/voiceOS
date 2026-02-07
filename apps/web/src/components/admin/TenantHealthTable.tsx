 'use client';
 
 import React, { useMemo, useState } from 'react';
 import { Badge } from '@/components/ui/Badge';
 import { Button } from '@/components/ui/Button';
 import { Input } from '@/components/ui/Input';
 import { Select } from '@/components/ui/Select';
 import { TenantHealthRow } from '@/contexts/AdminDataContext';
 
 interface TenantHealthTableProps {
   tenants: TenantHealthRow[];
   onViewTenant?: (tenantId: string) => void;
 }
 
 const STATUS_LABELS: Record<TenantHealthRow['status'], string> = {
   healthy: 'Healthy',
   warning: 'Warning',
   critical: 'Critical',
   inactive: 'Inactive',
 };
 
const STATUS_VARIANTS: Record<TenantHealthRow['status'], 'default' | 'success' | 'warning' | 'info'> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'warning',
  inactive: 'default',
};
 
 export function TenantHealthTable({ tenants, onViewTenant }: TenantHealthTableProps) {
   const [searchQuery, setSearchQuery] = useState('');
   const [statusFilter, setStatusFilter] = useState<TenantHealthRow['status'] | 'all'>('all');
 
   const filtered = useMemo(() => {
     const query = searchQuery.toLowerCase();
     return tenants.filter((tenant) => {
       if (statusFilter !== 'all' && tenant.status !== statusFilter) {
         return false;
       }
       if (!query) return true;
       return (
         tenant.business_name.toLowerCase().includes(query) ||
         tenant.tenant_id.toLowerCase().includes(query)
       );
     });
   }, [searchQuery, statusFilter, tenants]);
 
   return (
     <div className="rounded-xl border border-border bg-card">
       <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
         <div>
           <h3 className="text-sm font-semibold">Tenant Health</h3>
           <p className="text-xs text-muted-foreground">Cross-tenant view for noisy neighbor detection</p>
         </div>
         <div className="flex flex-1 flex-col gap-2 md:max-w-xl md:flex-row">
           <Input
             placeholder="Search by tenant or ID..."
             value={searchQuery}
             onChange={(event) => setSearchQuery(event.target.value)}
           />
           <Select
             value={statusFilter}
             onChange={(event) =>
               setStatusFilter(event.target.value as TenantHealthRow['status'] | 'all')
             }
           >
             <option value="all">All Statuses</option>
             <option value="healthy">Healthy</option>
             <option value="warning">Warning</option>
             <option value="critical">Critical</option>
             <option value="inactive">Inactive</option>
           </Select>
         </div>
       </div>
       <div className="overflow-x-auto">
         <table className="min-w-full text-sm">
           <thead className="bg-muted/40 text-xs text-muted-foreground">
             <tr>
               <th className="px-4 py-3 text-left">Tenant</th>
               <th className="px-4 py-3 text-left">Status</th>
               <th className="px-4 py-3 text-left">Calls (1h)</th>
               <th className="px-4 py-3 text-left">Calls Today</th>
               <th className="px-4 py-3 text-left">Cap Usage</th>
               <th className="px-4 py-3 text-left">Last Call</th>
               <th className="px-4 py-3 text-left">Actions</th>
             </tr>
           </thead>
           <tbody>
             {filtered.map((tenant) => (
               <tr key={tenant.tenant_id} className="border-t border-border">
                 <td className="px-4 py-3">
                   <div>
                     <p className="font-semibold text-foreground">{tenant.business_name}</p>
                     <p className="text-xs text-muted-foreground">{tenant.tenant_id}</p>
                   </div>
                 </td>
                 <td className="px-4 py-3">
                   <Badge
                     variant={STATUS_VARIANTS[tenant.status]}
                     className={tenant.status === 'critical' ? 'bg-destructive/10 text-destructive' : undefined}
                   >
                     {STATUS_LABELS[tenant.status]}
                   </Badge>
                 </td>
                 <td className="px-4 py-3">{tenant.calls_last_hour}</td>
                 <td className="px-4 py-3">{tenant.calls_today}</td>
                 <td className="px-4 py-3">
                   {Math.round(tenant.cap_utilization * 100)}% ({tenant.minutes_used_month}/{tenant.cap_soft} min)
                 </td>
                 <td className="px-4 py-3">{tenant.last_call_time ?? '—'}</td>
                 <td className="px-4 py-3">
                   <Button size="sm" variant="outline" onClick={() => onViewTenant?.(tenant.tenant_id)}>
                     View
                   </Button>
                 </td>
               </tr>
             ))}
             {filtered.length === 0 && (
               <tr>
                 <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                   No tenants match current filters.
                 </td>
               </tr>
             )}
           </tbody>
         </table>
       </div>
     </div>
   );
 }
