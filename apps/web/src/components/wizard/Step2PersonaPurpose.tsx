'use client';

import { useState } from 'react';
import { Mic, Volume2, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';

interface KnowledgeBase {
  id?: string;
  name: string;
  description: string;
  content: string;
  filler_text?: string;
}

interface Props {
  systemPrompt?: string;
  knowledgeBase?: string;  // Deprecated - for backwards compatibility
  knowledgeBases?: KnowledgeBase[];
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step2PersonaPurpose({
  systemPrompt,
  knowledgeBase,
  knowledgeBases,
  onNext,
  onBack,
  isSaving,
}: Props) {
  const [prompt, setPrompt] = useState(
    systemPrompt ||
      "You are the receptionist. Speak naturally, answer questions using your knowledge bases, and schedule appointments when needed."
  );
  
  const [kbList, setKbList] = useState<KnowledgeBase[]>(
    knowledgeBases || [
      {
        name: 'FAQs',
        description: 'Common questions about hours, services, and policies',
        content: 'Business hours: Mon-Fri 9am-5pm\nServices: Installation, Repair, Maintenance\nPayment: Cash, Card, Check accepted',
        filler_text: 'Let me look that up for you.'
      }
    ]
  );
  
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [stressStatus, setStressStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [stressProgress, setStressProgress] = useState<string | null>(null);
  const [stressReport, setStressReport] = useState<any>(null);

  const addOrUpdateKb = () => {
    if (!editingKb) return;
    
    if (!editingKb.id) {
      // Add new
      setKbList([...kbList, { ...editingKb, id: `temp-${Date.now()}` }]);
    } else {
      // Update existing
      setKbList(kbList.map(kb => kb.id === editingKb.id ? editingKb : kb));
    }
    setEditingKb(null);
  };

  const deleteKb = (id: string) => {
    setKbList(kbList.filter(kb => kb.id !== id));
  };

  return (
    <form
        onSubmit={(event) => {
        event.preventDefault();
        onNext({ 
          system_prompt: prompt, 
          knowledge_bases: kbList,
          stress_test_completed: true 
        });
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Persona &amp; Purpose
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Define who the agent is and configure knowledge bases it can query when needed.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">System Prompt (Layer 2)</label>
        <p className="text-xs text-muted-foreground">Define WHO this agent is, WHAT it does, and what SUCCESS looks like.</p>
        <Textarea
          rows={8}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="You are Sarah, receptionist for ABC Services. Your role is to..."
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Knowledge Bases</label>
            <p className="text-xs text-muted-foreground">AI queries these only when needed to answer specific questions</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setEditingKb({ name: '', description: '', content: '', filler_text: 'Let me look that up for you.' })}
          >
            <Plus className="h-4 w-4" />
            Add Knowledge Base
          </Button>
        </div>

        {/* List of existing knowledge bases */}
        <div className="space-y-2">
          {kbList.map((kb) => (
            <div key={kb.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{kb.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{kb.description}</div>
                  {kb.filler_text && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Filler: “{kb.filler_text}”
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {kb.content.length} characters
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingKb(kb)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteKb(kb.id!)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit/Add KB Modal */}
        {editingKb && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingKb.id ? 'Edit' : 'Add'} Knowledge Base
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={editingKb.name}
                    onChange={(e) => setEditingKb({ ...editingKb, name: e.target.value })}
                    placeholder="e.g., FAQs, Product A Troubleshooting, Pricing"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (When to use this KB)</label>
                  <Input
                    value={editingKb.description}
                    onChange={(e) => setEditingKb({ ...editingKb, description: e.target.value })}
                    placeholder="e.g., Common questions about hours, services, and policies"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    rows={12}
                    value={editingKb.content}
                    onChange={(e) => setEditingKb({ ...editingKb, content: e.target.value })}
                    placeholder="Enter knowledge base content..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Filler Line (spoken while searching)</label>
                  <Input
                    value={editingKb.filler_text || ''}
                    onChange={(e) => setEditingKb({ ...editingKb, filler_text: e.target.value })}
                    placeholder="Let me look that up for you."
                  />
                  <p className="text-xs text-muted-foreground">
                    This line will be spoken when this knowledge base is queried.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingKb(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={addOrUpdateKb}
                  disabled={!editingKb.name || !editingKb.content}
                >
                  {editingKb.id ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Speak to the agent</h3>
            <p className="text-xs text-muted-foreground">
              Use voice tests to ensure the prompt behaves the way you expect.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="gap-2">
              <Mic className="h-4 w-4" />
              Start test call
            </Button>
            <Button type="button" variant="ghost" className="gap-2">
              <Volume2 className="h-4 w-4" />
              Play last response
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {lastResponse
            ? lastResponse
            : 'No test call recorded yet. Run a voice test to hear a sample response.'}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() =>
            setLastResponse(
              'Thanks for calling SpotFunnel. I can help schedule that appointment. What time works best for you?'
            )
          }
        >
          Simulate response
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Quick stress test</h3>
            <p className="text-xs text-muted-foreground">
              Simulate multiple conversations to validate the prompt under pressure.
            </p>
          </div>
        <Button
          type="button"
          onClick={async () => {
            setStressStatus('running');
            setStressProgress('Starting stress test...');
            setStressReport(null);
            try {
              const response = await fetch('/api/stress-test/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  industry: 'general',
                  purpose: 'customer service agent',
                  system_prompt: prompt,
                  knowledge_base: knowledge,
                  conversation_count: 5,
                  min_turns: 5,
                  max_turns: 10,
                }),
              });
              const data = await response.json();
              if (!response.ok) {
                throw new Error(data?.detail || 'Stress test failed.');
              }
              setStressReport(data);
              setStressStatus('complete');
              setStressProgress(`Completed: ${data.passed}/${data.total} passed.`);
            } catch (error: any) {
              setStressStatus('idle');
              setStressProgress(error.message || 'Stress test failed.');
            }
          }}
        >
            {stressStatus === 'running' ? 'Running…' : 'Run stress test'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {stressProgress ||
            (stressStatus === 'complete'
              ? 'Stress test completed.'
              : 'Runs a simulated batch of conversations against the system prompt.')}
        </p>
        {stressReport && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <p className="font-semibold">
              Results: {stressReport.passed}/{stressReport.total} passed
            </p>
            {stressReport.failed > 0 && (
              <p className="text-muted-foreground">
                {stressReport.failed} failed. Expand details in the backend report.
              </p>
            )}
          </div>
        )}
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
