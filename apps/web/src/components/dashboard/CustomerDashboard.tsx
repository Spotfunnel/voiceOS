'use client';

import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { DashboardDataProvider } from '@/contexts/DashboardDataContext';
import { DashboardLayout } from './DashboardLayout';
import { OverviewTab } from './OverviewTab';
import { ActionRequiredTab } from './ActionRequiredTab';
import { ConfigurationTab } from './ConfigurationTab';
import { useDashboardData } from '@/contexts/DashboardDataContext';

interface CustomerDashboardProps {
  tenantId: string;
  role: 'customer' | 'operator';
  tenantName?: string | null;
}

function DashboardShell({ role, tenantName }: Pick<CustomerDashboardProps, 'role' | 'tenantName'>) {
  const { metrics, error } = useDashboardData();

  return (
    <>
      {role === 'operator' && (
        <div className="container mx-auto px-4 pt-6">
          <Alert variant="warning">
            Viewing as: {tenantName || 'Selected Tenant'} (Operator Mode)
          </Alert>
        </div>
      )}

      {error && (
        <div className="container mx-auto px-4 pt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <DashboardLayout actionCount={metrics.action_required}>
        {(activeTab) => {
          if (activeTab === 'action-required') return <ActionRequiredTab />;
          if (activeTab === 'configuration') return <ConfigurationTab />;
          return <OverviewTab />;
        }}
      </DashboardLayout>
    </>
  );
}

export default function CustomerDashboard({ tenantId, role, tenantName }: CustomerDashboardProps) {
  return (
    <DashboardDataProvider tenantId={tenantId}>
      <DashboardShell role={role} tenantName={tenantName} />
    </DashboardDataProvider>
  );
}
