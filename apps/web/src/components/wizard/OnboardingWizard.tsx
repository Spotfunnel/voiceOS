'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Step1BusinessInfo from './Step1BusinessInfo';
import Step2PersonaPurpose from './Step2PersonaPurpose';
import Step3Dashboard from './Step3Dashboard';
import Step4Tools from './Step4Tools';
import Step6Telephony from './Step6Telephony';
import WizardLayout from './WizardLayout';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';

interface OnboardingSession {
  session_id: string;
  current_step: number;
  business_name?: string;
  industry?: string;
  business_description?: string;
  system_prompt?: string;
  knowledge_base?: string;
  knowledge_bases?: Array<{
    id?: string;
    name: string;
    description: string;
    content: string;
    filler_text?: string;
  }>;
  n8n_workflows?: Array<{
    name: string;
    webhook_url: string;
    workflow_url: string;
    payload_template?: string;
  }>;
  dashboard_reasons?: string[];
  dashboard_outcomes?: Array<{
    label: string;
    action_required: boolean;
    pipeline_values: string[];
  }>;
  dashboard_report_fields?: Array<{
    id: string;
    label: string;
    required: boolean;
    global: boolean;
  }>;
  pipeline_values?: Array<{
    id: string;
    name: string;
    value: string;
  }>;
  stress_test_completed?: boolean;
  phone_number?: string;
  telnyx_api_key?: string;
  telnyx_connection_id?: string;
  telnyx_phone_number?: string;
  voice_webhook_url?: string;
  status_callback_url?: string;
  transfer_contact_name?: string;
  transfer_contact_title?: string;
  transfer_contact_phone?: string;
  is_live: boolean;
}

interface OnboardingWizardProps {
  embedded?: boolean;
}

export default function OnboardingWizard({ embedded = false }: OnboardingWizardProps) {
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

  const completeTelephony = async (data: any) => {
    const ok = await updateStep(6, data);
    if (ok) {
      await completeOnboarding();
    }
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const steps = [
    { id: 1, title: 'Identity', subtitle: 'Company profile' },
    { id: 2, title: 'Persona & Purpose', subtitle: 'Prompt + knowledge' },
    { id: 3, title: 'Dashboard', subtitle: 'Signals' },
    { id: 4, title: 'Tools', subtitle: 'n8n + email' },
    { id: 5, title: 'Telephony', subtitle: 'Telnyx setup' },
  ];

  return (
    <WizardLayout steps={steps} currentStep={currentStep} embedded={embedded}>
      {error && <Alert variant="error">{error}</Alert>}
      {currentStep === 1 && (
        <Step1BusinessInfo
          data={{
            business_name: session.business_name,
            industry: session.industry,
            business_description: session.business_description,
          }}
          onNext={nextStep}
          isSaving={saving}
        />
      )}
      {currentStep === 2 && (
        <Step2PersonaPurpose
          systemPrompt={session.system_prompt}
          knowledgeBase={session.knowledge_base}
          knowledgeBases={session.knowledge_bases}
          onNext={nextStep}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 3 && (
        <Step3Dashboard
          reasons={session.dashboard_reasons}
          outcomes={session.dashboard_outcomes}
          reportFields={session.dashboard_report_fields}
          pipelineValues={session.pipeline_values}
          onNext={nextStep}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 4 && (
        <Step4Tools
          workflows={session.n8n_workflows}
          onNext={nextStep}
          onBack={prevStep}
          isSaving={saving}
        />
      )}
      {currentStep === 5 && (
        <Step6Telephony
          phoneNumber={session.phone_number}
          telnyxApiKey={session.telnyx_api_key}
          telnyxConnectionId={session.telnyx_connection_id}
          telnyxPhoneNumber={session.telnyx_phone_number}
          voiceWebhookUrl={session.voice_webhook_url}
          statusCallbackUrl={session.status_callback_url}
          transferContactName={session.transfer_contact_name}
          transferContactTitle={session.transfer_contact_title}
          transferContactPhone={session.transfer_contact_phone}
          onNext={completeTelephony}
          onBack={prevStep}
          isSaving={completing}
        />
      )}
    </WizardLayout>
  );
}
