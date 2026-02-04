import React, { useState } from "react";

interface Props {
  data: {
    business_name?: string;
    phone_number?: string;
    contact_email?: string;
  };
  onNext: (data: any) => void;
}

export default function Step1BusinessInfo({ data, onNext }: Props) {
  const [formData, setFormData] = useState(data);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="step-form">
      <h2>Business Information</h2>
      <div className="form-group">
        <label>Business Name</label>
        <input
          type="text"
          required
          value={formData.business_name || ""}
          onChange={(event) => setFormData({ ...formData, business_name: event.target.value })}
        />
      </div>
      <div className="form-group">
        <label>Phone Number</label>
        <input
          type="tel"
          required
          pattern="^\+61[0-9]{9}$"
          placeholder="+61412345678"
          value={formData.phone_number || ""}
          onChange={(event) => setFormData({ ...formData, phone_number: event.target.value })}
        />
      </div>
      <div className="form-group">
        <label>Contact Email</label>
        <input
          type="email"
          required
          value={formData.contact_email || ""}
          onChange={(event) => setFormData({ ...formData, contact_email: event.target.value })}
        />
      </div>
      <button type="submit" className="btn-primary">
        Next
      </button>
    </form>
  );
}
