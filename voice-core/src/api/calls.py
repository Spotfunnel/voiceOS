"""
Call log mutation endpoints.
"""

from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import psycopg2.extras

from ..database.db_service import get_db_service
from ..middleware.auth import require_auth, check_tenant_access

router = APIRouter(prefix="/api/calls", tags=["calls"])


class CallUpdateRequest(BaseModel):
    tenant_id: str
    summary: Optional[str] = None
    outcome: Optional[str] = None
    requires_action: Optional[bool] = None
    priority: Optional[str] = None
    captured_data: Optional[Dict[str, Any]] = None


class CallArchiveRequest(BaseModel):
    tenant_id: str
    ids: List[str]


@router.patch("/{call_log_id}")
async def update_call_log(
    call_log_id: str,
    payload: CallUpdateRequest,
    session: dict = Depends(require_auth),
):
    if not check_tenant_access(session, payload.tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")

    db_service = get_db_service()
    conn = None
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        updates = []
        params = []

        if payload.summary is not None:
            updates.append("summary = %s")
            params.append(payload.summary)
        if payload.outcome is not None:
            updates.append("outcome = %s")
            params.append(payload.outcome)
        if payload.requires_action is not None:
            updates.append("requires_action = %s")
            params.append(payload.requires_action)
        if payload.priority is not None:
            updates.append("priority = %s")
            params.append(payload.priority)
        if payload.captured_data is not None:
            updates.append("captured_data = %s")
            params.append(psycopg2.extras.Json(payload.captured_data))

        if not updates:
            return {"success": True}

        params.extend([payload.tenant_id, call_log_id])
        cur.execute(
            f"""
            UPDATE call_logs
            SET {", ".join(updates)}, updated_at = NOW()
            WHERE tenant_id = %s::uuid AND id = %s::uuid
            """,
            params,
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Call log not found")
        conn.commit()
        return {"success": True}
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as exc:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.post("/archive")
async def archive_calls(
    payload: CallArchiveRequest,
    session: dict = Depends(require_auth),
):
    if not check_tenant_access(session, payload.tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if not payload.ids:
        raise HTTPException(status_code=400, detail="ids required")

    db_service = get_db_service()
    conn = None
    try:
        conn = db_service.get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE call_logs
            SET archived_at = NOW()
            WHERE tenant_id = %s::uuid AND id = ANY(%s)
            """,
            (payload.tenant_id, payload.ids),
        )
        conn.commit()
        return {"success": True}
    except Exception as exc:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)
