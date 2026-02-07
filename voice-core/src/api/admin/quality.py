"""
Admin quality endpoints for error intelligence.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Query, Depends
import psycopg2.extras

from ...middleware.auth import require_admin
from ...database.db_service import get_db_connection

router = APIRouter(prefix="/api/admin/quality", tags=["admin-quality"])


@router.get("/errors")
async def get_errors(
    tenant_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    """
    Return error list for the Quality page.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        clauses = []
        params: List[Any] = []

        if tenant_id:
            clauses.append("tenant_id = %s")
            params.append(tenant_id)
        if severity:
            clauses.append("severity = %s")
            params.append(severity)
        if start_date:
            clauses.append("created_at >= %s")
            params.append(start_date)
        if end_date:
            clauses.append("created_at <= %s")
            params.append(end_date)

        where_sql = "WHERE " + " AND ".join(clauses) if clauses else ""

        cur.execute(
            f"""
            SELECT error_id, tenant_id, call_id, error_type, error_message,
                   stack_trace, severity, context, resolved, created_at
            FROM system_errors
            {where_sql}
            ORDER BY created_at DESC
            LIMIT 200
            """,
            params,
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
        results.append(
            {
                "error_id": str(row["error_id"]),
                "tenant_id": str(row["tenant_id"]) if row["tenant_id"] else None,
                "call_id": row["call_id"],
                "error_type": row["error_type"],
                "error_message": row["error_message"],
                "severity": row["severity"],
                "context": row["context"] or {},
                "resolved": row["resolved"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
        )
    return results


@router.get("/errors/{error_id}/replay")
async def get_error_replay(
    error_id: str,
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    """
    Return event timeline for an error replay.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT error_id, tenant_id, call_id, error_type, error_message,
                   stack_trace, severity, context, created_at
            FROM system_errors
            WHERE error_id = %s
            """,
            (error_id,),
        )
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return {
            "error_id": error_id,
            "events": [],
            "explanation": "Error not found",
            "suggested_action": None,
        }

    return {
        "error_id": str(row["error_id"]),
        "events": [],
        "explanation": row["error_message"] or "",
        "suggested_action": None,
        "metadata": {
            "tenant_id": str(row["tenant_id"]) if row["tenant_id"] else None,
            "call_id": row["call_id"],
            "error_type": row["error_type"],
            "severity": row["severity"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        },
    }
