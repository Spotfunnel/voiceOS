"""
Customer dashboard API.

Provides call logs, leads, and realtime updates.
"""

from datetime import datetime, timedelta
from typing import Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from ..database.db_service import get_db_connection

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/{tenant_id}")
async def get_dashboard_data(tenant_id: str):
    conn = get_db_connection()
    try:
        cutoff = datetime.now() - timedelta(days=30)
        calls = conn.execute(
            """
            SELECT call_id, from_number, timestamp, duration_seconds, status, objectives_completed
            FROM calls
            WHERE tenant_id = ?
              AND timestamp >= ?
            ORDER BY timestamp DESC
            LIMIT 100
            """,
            (tenant_id, cutoff),
        ).fetchall()
        leads = conn.execute(
            """
            SELECT lead_id, call_id, timestamp, name, phone, email, service, appointment_datetime
            FROM leads
            WHERE tenant_id = ?
              AND timestamp >= ?
            ORDER BY timestamp DESC
            LIMIT 50
            """,
            (tenant_id, cutoff),
        ).fetchall()
        active_count = conn.execute(
            "SELECT COUNT(*) as count FROM calls WHERE tenant_id = ? AND status = 'in_progress'",
            (tenant_id,),
        ).fetchone()["count"]
        return {
            "calls": [dict(call) for call in calls],
            "leads": [dict(lead) for lead in leads],
            "activeCallCount": active_count,
        }
    finally:
        conn.close()


@router.websocket("/ws/status/{tenant_id}")
async def websocket_status(websocket: WebSocket, tenant_id: str):
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
            conn = get_db_connection()
            try:
                active_count = conn.execute(
                    "SELECT COUNT(*) as count FROM calls WHERE tenant_id = ? AND status = 'in_progress'",
                    (tenant_id,),
                ).fetchone()["count"]
                await websocket.send_json(
                    {"type": "call_status_update", "active_call_count": active_count, "timestamp": datetime.now().isoformat()}
                )
            finally:
                conn.close()
    except WebSocketDisconnect:
        pass


async def broadcast_call_event(tenant_id: str, event_type: str, call_id: str, updates: dict = None):
    """Stub for broadcasting call events (websocket connections not tracked)"""
    pass
