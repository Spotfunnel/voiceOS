'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface Props {
  reasons?: string[];
  outcomes?: Array<{
    label: string;
    action_required: boolean;
    pipeline_values: string[];
  }>;
  reportFields?: Array<{
    id: string;
    label: string;
    required: boolean;
    global: boolean;
  }>;
  pipelineValues?: Array<{
    id: string;
    name: string;
    value: string;
  }>;
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

const DEFAULT_REASONS = [
  'New booking',
  'Reschedule',
  'Pricing inquiry',
  'Service follow-up',
  'Emergency request',
];

const DEFAULT_OUTCOMES = [
  { label: 'Booked', action_required: true, pipeline_values: [] },
  { label: 'Quote sent', action_required: false, pipeline_values: [] },
  { label: 'Follow-up required', action_required: true, pipeline_values: [] },
  { label: 'No answer', action_required: false, pipeline_values: [] },
  { label: 'Unqualified', action_required: false, pipeline_values: [] },
];

const DEFAULT_REPORT_FIELDS = [
  { id: 'transcript', label: 'Transcript', required: true, global: true },
  { id: 'summary', label: 'Summary', required: true, global: true },
  { id: 'name', label: 'Name', required: true, global: true },
  { id: 'call_number', label: 'Call Number', required: true, global: true },
  { id: 'email', label: 'Email', required: false, global: true },
  { id: 'address', label: 'Address', required: false, global: true },
];

export default function Step4Dashboard({
  reasons,
  outcomes,
  reportFields,
  pipelineValues,
  onNext,
  onBack,
  isSaving,
}: Props) {
  const [reasonList, setReasonList] = useState<string[]>(
    reasons && reasons.length ? reasons : DEFAULT_REASONS
  );
  const [outcomeList, setOutcomeList] = useState(
    outcomes && outcomes.length
      ? outcomes
      : DEFAULT_OUTCOMES
  );
  const [pipelineList, setPipelineList] = useState(
    pipelineValues && pipelineValues.length
      ? pipelineValues
      : [
          { id: 'base', name: 'Standard booking', value: '250' },
          { id: 'premium', name: 'Premium install', value: '650' },
        ]
  );
  const [reportFieldList, setReportFieldList] = useState(
    reportFields && reportFields.length ? reportFields : DEFAULT_REPORT_FIELDS
  );
  const [newReason, setNewReason] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineValue, setNewPipelineValue] = useState('');
  const [newReportLabel, setNewReportLabel] = useState('');
  const [newReportGlobal, setNewReportGlobal] = useState(true);

  const addReason = () => {
    if (!newReason.trim()) return;
    setReasonList((prev) => [...prev, newReason.trim()]);
    setNewReason('');
  };

  const addOutcome = () => {
    if (!newOutcome.trim()) return;
    setOutcomeList((prev) => [
      ...prev,
      { label: newOutcome.trim(), action_required: false, pipeline_values: [] },
    ]);
    setNewOutcome('');
  };

  const removeReason = (item: string) => {
    setReasonList(reasonList.filter((entry) => entry !== item));
  };

  const removeOutcome = (item: string) => {
    setOutcomeList(outcomeList.filter((entry) => entry.label !== item));
  };

  const toggleOutcomeAction = (label: string) => {
    setOutcomeList((prev) =>
      prev.map((entry) =>
        entry.label === label
          ? { ...entry, action_required: !entry.action_required }
          : entry
      )
    );
  };

  const toggleOutcomePipeline = (label: string, pipelineId: string) => {
    setOutcomeList((prev) =>
      prev.map((entry) => {
        if (entry.label !== label) return entry;
        const hasValue = entry.pipeline_values.includes(pipelineId);
        return {
          ...entry,
          pipeline_values: hasValue
            ? entry.pipeline_values.filter((id) => id !== pipelineId)
            : [...entry.pipeline_values, pipelineId],
        };
      })
    );
  };

  const addPipelineValue = () => {
    if (!newPipelineName.trim() || !newPipelineValue.trim()) return;
    setPipelineList((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        name: newPipelineName.trim(),
        value: newPipelineValue.trim(),
      },
    ]);
    setNewPipelineName('');
    setNewPipelineValue('');
  };

  const removePipeline = (id: string) => {
    setPipelineList(pipelineList.filter((entry) => entry.id !== id));
    setOutcomeList((prev) =>
      prev.map((entry) => ({
        ...entry,
        pipeline_values: entry.pipeline_values.filter((valueId) => valueId !== id),
      }))
    );
  };

  const toggleReportRequired = (id: string) => {
    setReportFieldList((prev) =>
      prev.map((field) =>
        field.id === id ? { ...field, required: !field.required } : field
      )
    );
  };

  const removeReportField = (id: string) => {
    setReportFieldList((prev) => prev.filter((field) => field.id !== id));
  };

  const addReportField = () => {
    if (!newReportLabel.trim()) return;
    setReportFieldList((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        label: newReportLabel.trim(),
        required: false,
        global: newReportGlobal,
      },
    ]);
    setNewReportLabel('');
    setNewReportGlobal(true);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext({
          dashboard_reasons: reasonList,
          dashboard_outcomes: outcomeList,
          dashboard_report_fields: reportFieldList,
          pipeline_values: pipelineList,
        });
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure the reasons for calling and outcomes used in reporting.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border p-4">
          <h3 className="text-sm font-semibold">Reasons for calling</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {reasonList.map((reason) => (
              <span
                key={reason}
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium"
              >
                {reason}
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => removeReason(reason)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Input
              value={newReason}
              onChange={(event) => setNewReason(event.target.value)}
              placeholder="Add a reason"
            />
            <Button type="button" variant="outline" onClick={addReason}>
              Add
            </Button>
          </div>
        </Card>

        <Card className="border border-border p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Pipeline values</h3>
            <p className="text-xs text-muted-foreground">
              Create pipeline values and map them to outcomes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pipelineList.map((pipeline) => (
              <span
                key={pipeline.id}
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium"
              >
                {pipeline.name} (${pipeline.value})
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => removePipeline(pipeline.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              value={newPipelineName}
              onChange={(event) => setNewPipelineName(event.target.value)}
              placeholder="Pipeline item name"
            />
            <Input
              value={newPipelineValue}
              onChange={(event) => setNewPipelineValue(event.target.value)}
              placeholder="Value (e.g. 250)"
            />
          </div>
          <Button type="button" variant="outline" onClick={addPipelineValue}>
            Add pipeline value
          </Button>
        </Card>

        <Card className="border border-border p-4 space-y-4">
          <h3 className="text-sm font-semibold">Outcomes</h3>
          {outcomeList.map((outcome) => (
            <div key={outcome.label} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">{outcome.label}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={outcome.action_required}
                      onChange={() => toggleOutcomeAction(outcome.label)}
                    />
                    Action required
                  </label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground"
                    onClick={() => removeOutcome(outcome.label)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Pipeline values</p>
                <div className="flex flex-wrap gap-3">
                  {pipelineList.map((pipeline) => (
                    <label key={pipeline.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={outcome.pipeline_values.includes(pipeline.id)}
                        onChange={() => toggleOutcomePipeline(outcome.label, pipeline.id)}
                      />
                      {pipeline.name} (${pipeline.value})
                    </label>
                  ))}
                  {pipelineList.length === 0 && (
                    <span className="text-xs text-muted-foreground">No pipeline values yet.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newOutcome}
              onChange={(event) => setNewOutcome(event.target.value)}
              placeholder="Add an outcome"
            />
            <Button type="button" variant="outline" onClick={addOutcome}>
              Add
            </Button>
          </div>
        </Card>
      </div>

      <Card className="border border-border p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Dashboard report fields</h3>
          <p className="text-xs text-muted-foreground">
            Choose which fields are required or optional in reports.
          </p>
        </div>
        <div className="space-y-3">
          {reportFieldList.map((field) => (
            <div
              key={field.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{field.label}</span>
                <span className="text-xs text-muted-foreground">
                  {field.required ? 'Required' : 'Optional'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={() => toggleReportRequired(field.id)}
                  />
                  Required
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground"
                  onClick={() => removeReportField(field.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            value={newReportLabel}
            onChange={(event) => setNewReportLabel(event.target.value)}
            placeholder="Add new report field"
          />
          <Button type="button" variant="outline" onClick={addReportField}>
            Add field
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={newReportGlobal}
            onChange={(event) => setNewReportGlobal(event.target.checked)}
          />
          Save new field globally for future onboarding sessions
        </label>
      </Card>

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
