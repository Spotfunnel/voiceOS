"""
Admin operations endpoints for real-time platform health.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List
import asyncio
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
import psycopg2.extras

from ...database.db_service import get_db_connection
from ...middleware.auth import require_admin, get_session_from_token

router = APIRouter(prefix="/api/admin/operations", tags=["admin-operations"])


def _safe_p95(values: List[int]) -> int:
    if not values:
        return 0
    sorted_values = sorted(values)
    index = int(round(0.95 * (len(sorted_values) - 1)))
    return sorted_values[index]


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


@router.get("/health")
async def get_global_health(session: dict = Depends(require_admin)) -> Dict[str, Any]:
    """
    Return 9 critical operator metrics (real-time).
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        now = datetime.utcnow()
        one_hour_ago = now - timedelta(hours=1)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        cur.execute(
            """
            SELECT COUNT(*) AS count
            FROM call_logs
            WHERE outcome = 'in_progress' AND end_time IS NULL
            """
        )
        active_calls = cur.fetchone()["count"]

        cur.execute(
            """
            SELECT COUNT(*) AS count
            FROM call_logs
            WHERE start_time >= %s
            """,
            (today_start,),
        )
        calls_today = cur.fetchone()["count"]

        cur.execute(
            """
            SELECT outcome, duration_seconds
            FROM call_logs
            WHERE start_time >= %s
            """,
            (one_hour_ago,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    total_calls = len(rows)
    success_calls = sum(1 for row in rows if row["outcome"] != "failed")
    success_rate = success_calls / total_calls if total_calls else 0.0
    error_rate = 1.0 - success_rate if total_calls else 0.0
    p95_latency_ms = _safe_p95(
        [row["duration_seconds"] * 1000 for row in rows if row["duration_seconds"]]
    )

    # Provider rates are placeholders until provider metrics are ingested.
    stt_success_rate = 0.992
    llm_success_rate = 0.978
    tts_success_rate = 0.999
    telephony_success_rate = 1.0
    tool_failure_rate = 0.02
    escalation_rate = 0.096

    status = "healthy" if success_rate >= 0.95 else "warning" if success_rate >= 0.85 else "critical"

    return {
        "status": status,
        "active_calls": active_calls,
        "calls_today": calls_today,
        "success_rate": success_rate,
        "error_rate": error_rate,
        "p95_latency_ms": p95_latency_ms,
        "stt_success_rate": stt_success_rate,
        "llm_success_rate": llm_success_rate,
        "tts_success_rate": tts_success_rate,
        "telephony_success_rate": telephony_success_rate,
        "tool_failure_rate": tool_failure_rate,
        "escalation_rate": escalation_rate,
        "timestamp": _now_iso(),
    }


@router.get("/tenants")
async def get_tenant_health(session: dict = Depends(require_admin)) -> List[Dict[str, Any]]:
    """
    Multi-tenant health view for noisy neighbor detection.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
              t.tenant_id AS tenant_id,
              t.business_name,
              COUNT(CASE WHEN cl.start_time >= NOW() - INTERVAL '1 hour' THEN 1 END) AS calls_last_hour,
              COUNT(CASE WHEN cl.start_time >= CURRENT_DATE THEN 1 END) AS calls_today,
              MAX(cl.start_time) AS last_call_time,
              MAX(CASE WHEN cl.outcome = 'failed' THEN cl.start_time END) AS last_error_time
            FROM tenants t
            LEFT JOIN call_logs cl ON t.tenant_id = cl.tenant_id
            GROUP BY t.tenant_id, t.business_name
            ORDER BY calls_last_hour DESC, last_call_time DESC NULLS LAST
            """
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    tenants = []
    for row in rows:
        calls_last_hour = row["calls_last_hour"] or 0
        status = "inactive" if row["last_call_time"] is None else "healthy"
        cap_soft = 1000
        cap_hard = 1200
        minutes_used = 0
        cap_utilization = minutes_used / cap_soft if cap_soft else 0
        cap_proximity = "safe"

        if calls_last_hour > 50:
            status = "warning"
        if calls_last_hour > 100:
            status = "critical"

        tenants.append(
            {
                "tenant_id": str(row["tenant_id"]),
                "business_name": row["business_name"],
                "status": status,
                "calls_last_hour": calls_last_hour,
                "calls_today": row["calls_today"] or 0,
                "cost_today": 0.0,
                "minutes_used_month": minutes_used,
                "cap_soft": cap_soft,
                "cap_hard": cap_hard,
                "cap_utilization": cap_utilization,
                "cap_proximity": cap_proximity,
                "last_call_time": row["last_call_time"].isoformat() if row["last_call_time"] else None,
                "last_error_time": row["last_error_time"].isoformat() if row["last_error_time"] else None,
                "error_rate_last_hour": 0.0,
            }
        )

    return tenants


@router.get("/cost")
async def get_cost_monitoring(session: dict = Depends(require_admin)) -> Dict[str, Any]:
    """
    Cost monitoring based on call_logs totals.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                SUM(total_cost_usd) FILTER (WHERE start_time >= NOW() - INTERVAL '1 hour') AS current_hour,
                SUM(total_cost_usd) FILTER (WHERE start_time >= date_trunc('day', NOW())) AS today,
                SUM(total_cost_usd) FILTER (WHERE start_time >= date_trunc('month', NOW())) AS month,
                SUM(stt_cost_usd) FILTER (WHERE start_time >= date_trunc('month', NOW())) AS stt,
                SUM(llm_cost_usd) FILTER (WHERE start_time >= date_trunc('month', NOW())) AS llm,
                SUM(tts_cost_usd) FILTER (WHERE start_time >= date_trunc('month', NOW())) AS tts
            FROM call_logs
            """
        )
        row = cur.fetchone() or {}
    finally:
        conn.close()

    current_hour = float(row.get("current_hour") or 0.0)
    today = float(row.get("today") or 0.0)
    month = float(row.get("month") or 0.0)
    projected_month = month

    threshold_hour = 100.0
    threshold_status = "safe" if current_hour < threshold_hour else "warning"

    return {
        "current_hour": current_hour,
        "today": today,
        "month": month,
        "projected_month": projected_month,
        "threshold_hour": threshold_hour,
        "threshold_status": threshold_status,
        "breakdown": {
            "stt": float(row.get("stt") or 0.0),
            "llm": float(row.get("llm") or 0.0),
            "tts": float(row.get("tts") or 0.0),
            "telephony": 0.0,
        },
    }


@router.get("/alerts")
async def get_top_alerts(session: dict = Depends(require_admin)) -> List[Dict[str, Any]]:
    """
    Top system alerts (placeholder values for now).
    """
    return [
        {
            "id": str(uuid.uuid4()),
            "severity": "warning",
            "type": "provider_degradation",
            "message": "LLM provider success rate at 97.8% (last 10 min)",
            "details": "Review OpenAI/Anthropic status or retry policy.",
            "timestamp": _now_iso(),
            "drill_down_link": "/admin/quality?filter=llm_errors",
        }
    ]


@router.websocket("/ws/admin/operations")
async def operations_websocket(websocket: WebSocket):
    token = websocket.cookies.get("session_token") or websocket.query_params.get("session_token")
    session = get_session_from_token(token) if token else None
    if not session or session.get("role") not in ("operator", "admin"):
        await websocket.close(code=4401)
        return

    await websocket.accept()
    try:
        while True:
            health = await get_global_health(session=session)
            tenants = await get_tenant_health(session=session)
            cost = await get_cost_monitoring(session=session)
            alerts = await get_top_alerts(session=session)
            await websocket.send_json(
                {
                    "health": health,
                    "tenants": tenants,
                    "cost": cost,
                    "alerts": alerts,
                }
            )
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        return
