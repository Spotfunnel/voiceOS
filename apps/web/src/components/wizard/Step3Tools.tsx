'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Textarea } from '../ui/Textarea';

interface WorkflowItem {
  name: string;
  webhook_url: string;
  workflow_url: string;
  payload_template?: string;
}

interface Props {
  workflows?: WorkflowItem[];
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step3Tools({ workflows, onNext, onBack, isSaving }: Props) {
  const [items, setItems] = useState<WorkflowItem[]>(
    workflows && workflows.length
      ? workflows
      : [{ name: '', webhook_url: '', workflow_url: '', payload_template: '{}' }]
  );
  const [payloadStatus, setPayloadStatus] = useState<Record<number, string>>({});
  const [payloadErrors, setPayloadErrors] = useState<Record<number, string>>({});
  const [payloadLog, setPayloadLog] = useState<Record<number, string[]>>({});
  const [payloadCount, setPayloadCount] = useState<Record<number, number>>({});

  const updateItem = (index: number, key: keyof WorkflowItem, value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { name: '', webhook_url: '', workflow_url: '', payload_template: '{}' },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext({ n8n_workflows: items });
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Tools</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create n8n workflows and connect them to the agent.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item, idx) => (
          <Card key={idx} className="border border-border p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow name</label>
                <Input
                  value={item.name}
                  onChange={(event) => updateItem(idx, 'name', event.target.value)}
                  placeholder="Lead intake"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Webhook URL</label>
                <Input
                  value={item.webhook_url}
                  onChange={(event) =>
                    updateItem(idx, 'webhook_url', event.target.value)
                  }
                  placeholder="https://n8n.yourdomain.com/webhook/..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow link</label>
                <Input
                  value={item.workflow_url}
                  onChange={(event) =>
                    updateItem(idx, 'workflow_url', event.target.value)
                  }
                  placeholder="https://n8n.yourdomain.com/workflow/..."
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">Payload template (JSON)</label>
              <Textarea
                rows={5}
                value={item.payload_template || ''}
                onChange={(event) =>
                  updateItem(idx, 'payload_template', event.target.value)
                }
                placeholder='{"caller_name":"{{caller_name}}","outcome":"{{outcome}}"}'
              />
              {payloadErrors[idx] && (
                <p className="text-xs text-destructive">{payloadErrors[idx]}</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(item.payload_template || '{}');
                    setPayloadErrors((prev) => ({ ...prev, [idx]: '' }));
                    const count = payloadCount[idx] || 3;
                    const samples = Array.from({ length: count }, (_, i) =>
                      JSON.stringify(
                        {
                          ...parsed,
                          _sample_index: i + 1,
                          _generated_at: new Date().toISOString(),
                        },
                        null,
                        2
                      )
                    );
                    setPayloadLog((prev) => ({ ...prev, [idx]: samples }));
                    setPayloadStatus((prev) => ({
                      ...prev,
                      [idx]: `Sent ${count} test payloads.`,
                    }));
                  } catch (error) {
                    setPayloadErrors((prev) => ({
                      ...prev,
                      [idx]: 'Invalid JSON payload format.',
                    }));
                  }
                }}
              >
                Send test payloads
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  value={payloadCount[idx] ?? 3}
                  onChange={(event) =>
                    setPayloadCount((prev) => ({
                      ...prev,
                      [idx]: Number(event.target.value) || 1,
                    }))
                  }
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">samples</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {payloadStatus[idx] || 'JSON only. Must be valid.'}
              </span>
            </div>
            {payloadLog[idx] && payloadLog[idx].length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sample payloads</p>
                <div className="space-y-2">
                  {payloadLog[idx].map((sample, sampleIdx) => (
                    <pre
                      key={sampleIdx}
                      className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs"
                    >
                      {sample}
                    </pre>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex justify-end">
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeItem(idx)}
                >
                  Remove
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addItem}>
        Add workflow
      </Button>

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
