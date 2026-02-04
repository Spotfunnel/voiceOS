import React, { useEffect, useState } from "react";

interface Props {
  tenantId: string;
  activeCallCount: number;
}

export default function LiveStatus({ tenantId, activeCallCount }: Props) {
  const [connected, setConnected] = useState(false);
  const [liveCount, setLiveCount] = useState(activeCallCount);

  useEffect(() => {
    if (!tenantId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/status/${tenantId}`);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "call_status_update") {
        setLiveCount(data.active_call_count);
      }
    };
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [tenantId]);

  return (
    <div className="live-status">
      <span className={`status-indicator ${connected ? "connected" : "disconnected"}`} />
      <span className="status-text">
        {liveCount} active call{liveCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
