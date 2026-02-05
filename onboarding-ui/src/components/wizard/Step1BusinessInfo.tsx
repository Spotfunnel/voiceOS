'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface Props {
  data: {
    business_name?: string;
    phone_number?: string;
    contact_email?: string;
    business_type?: string;
    state?: string;
    timezone?: string;
    business_hours?: string;
  };
  onNext: (data: any) => void;
  isSaving?: boolean;
}

const STATES = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
];

const TIMEZONES = ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Hobart', 'Australia/Darwin'];

export default function Step1BusinessInfo({ data, onNext, isSaving }: Props) {
  const [formData, setFormData] = useState({
    business_name: data.business_name || '',
    phone_number: data.phone_number || '',
    contact_email: data.contact_email || '',
    business_type: data.business_type || '',
    state: data.state || '',
    timezone: data.timezone || 'Australia/Sydney',
    business_hours: data.business_hours || 'Mon–Fri 9:00am–5:00pm',
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Business details
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These details help your receptionist identify your business and
          operate within local hours.
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
          <label className="text-sm font-medium">Business type</label>
          <Input
            required
            value={formData.business_type}
            onChange={(event) =>
              setFormData({ ...formData, business_type: event.target.value })
            }
            placeholder="Plumbing, HVAC, Electrical"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Primary phone</label>
          <Input
            required
            type="tel"
            pattern="^\\+61[0-9]{9}$"
            placeholder="+61412345678"
            value={formData.phone_number}
            onChange={(event) =>
              setFormData({ ...formData, phone_number: event.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Owner email</label>
          <Input
            required
            type="email"
            value={formData.contact_email}
            onChange={(event) =>
              setFormData({ ...formData, contact_email: event.target.value })
            }
            placeholder="owner@spotfunnel.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">State</label>
          <Select
            required
            value={formData.state}
            onChange={(event) =>
              setFormData({ ...formData, state: event.target.value })
            }
          >
            <option value="">Select state</option>
            {STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Timezone</label>
          <Select
            required
            value={formData.timezone}
            onChange={(event) =>
              setFormData({ ...formData, timezone: event.target.value })
            }
          >
            {TIMEZONES.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Business hours</label>
        <Textarea
          rows={3}
          value={formData.business_hours}
          onChange={(event) =>
            setFormData({ ...formData, business_hours: event.target.value })
          }
          placeholder="Mon–Fri 9:00am–5:00pm"
        />
        <p className="text-xs text-muted-foreground">
          This helps the receptionist set expectations and book callbacks.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSaving} disabled={isSaving}>
          Continue
        </Button>
      </div>
    </form>
  );
}
