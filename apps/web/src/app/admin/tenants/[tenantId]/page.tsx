 import React from 'react';
 
 interface TenantPageProps {
   params: {
     tenantId: string;
   };
 }
 
 export default function AdminTenantPage({ params }: TenantPageProps) {
   return (
     <div className="space-y-4">
       <h2 className="text-2xl font-semibold">Tenant Drill-Down</h2>
       <p className="text-sm text-muted-foreground">Tenant ID: {params.tenantId}</p>
       <p className="text-sm text-muted-foreground">
         Detailed tenant diagnostics will be wired here.
       </p>
     </div>
   );
 }
