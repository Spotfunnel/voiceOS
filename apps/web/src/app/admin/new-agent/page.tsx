'use client';

import OnboardingWizard from '@/components/wizard/OnboardingWizard';
import { DashboardLayout } from '@/shared_ui/components/DashboardLayout';

export default function Page() {
  return (
    <DashboardLayout activeResult="new_agent">
      <OnboardingWizard embedded />
    </DashboardLayout>
  );
}
