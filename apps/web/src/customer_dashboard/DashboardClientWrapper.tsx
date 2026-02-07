'use client';

import React, { useState, useEffect } from 'react';
import { DataProvider } from '@/contexts/DataContext';
import DashboardShell from '@/customer_dashboard/DashboardShell';
import { WelcomeTour } from '@/customer_dashboard/WelcomeTour';

type DashboardClientWrapperProps = {
  children: React.ReactNode;
  userLabel: string | null;
  showWelcomeTour?: boolean;
};

export default function DashboardClientWrapper({ 
  children, 
  userLabel,
  showWelcomeTour = false 
}: DashboardClientWrapperProps) {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Check if user has seen the tour (session storage, not persistent)
    const hasSeenTour = sessionStorage.getItem('hasSeenWelcomeTour');
    
    if (showWelcomeTour && !hasSeenTour) {
      // Small delay to let the dashboard load first
      setTimeout(() => setShowTour(true), 500);
    }
  }, [showWelcomeTour]);

  const handleTourComplete = () => {
    setShowTour(false);
    sessionStorage.setItem('hasSeenWelcomeTour', 'true');
  };

  return (
    <DataProvider>
      <DashboardShell userLabel={userLabel}>
        {children}
      </DashboardShell>
      
      {showTour && <WelcomeTour onComplete={handleTourComplete} />}
    </DataProvider>
  );
}
