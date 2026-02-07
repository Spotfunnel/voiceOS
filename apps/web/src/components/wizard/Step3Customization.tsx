'use client';

import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface Props {
  templateId: string;
  customizations: any;
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step3Customization({
  templateId,
  customizations,
  onNext,
  onBack,
  isSaving,
}: Props) {
  const [formData, setFormData] = useState({
    agent_role: customizations?.agent_role || 'Receptionist',
    agent_personality:
      customizations?.agent_personality ||
      'Warm, concise, helpful, and confident.',
    greeting_message:
      customizations?.greeting_message ||
      'Hello! You have reached {{business_name}}. How can I help today?',
    system_prompt:
      customizations?.system_prompt ||
      'You are the front desk receptionist for {{business_name}}. Capture key details, confirm critical information, and keep the caller informed.',
  });

  const preview = useMemo(
    () => ({
      role: formData.agent_role,
      personality: formData.agent_personality,
      greeting: formData.greeting_message,
    }),
    [formData]
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext(formData);
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Customize your receptionist
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tune the voice, role, and greeting. We will layer this on top of the
          core receptionist behavior.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent role</label>
            <Input
              value={formData.agent_role}
              onChange={(event) =>
                setFormData({ ...formData, agent_role: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Personality</label>
            <Textarea
              rows={3}
              value={formData.agent_personality}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  agent_personality: event.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Greeting message</label>
            <Textarea
              rows={3}
              value={formData.greeting_message}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  greeting_message: event.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">System prompt override</label>
            <Textarea
              rows={4}
              value={formData.system_prompt}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  system_prompt: event.target.value,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              This merges into Layer 2 prompts. Keep it short and specific.
            </p>
          </div>
        </div>

        <Card className="flex flex-col gap-4 border border-border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Preview
          </h3>
          <div className="rounded-lg bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Role
            </p>
            <p className="text-base font-semibold text-foreground">
              {preview.role}
            </p>
          </div>
          <div className="rounded-lg bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Personality
            </p>
            <p className="text-sm text-foreground">{preview.personality}</p>
          </div>
          <div className="rounded-lg bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Greeting
            </p>
            <p className="text-sm text-foreground">{preview.greeting}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Template: {templateId.replace('_', ' ')}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={isSaving} disabled={isSaving}>
          Continue
        </Button>
      </div>
    </form>
  );
}
