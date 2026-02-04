import React from "react";

interface Lead {
  lead_id: string;
  call_id: string;
  timestamp: string;
  name: string;
  phone: string;
  email?: string;
  service?: string;
  appointment_datetime?: string;
}

interface Props {
  leads: Lead[];
}

export default function LeadsList({ leads }: Props) {
  return (
    <div className="leads-list">
      {leads.map((lead) => (
        <div key={lead.lead_id} className="lead-card">
          <div className="lead-header">
            <h3>{lead.name}</h3>
            <span className="lead-date">{new Date(lead.timestamp).toLocaleDateString()}</span>
          </div>
          <div className="lead-details">
            <div className="detail-row">
              <strong>Phone:</strong> {lead.phone}
            </div>
            {lead.email && (
              <div className="detail-row">
                <strong>Email:</strong> {lead.email}
              </div>
            )}
            {lead.service && (
              <div className="detail-row">
                <strong>Service:</strong> {lead.service}
              </div>
            )}
            {lead.appointment_datetime && (
              <div className="detail-row">
                <strong>Appointment:</strong> {new Date(lead.appointment_datetime).toLocaleString()}
              </div>
            )}
          </div>
          <div className="lead-actions">
            <button className="btn-primary">Contact Lead</button>
            <button className="btn-secondary">View Call</button>
          </div>
        </div>
      ))}
    </div>
  );
}
