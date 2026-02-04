import React from "react";

interface Props {
  tenantName: string;
  onGoLive: () => void;
  onBack: () => void;
}

export default function Step5GoLive({ tenantName, onGoLive, onBack }: Props) {
  return (
    <div className="step-form">
      <h2>Go Live</h2>
      <p>
        Review the configuration for {tenantName}. When you're ready, activate phone routing and automation.
      </p>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn-primary" onClick={onGoLive}>
          Activate & Go Live
        </button>
      </div>
    </div>
  );
}
