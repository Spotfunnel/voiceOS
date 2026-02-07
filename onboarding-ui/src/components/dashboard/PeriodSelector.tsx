'use client';

import React from 'react';
import { Select } from '@/components/ui/Select';
import { TimePeriod } from '@/contexts/DashboardDataContext';

interface PeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value as TimePeriod)}
      className="w-full md:w-48"
    >
      <option value="last-7-days">Last 7 days</option>
      <option value="last-30-days">Last 30 days</option>
      <option value="last-90-days">Last 90 days</option>
      <option value="all-time">All time</option>
    </Select>
  );
}
