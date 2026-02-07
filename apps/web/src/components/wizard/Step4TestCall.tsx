import React, { useState } from "react";

interface Props {
  phoneNumber: string;
  onComplete: () => void;
  onBack: () => void;
}

export default function Step4TestCall({ phoneNumber, onComplete, onBack }: Props) {
  const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");

  const handleTest = async () => {
    setStatus("running");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStatus("complete");
  };

  return (
    <div className="step-form">
      <h2>Test Call</h2>
      <p>Dial {phoneNumber} from a phone or use the simulator to verify the flow.</p>
      <button type="button" className="btn-primary" onClick={handleTest} disabled={status === "running"}>
        {status === "running" ? "Testing..." : "Trigger Test Call"}
      </button>
      <p>
        Status:{" "}
        {status === "complete" ? (
          <span className="status-success">Completed</span>
        ) : status === "running" ? (
          <span className="status-pending">Running</span>
        ) : (
          <span className="status-idle">Awaiting Test</span>
        )}
      </p>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn-primary" onClick={onComplete} disabled={status !== "complete"}>
          Next
        </button>
      </div>
    </div>
  );
}
