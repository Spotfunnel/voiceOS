"""
Call history API.

Allows writing and reading call summaries for a given tenant + caller phone.
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ..services.call_history import get_recent_call_history, insert_call_summary
from ..middleware.auth import require_auth, check_tenant_access

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/call-history", tags=["call-history"])


class CallHistoryEntry(BaseModel):
    summary: str
    outcome: Optional[str] = None
    created_at: Optional[str] = None


class CallHistoryCreate(BaseModel):
    tenant_id: str
    caller_phone: Optional[str] = None
    summary: str = Field(..., min_length=1)
    outcome: Optional[str] = None
    conversation_id: Optional[str] = None
    call_sid: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None


@router.get("/{tenant_id}/{caller_phone}", response_model=List[CallHistoryEntry])
async def list_call_history(
    tenant_id: str,
    caller_phone: str,
    limit: int = 3,
    session: dict = Depends(require_auth),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    items = get_recent_call_history(tenant_id, caller_phone, limit=limit)
    return [
        CallHistoryEntry(
            summary=item.get("summary", ""),
            outcome=item.get("outcome"),
            created_at=item.get("created_at").isoformat() if item.get("created_at") else None,
        )
        for item in items
    ]


@router.post("", response_model=dict)
async def create_call_history(
    entry: CallHistoryCreate,
    session: dict = Depends(require_auth),
):
    if not check_tenant_access(session, entry.tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    ok = insert_call_summary(
        tenant_id=entry.tenant_id,
        caller_phone=entry.caller_phone,
        summary=entry.summary,
        outcome=entry.outcome,
        conversation_id=entry.conversation_id,
        call_sid=entry.call_sid,
        started_at=entry.started_at,
        ended_at=entry.ended_at,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save call history")
    return {"success": True}
