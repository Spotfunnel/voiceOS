import { useEffect, useState } from "react";

interface Props {
  templateId: string;
  customizations: any;
  onNext: () => void;
  onBack: () => void;
}

interface N8nWorkflow {
  name: string;
  webhook_url: string;
  description: string;
}

export default function Step3Customization({ templateId, onNext, onBack }: Props) {
  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);

  useEffect(() => {
    if (templateId === "appointment_booking" || templateId === "full_receptionist") {
      setN8nWorkflows([
        {
          name: "appointment_automation",
          webhook_url: "",
          description: "Sends confirmation email and creates calendar event",
        },
      ]);
    }
  }, [templateId]);

  const handleChange = (index: number, value: string) => {
    const updated = [...n8nWorkflows];
    updated[index] = { ...updated[index], webhook_url: value };
    setN8nWorkflows(updated);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <h2>Customize Your Receptionist</h2>

      <section className="customization-section">
        <h3>Automation Workflows (n8n)</h3>
        <p>
          Connect n8n webhooks to automate emails, calendar events, CRM updates, and more.
        </p>

        {n8nWorkflows.map((workflow, index) => (
          <div key={index} className="workflow-config">
            <div className="workflow-header">
              <strong>{workflow.name}</strong>
              <span className="workflow-description">{workflow.description}</span>
            </div>
            <div className="form-group">
              <label htmlFor={`workflow-${index}`}>n8n Webhook URL</label>
              <input
                id={`workflow-${index}`}
                type="url"
                placeholder="https://your-n8n.com/webhook/voice-core-confirmation"
                value={workflow.webhook_url}
                onChange={(event) => handleChange(index, event.target.value)}
              />
              <small>
                Create this workflow in n8n, then paste the webhook URL here.{" "}
                <a href="/docs/n8n-setup" target="_blank" rel="noreferrer">
                  Setup Guide →
                </a>
              </small>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setN8nWorkflows([
              ...n8nWorkflows,
              { name: "", webhook_url: "", description: "" },
            ])
          }
        >
          + Add Another Workflow
        </button>
      </section>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn-primary">
          Next
        </button>
      </div>
    </form>
  );
}
