import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import CallLogTable from "./CallLogTable";
import LeadsList from "./LeadsList";
import LiveStatus from "./LiveStatus";

interface DashboardData {
  calls: any[];
  leads: any[];
  activeCallCount: number;
}

export default function CustomerDashboard() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [data, setData] = useState<DashboardData>({ calls: [], leads: [], activeCallCount: 0 });
  const [activeTab, setActiveTab] = useState("calls");

  const loadDashboardData = async () => {
    const response = await fetch(`/api/dashboard/${tenantId}`);
    const body = await response.json();
    setData(body);
  };

  useEffect(() => {
    if (tenantId) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [tenantId]);

  return (
    <div className="customer-dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <LiveStatus tenantId={tenantId || ""} activeCallCount={data.activeCallCount} />
      </header>
      <nav className="dashboard-tabs">
        <button className={activeTab === "calls" ? "active" : ""} onClick={() => setActiveTab("calls")}>
          Call Logs ({data.calls.length})
        </button>
        <button className={activeTab === "leads" ? "active" : ""} onClick={() => setActiveTab("leads")}>
          Leads ({data.leads.length})
        </button>
      </nav>
      <div className="dashboard-content">
        {activeTab === "calls" && <CallLogTable calls={data.calls} />}
        {activeTab === "leads" && <LeadsList leads={data.leads} />}
      </div>
    </div>
  );
}
