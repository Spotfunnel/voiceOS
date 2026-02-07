'use client';

import React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface Template {
  id: string;
  name: string;
  description: string;
  highlights: string[];
  badge?: string;
}

interface Props {
  selectedTemplate?: string;
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

const templates: Template[] = [
  {
    id: 'lead_capture',
    name: 'Lead Capture',
    description: 'Capture leads, validate details, and hand off to your team.',
    highlights: ['Lead intake', 'FAQ support', 'Quick handoff'],
    badge: 'Fast start',
  },
  {
    id: 'appointment_booking',
    name: 'Appointment Booking',
    description: 'Book appointments with availability windows and reminders.',
    highlights: ['Calendar-ready', 'Callback scheduling', 'Status summary'],
    badge: 'Most popular',
  },
  {
    id: 'full_receptionist',
    name: 'Full Receptionist',
    description: 'All-in-one receptionist with lead capture + automation.',
    highlights: ['Lead + booking', 'Automations', 'Advanced routing'],
    badge: 'Best value',
  },
];

export default function Step2TemplateSelection({
  selectedTemplate,
  onNext,
  onBack,
  isSaving,
}: Props) {
  const [selected, setSelected] = React.useState(selectedTemplate);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selected) {
      onNext({ template_id: selected });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Choose a starting template
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the flow that matches your business. You can customize everything
          next.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {templates.map((template) => (
          <label key={template.id} className="cursor-pointer">
            <Card
              className={`flex h-full flex-col gap-4 border-2 p-4 transition-all duration-200 ${
                selected === template.id
                  ? 'border-primary shadow-lg'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{template.name}</h3>
                {template.badge && <Badge variant="success">{template.badge}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {template.description}
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {template.highlights.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <input
                type="radio"
                name="template"
                value={template.id}
                checked={selected === template.id}
                onChange={() => setSelected(template.id)}
                className="sr-only"
              />
            </Card>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={isSaving} disabled={!selected || isSaving}>
          Continue
        </Button>
      </div>
    </form>
  );
}
