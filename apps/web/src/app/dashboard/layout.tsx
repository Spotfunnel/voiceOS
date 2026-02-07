import React from 'react';
import { getDashboardTenant, getServerSession } from '@/server/session';
import DashboardClientWrapper from '@/customer_dashboard/DashboardClientWrapper';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    <DashboardClientWrapper userLabel={session.tenantName || 'Customer'}>
      {children}
    </DashboardClientWrapper>
  );
}
