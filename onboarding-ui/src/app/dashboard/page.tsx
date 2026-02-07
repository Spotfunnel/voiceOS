import React from 'react';
import CustomerDashboard from '@/components/dashboard/CustomerDashboard';
import { getDashboardTenant, getServerSession } from '@/server/session';

export default function DashboardPage() {
  const session = getServerSession();
  const tenantId = getDashboardTenant(session);

  if (!tenantId) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-sm">
          Missing tenant context. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <CustomerDashboard
      tenantId={tenantId}
      role={session.role}
      tenantName={session.tenantName}
    />
  );
}
