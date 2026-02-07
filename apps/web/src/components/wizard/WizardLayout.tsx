'use client';

import React from 'react';
import { cn } from '../ui/cn';
import { Card } from '../ui/Card';

interface StepMeta {
  id: number;
  title: string;
  subtitle: string;
}

interface WizardLayoutProps {
  steps: StepMeta[];
  currentStep: number;
  children: React.ReactNode;
  embedded?: boolean;
}

export default function WizardLayout({
  steps,
  currentStep,
  children,
  embedded = false,
}: WizardLayoutProps) {
  const progress = Math.round((currentStep / steps.length) * 100);

  return (
    <div className={cn(embedded ? "bg-background" : "min-h-screen bg-background")}>
      <div className={cn("mx-auto max-w-5xl", embedded ? "px-0 py-4" : "px-4 py-10")}>
        <div className="mb-8 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">SpotFunnel Voice AI</p>
            <h1 className="text-3xl font-semibold text-foreground">
              Onboarding Wizard
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Set up a warm, reliable receptionist in minutes.
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => {
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;
              return (
                <Card
                  key={step.id}
                  className={cn(
                    'border px-3 py-3 shadow-sm transition-all duration-200',
                    isActive && 'border-primary/40 shadow-md',
                    isComplete && 'bg-primary/5'
                  )}
                >
                  <div className="text-xs font-semibold text-primary">
                    Step {step.id}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {step.subtitle}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
