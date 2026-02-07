'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface Props {
  data: {
    business_name?: string;
    industry?: string;
    business_description?: string;
  };
  onNext: (data: any) => void;
  isSaving?: boolean;
}

export default function Step1BusinessInfo({ data, onNext, isSaving }: Props) {
  const [formData, setFormData] = useState({
    business_name: data.business_name || '',
    industry: data.industry || '',
    business_description: data.business_description || '',
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Identity
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Set the company identity the agent will represent.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Business name</label>
          <Input
            required
            value={formData.business_name}
            onChange={(event) =>
              setFormData({ ...formData, business_name: event.target.value })
            }
            placeholder="SpotFunnel Plumbing Co."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Industry</label>
          <Input
            required
            value={formData.industry}
            onChange={(event) =>
              setFormData({ ...formData, industry: event.target.value })
            }
            placeholder="Plumbing, HVAC, Solar, Legal"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Company description</label>
        <Textarea
          rows={4}
          value={formData.business_description}
          onChange={(event) =>
            setFormData({ ...formData, business_description: event.target.value })
          }
          placeholder="Describe what your company does, your ideal customer, and how you want the agent to represent you."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSaving} disabled={isSaving}>
          Continue
        </Button>
      </div>
    </form>
  );
}
