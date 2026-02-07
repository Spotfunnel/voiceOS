'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

interface Props {
  knowledge?: string;
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step4Knowledge({ knowledge, onNext, onBack, isSaving }: Props) {
  const [text, setText] = useState(knowledge || '');
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const charCount = useMemo(() => text.length, [text]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!text.trim()) {
        setTokenCount(0);
        setValidationError(null);
        return;
      }

      setValidating(true);
      try {
        const response = await fetch('/api/onboarding/validate-knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledge: text }),
        });
        const result = await response.json();
        if (!response.ok) {
          setValidationError(result?.detail || 'Validation failed.');
          setTokenCount(null);
        } else {
          setTokenCount(result.tokens);
          setValidationError(null);
        }
      } catch (error) {
        setValidationError('Could not validate knowledge size.');
        setTokenCount(null);
      } finally {
        setValidating(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [text]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext({ static_knowledge: text });
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Knowledge base (Tier 1)
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add quick facts about your services, pricing guidelines, locations,
          and policies. This is injected directly into the system prompt.
        </p>
      </div>

      <div className="space-y-3">
        <Textarea
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Example: We service Sydney and the Northern Beaches. Emergency call-out fee is $180..."
        />
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{charCount} characters</span>
          <span>•</span>
          <span>
            {validating
              ? 'Checking tokens...'
              : tokenCount !== null
              ? `${tokenCount} tokens`
              : 'Token count unavailable'}
          </span>
          <span>•</span>
          <span>Max 10,000 tokens</span>
        </div>
      </div>

      {validationError && (
        <Alert variant="error">{validationError}</Alert>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={isSaving} disabled={Boolean(validationError) || isSaving}>
          Continue
        </Button>
      </div>
    </form>
  );
}
