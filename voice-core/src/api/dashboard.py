"""
Customer dashboard API endpoints.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Set
import csv
import io

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import StreamingResponse
import psycopg2.extras

from ..database.db_service import get_db_connection
from ..middleware.auth import require_auth, check_tenant_access, get_session_from_token

router = APIRouter(tags=["dashboard"])


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, tenant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(tenant_id, set()).add(websocket)

    def disconnect(self, tenant_id: str, websocket: WebSocket) -> None:
        if tenant_id in self.active_connections:
            self.active_connections[tenant_id].discard(websocket)

    async def broadcast(self, tenant_id: str, message: Dict[str, Any]) -> None:
        if tenant_id not in self.active_connections:
            return
        for connection in list(self.active_connections[tenant_id]):
            try:
                await connection.send_json(message)
            except Exception:
                self.active_connections[tenant_id].discard(connection)


manager = ConnectionManager()


@router.websocket("/ws/dashboard/{tenant_id}")
async def dashboard_websocket(websocket: WebSocket, tenant_id: str):
    token = websocket.cookies.get("session_token") or websocket.query_params.get("session_token")
    session = get_session_from_token(token) if token else None
    if not session or not check_tenant_access(session, tenant_id):
        await websocket.close(code=4401)
        return
    await manager.connect(tenant_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(tenant_id, websocket)


def _start_date_from_period(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "last-7-days":
        return now - timedelta(days=7)
    if period == "last-30-days":
        return now - timedelta(days=30)
    if period == "last-90-days":
        return now - timedelta(days=90)
    return datetime(2000, 1, 1)


@router.get("/api/dashboard/calls")
async def get_dashboard_calls(
    tenant_id: str = Query(...),
    period: str = Query("last-7-days"),
    session: dict = Depends(require_auth),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    start_date = _start_date_from_period(period)
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query = """
            SELECT
                id, call_id, tenant_id, caller_phone, start_time, end_time,
                duration_seconds, outcome, transcript, captured_data,
                requires_action, priority, created_at
            FROM call_logs
            WHERE tenant_id = %s AND start_time >= %s
            ORDER BY start_time DESC
        """
        cur.execute(query, (tenant_id, start_date))
        rows = cur.fetchall()
    finally:
        conn.close()

    calls = []
    for row in rows:
        calls.append(
            {
                "id": str(row["id"]),
                "call_id": row["call_id"],
                "tenant_id": str(row["tenant_id"]),
                "caller_phone": row["caller_phone"],
                "start_time": row["start_time"].isoformat() if row["start_time"] else None,
                "end_time": row["end_time"].isoformat() if row["end_time"] else None,
                "duration_seconds": row["duration_seconds"],
                "outcome": row["outcome"],
                "transcript": row["transcript"] or "",
                "captured_data": row["captured_data"] or {},
                "requires_action": row["requires_action"],
                "priority": row["priority"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
        )

    total_calls = len(calls)
    action_required = sum(1 for call in calls if call["requires_action"])
    leads_captured = sum(1 for call in calls if call["outcome"] == "lead_captured")
    success_rate = leads_captured / total_calls if total_calls else 0

    return {
        "calls": calls,
        "metrics": {
            "total_calls": total_calls,
            "action_required": action_required,
            "leads_captured": leads_captured,
            "success_rate": success_rate,
        },
    }


@router.post("/api/dashboard/export")
async def export_call_log(request: Dict[str, Any], session: dict = Depends(require_auth)):
    tenant_id = request.get("tenant_id")
    call_ids = request.get("call_ids", [])
    if not tenant_id or not call_ids:
        raise HTTPException(status_code=400, detail="tenant_id and call_ids required")
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query = """
            SELECT call_id, caller_phone, start_time, duration_seconds, outcome,
                   captured_data->>'name' as name,
                   captured_data->>'email' as email,
                   captured_data->>'phone' as phone,
                   captured_data->>'service' as service
            FROM call_logs
            WHERE tenant_id = %s AND id = ANY(%s)
            ORDER BY start_time DESC
        """
        cur.execute(query, (tenant_id, call_ids))
        rows = cur.fetchall()
    finally:
        conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Call ID",
            "Caller",
            "Date",
            "Duration (min)",
            "Outcome",
            "Name",
            "Email",
            "Phone",
            "Service",
        ]
    )

    for row in rows:
        writer.writerow(
            [
                row["call_id"],
                row["caller_phone"],
                row["start_time"].strftime("%Y-%m-%d %H:%M") if row["start_time"] else "",
                round((row["duration_seconds"] or 0) / 60, 1),
                row["outcome"],
                row.get("name") or "",
                row.get("email") or "",
                row.get("phone") or "",
                row.get("service") or "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=call-log-{datetime.utcnow().isoformat()}.csv"
        },
    )


async def broadcast_call_event(
    tenant_id: str,
    event_type: str,
    call_id: str,
    updates: Dict[str, Any] | None = None,
):
    message = {
        "type": event_type,
        "call_id": call_id,
        "updates": updates or {},
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(tenant_id, message)
