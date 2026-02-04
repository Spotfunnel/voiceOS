import React, { useState } from "react";

interface Call {
  call_id: string;
  from_number: string;
  timestamp: string;
  duration_seconds: number;
  status: "completed" | "failed" | "in_progress";
  objectives_completed: string[];
}

interface Props {
  calls: Call[];
}

export default function CallLogTable({ calls }: Props) {
  const [filterStatus, setFilterStatus] = useState<"all" | Call["status"]>("all");

  const filteredCalls =
    filterStatus === "all" ? calls : calls.filter((call) => call.status === filterStatus);

  return (
    <div className="call-log-table">
      <div className="table-filters">
        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as any)}>
          <option value="all">All Calls</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="in_progress">In Progress</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>From</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Objectives</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCalls.map((call) => (
            <tr key={call.call_id}>
              <td>{new Date(call.timestamp).toLocaleString()}</td>
              <td>{call.from_number}</td>
              <td>{Math.round(call.duration_seconds)}s</td>
              <td>
                <span className={`status-badge status-${call.status}`}>{call.status}</span>
              </td>
              <td>{call.objectives_completed.join(", ")}</td>
              <td>
                <button onClick={() => window.open(`/calls/${call.call_id}`)}>View Details</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
