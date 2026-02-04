import React from "react";

interface Template {
  id: string;
  name: string;
  description: string;
}

interface Props {
  selectedTemplate?: string;
  onNext: (data: any) => void;
  onBack: () => void;
}

const templates: Template[] = [
  { id: "lead_capture", name: "Lead Capture", description: "Basic lead gen" },
  { id: "appointment_booking", name: "Appointment Booking", description: "Full scheduling" },
  { id: "full_receptionist", name: "Full Receptionist", description: "Lead capture + automation" },
];

export default function Step2TemplateSelection({ selectedTemplate, onNext, onBack }: Props) {
  const [selected, setSelected] = React.useState(selectedTemplate);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selected) {
      onNext({ template_id: selected });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="step-form">
      <h2>Select Template</h2>
      <div className="template-grid">
        {templates.map((template) => (
          <label key={template.id} className={`template-card ${selected === template.id ? "selected" : ""}`}>
            <input
              type="radio"
              name="template"
              value={template.id}
              checked={selected === template.id}
              onChange={() => setSelected(template.id)}
            />
            <h3>{template.name}</h3>
            <p>{template.description}</p>
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn-primary" disabled={!selected}>
          Next
        </button>
      </div>
    </form>
  );
}
