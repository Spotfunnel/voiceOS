'use client';

import React from 'react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface Props {
  tenantName: string;
  onGoLive: () => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step6GoLive({
  tenantName,
  onGoLive,
  onBack,
  isSaving,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Go live
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Activate phone routing and enable the live receptionist for{' '}
          <span className="font-medium text-foreground">{tenantName}</span>.
        </p>
      </div>

      <Card className="flex flex-col gap-3 border border-border bg-muted/30 p-5">
        <h3 className="text-sm font-semibold">Before you launch</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• Confirm the phone number routing is correct.</li>
          <li>• Ensure the owner email receives summaries.</li>
          <li>• Keep the first call within business hours.</li>
        </ul>
        <Alert variant="warning">
          Activation can take up to 3 minutes to propagate.
        </Alert>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onGoLive} loading={isSaving} disabled={isSaving}>
          Activate & go live
        </Button>
      </div>
    </div>
  );
}
