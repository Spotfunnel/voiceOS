import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Step1BusinessInfo from "./Step1BusinessInfo";
import Step2TemplateSelection from "./Step2TemplateSelection";
import Step3Customization from "./Step3Customization";
import Step4TestCall from "./Step4TestCall";
import Step5GoLive from "./Step5GoLive";

interface OnboardingSession {
  session_id: string;
  current_step: number;
  business_name?: string;
  phone_number?: string;
  contact_email?: string;
  template_id?: string;
  customizations?: any;
  test_call_completed: boolean;
  is_live: boolean;
}

export default function OnboardingWizard() {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    const response = await fetch("/api/onboarding/start", { method: "POST" });
    const data = await response.json();
    setSession(data);
    setLoading(false);
  };

  const updateStep = async (step: number, data: any) => {
    if (!session) return;
    const response = await fetch(`/api/onboarding/${session.session_id}/step/${step}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await response.json();
    setSession(updated);
  };

  const nextStep = async (data: any) => {
    await updateStep(currentStep, data);
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const completeOnboarding = async () => {
    if (!session) return;
    const response = await fetch(`/api/onboarding/${session.session_id}/complete`, {
      method: "POST",
    });
    const result = await response.json();
    navigate(`/dashboard/${result.tenant_id}`);
  };

  if (loading || !session) {
    return <div>Loading...</div>;
  }

  return (
    <div className="onboarding-wizard">
      <div className="wizard-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(currentStep / 5) * 100}%` }} />
        </div>
        <div className="step-indicators">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`step ${step === currentStep ? "active" : step < currentStep ? "completed" : ""}`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        {currentStep === 1 && (
          <Step1BusinessInfo
            data={{
              business_name: session.business_name,
              phone_number: session.phone_number,
              contact_email: session.contact_email,
            }}
            onNext={nextStep}
          />
        )}
        {currentStep === 2 && (
          <Step2TemplateSelection selectedTemplate={session.template_id} onNext={nextStep} onBack={prevStep} />
        )}
        {currentStep === 3 && (
          <Step3Customization
            templateId={session.template_id!}
            customizations={session.customizations}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 4 && (
          <Step4TestCall
            phoneNumber={session.phone_number || ""}
            onComplete={() => nextStep({ completed: true })}
            onBack={prevStep}
          />
        )}
        {currentStep === 5 && (
          <Step5GoLive tenantName={session.business_name || ""} onGoLive={completeOnboarding} onBack={prevStep} />
        )}
      </div>
    </div>
  );
}
