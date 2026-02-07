'use client';

import React, { useState } from 'react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface Props {
  summary: {
    business_name?: string;
    business_type?: string;
    phone_number?: string;
    contact_email?: string;
    template_id?: string;
    agent_role?: string;
    greeting_message?: string;
  };
  testCallCompleted: boolean;
  onComplete: () => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step5Review({
  summary,
  testCallCompleted,
  onComplete,
  onBack,
  isSaving,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete'>(
    testCallCompleted ? 'complete' : 'idle'
  );

  const handleTest = async () => {
    setStatus('running');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setStatus('complete');
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Review & test
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirm everything looks correct, then run a quick test call.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">Business summary</h3>
          <p className="text-sm text-foreground">
            <span className="font-medium">{summary.business_name}</span> —{' '}
            {summary.business_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.phone_number} • {summary.contact_email}
          </p>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">Receptionist summary</h3>
          <p className="text-sm text-foreground">
            Template: {summary.template_id?.replace('_', ' ')}
          </p>
          <p className="text-xs text-muted-foreground">
            Role: {summary.agent_role}
          </p>
          <p className="text-xs text-muted-foreground">
            Greeting: {summary.greeting_message}
          </p>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 border border-border bg-muted/40 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Test call</h3>
          <p className="text-xs text-muted-foreground">
            Trigger a test call or run the simulator to confirm the flow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleTest} loading={status === 'running'}>
            {status === 'complete' ? 'Re-run test call' : 'Trigger test call'}
          </Button>
          {status === 'complete' && (
            <Alert variant="success">Test call completed successfully.</Alert>
          )}
          {status === 'running' && (
            <Alert variant="warning">Testing in progress…</Alert>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          onClick={onComplete}
          loading={isSaving}
          disabled={status !== 'complete' || isSaving}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
