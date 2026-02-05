'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Step1BusinessInfo from './Step1BusinessInfo';
import Step2TemplateSelection from './Step2TemplateSelection';
import Step3Customization from './Step3Customization';
import Step4Knowledge from './Step4Knowledge';
import Step5Review from './Step5Review';
import Step6GoLive from './Step6GoLive';
import WizardLayout from './WizardLayout';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';

interface OnboardingSession {
  session_id: string;
  current_step: number;
  business_name?: string;
  business_type?: string;
  phone_number?: string;
  contact_email?: string;
  state?: string;
  timezone?: string;
  business_hours?: string;
  template_id?: string;
  customizations?: {
    agent_role?: string;
    agent_personality?: string;
    greeting_message?: string;
    system_prompt?: string;
  };
  static_knowledge?: string;
  test_call_completed: boolean;
  is_live: boolean;
}

export default function OnboardingWizard() {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    try {
      const response = await fetch('/api/onboarding/start', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.detail || 'Failed to start onboarding.');
        return;
      }
      setSession(data);
      setCurrentStep(data.current_step || 1);
    } catch (err) {
      setError('Unable to connect. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateStep = async (step: number, data: any) => {
    if (!session) return;
    setSaving(true);
    const response = await fetch(
      `/api/onboarding/${session.session_id}/step/${step}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    const updated = await response.json();
    if (!response.ok) {
      setError(updated?.detail || 'Unable to save your progress.');
      setSaving(false);
      return false;
    }
    setSession(updated);
    setError(null);
    setSaving(false);
    return true;
  };

  const nextStep = async (data: any) => {
    const ok = await updateStep(currentStep, data);
    if (ok) {
      setCurrentStep((prev) => Math.min(6, prev + 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const completeOnboarding = async () => {
    if (!session) return;
    setCompleting(true);
    const response = await fetch(
      `/api/onboarding/${session.session_id}/complete`,
      {
        method: 'POST',
      }
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result?.detail || 'Unable to complete onboarding.');
      setCompleting(false);
      return;
    }
    setError(null);
    setCompleting(false);
    router.push(`/dashboard/${result.tenant_id}`);
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const steps = [
    { id: 1, title: 'Business', subtitle: 'Core details' },
    { id: 2, title: 'Template', subtitle: 'Choose a flow' },
    { id: 3, title: 'Customize', subtitle: 'Tune the agent' },
    { id: 4, title: 'Knowledge', subtitle: 'Add facts' },
    { id: 5, title: 'Review', subtitle: 'Test & confirm' },
    { id: 6, title: 'Go live', subtitle: 'Activate routing' },
  ];

  return (
    <WizardLayout steps={steps} currentStep={currentStep}>
      {error && <Alert variant="error">{error}</Alert>}
      {currentStep === 1 && (
        <Step1BusinessInfo
          data={{
            business_name: session.business_name,
            business_type: session.business_type,
            phone_number: session.phone_number,
            contact_email: session.contact_email,
            state: session.state,
            timezone: session.timezone,
            business_hours: session.business_hours,
          }}
          onNext={nextStep}
          isSaving={saving}
        />
      )}
      {currentStep === 2 && (
        <Step2TemplateSelection
          selectedTemplate={session.template_id}
          onNext={nextStep}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 3 && (
        <Step3Customization
          templateId={session.template_id || 'lead_capture'}
          customizations={session.customizations}
          onNext={nextStep}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 4 && (
        <Step4Knowledge
          knowledge={session.static_knowledge}
          onNext={nextStep}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 5 && (
        <Step5Review
          summary={{
            business_name: session.business_name,
            business_type: session.business_type,
            phone_number: session.phone_number,
            contact_email: session.contact_email,
            template_id: session.template_id,
            agent_role: session.customizations?.agent_role,
            greeting_message: session.customizations?.greeting_message,
          }}
          testCallCompleted={session.test_call_completed}
          onComplete={() => nextStep({ test_call_completed: true })}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 6 && (
        <Step6GoLive
          tenantName={session.business_name || ''}
          onGoLive={completeOnboarding}
          onBack={prevStep}
          isSaving={completing}
        />
      )}
    </WizardLayout>
  );
}
