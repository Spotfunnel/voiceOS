"""
Admin intelligence endpoints for analytics and cost insights.
"""

from typing import Any, Dict, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, Depends
import psycopg2.extras

from ...database.db_service import get_db_connection
from ...middleware.auth import require_admin

router = APIRouter(prefix="/api/admin/intelligence", tags=["admin-intelligence"])


def _start_date_from_period(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "last-7-days":
        return now - timedelta(days=7)
    if period == "last-30-days":
        return now - timedelta(days=30)
    if period == "last-90-days":
        return now - timedelta(days=90)
    return datetime(2000, 1, 1)


@router.get("/outcomes")
async def get_outcomes(
    period: str = Query("last-30-days"),
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    start_date = _start_date_from_period(period)
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT outcome, requires_action, COUNT(*) as count
            FROM call_logs
            WHERE start_time >= %s
            GROUP BY outcome, requires_action
            """,
            (start_date,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    total_calls = sum(row["count"] for row in rows)
    leads_captured = sum(row["count"] for row in rows if row["outcome"] == "lead_captured")
    bookings = sum(row["count"] for row in rows if row["outcome"] == "booking_confirmed")
    escalated = sum(row["count"] for row in rows if row["requires_action"])
    abandoned = sum(row["count"] for row in rows if row["outcome"] in ("failed", "abandoned"))
    conversion_rate = leads_captured / total_calls if total_calls else 0.0
    escalation_rate = escalated / total_calls if total_calls else 0.0

    outcome_breakdown = {}
    for row in rows:
        key = row["outcome"] or "unknown"
        outcome_breakdown[key] = outcome_breakdown.get(key, 0) + row["count"]

    return {
        "total_calls": total_calls,
        "leads_captured": leads_captured,
        "bookings": bookings,
        "escalated": escalated,
        "abandoned": abandoned,
        "conversion_rate": conversion_rate,
        "escalation_rate": escalation_rate,
        "outcome_breakdown": outcome_breakdown,
    }


@router.get("/reason-taxonomy")
async def get_reason_taxonomy(
    period: str = Query("last-30-days"),
    session: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    start_date = _start_date_from_period(period)
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT reason_for_calling, COUNT(*) as count
            FROM call_logs
            WHERE start_time >= %s
            GROUP BY reason_for_calling
            ORDER BY count DESC
            """,
            (start_date,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {"reason": row["reason_for_calling"] or "unknown", "count": row["count"]}
        for row in rows
    ]


@router.get("/cost-analytics")
async def get_cost_analytics(
    period: str = Query("last-30-days"),
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    start_date = _start_date_from_period(period)
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                SUM(duration_seconds) as total_duration,
                SUM(total_cost_usd) as total_cost,
                SUM(CASE WHEN outcome = 'lead_captured' THEN 1 ELSE 0 END) as leads,
                SUM(CASE WHEN outcome = 'booking_confirmed' THEN 1 ELSE 0 END) as bookings
            FROM call_logs
            WHERE start_time >= %s
            """,
            (start_date,),
        )
        row = cur.fetchone() or {}
    finally:
        conn.close()

    total_duration = row.get("total_duration") or 0
    total_minutes = total_duration / 60 if total_duration else 0
    total_cost = float(row.get("total_cost") or 0.0)
    leads = row.get("leads") or 0
    bookings = row.get("bookings") or 0
    avg_cost_per_min = total_cost / total_minutes if total_minutes else 0.0
    cost_per_lead = total_cost / leads if leads else 0.0
    cost_per_booking = total_cost / bookings if bookings else 0.0

    return {
        "total_minutes": total_minutes,
        "total_cost": total_cost,
        "avg_cost_per_min": avg_cost_per_min,
        "cost_per_lead": cost_per_lead,
        "cost_per_booking": cost_per_booking,
        "tenants": [],
    }
