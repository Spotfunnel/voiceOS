"""
Onboarding wizard backend API.

Tracks operator progress through a 6-step configuration flow.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import psycopg2.extras

from .tenant_config import CreateTenantRequest, create_tenant, update_tenant_config
from ..database.db_service import get_db_service
from ..middleware.auth import require_admin
from ..prompts.knowledge_combiner import (
    KnowledgeTooLargeError,
    validate_static_knowledge,
)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

DEFAULT_REASONS = [
    "New booking",
    "Reschedule",
    "Pricing inquiry",
    "Service follow-up",
    "Emergency request",
]

DEFAULT_OUTCOMES = [
    {"label": "Booked", "action_required": True, "pipeline_values": []},
    {"label": "Quote sent", "action_required": False, "pipeline_values": []},
    {"label": "Follow-up required", "action_required": True, "pipeline_values": []},
    {"label": "No answer", "action_required": False, "pipeline_values": []},
    {"label": "Unqualified", "action_required": False, "pipeline_values": []},
]

DEFAULT_PIPELINE_VALUES = [
    {"id": "base", "name": "Standard booking", "value": "250"},
    {"id": "premium", "name": "Premium install", "value": "650"},
]

DEFAULT_REPORT_FIELDS = [
    {"id": "transcript", "label": "Transcript", "required": True, "global": True},
    {"id": "summary", "label": "Summary", "required": True, "global": True},
    {"id": "name", "label": "Name", "required": True, "global": True},
    {"id": "call_number", "label": "Call Number", "required": True, "global": True},
    {"id": "email", "label": "Email", "required": False, "global": True},
    {"id": "address", "label": "Address", "required": False, "global": True},
]


class OnboardingSession(BaseModel):
    session_id: str
    current_step: int
    business_name: Optional[str] = None
    industry: Optional[str] = None
    business_description: Optional[str] = None
    system_prompt: Optional[str] = None
    knowledge_base: Optional[str] = None  # Deprecated - for backwards compatibility
    knowledge_bases: Optional[list] = None  # New: multiple named KBs
    n8n_workflows: Optional[list] = None
    dashboard_reasons: Optional[list] = None
    dashboard_outcomes: Optional[list] = None
    pipeline_values: Optional[list] = None
    dashboard_report_fields: Optional[list] = None
    stress_test_completed: bool = False
    phone_number: Optional[str] = None
    telnyx_api_key: Optional[str] = None
    telnyx_connection_id: Optional[str] = None
    telnyx_phone_number: Optional[str] = None
    voice_webhook_url: Optional[str] = None
    status_callback_url: Optional[str] = None
    transfer_contact_name: Optional[str] = None
    transfer_contact_title: Optional[str] = None
    transfer_contact_phone: Optional[str] = None
    is_live: bool = False
    created_at: datetime
    updated_at: datetime


sessions: Dict[str, OnboardingSession] = {}


def _ensure_dashboard_options_table(conn):
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS dashboard_options (
            id INTEGER PRIMARY KEY,
            reasons JSONB NOT NULL,
            outcomes JSONB NOT NULL,
            pipeline_values JSONB NOT NULL DEFAULT '[]'::jsonb,
            report_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
        """
    )
    conn.commit()


def _load_dashboard_options(conn):
    _ensure_dashboard_options_table(conn)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT reasons, outcomes, pipeline_values, report_fields FROM dashboard_options WHERE id = 1"
    )
    row = cur.fetchone()
    if row:
        return (
            row["reasons"],
            row["outcomes"],
            row.get("pipeline_values") or [],
            row.get("report_fields") or [],
        )
    return DEFAULT_REASONS, DEFAULT_OUTCOMES, DEFAULT_PIPELINE_VALUES, DEFAULT_REPORT_FIELDS


def _save_dashboard_options(conn, reasons, outcomes, pipeline_values, report_fields):
    _ensure_dashboard_options_table(conn)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO dashboard_options (id, reasons, outcomes, pipeline_values, report_fields, updated_at)
        VALUES (1, %s, %s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE SET
            reasons = EXCLUDED.reasons,
            outcomes = EXCLUDED.outcomes,
            pipeline_values = EXCLUDED.pipeline_values,
            report_fields = EXCLUDED.report_fields,
            updated_at = NOW()
        """,
        (
            psycopg2.extras.Json(reasons),
            psycopg2.extras.Json(outcomes),
            psycopg2.extras.Json(pipeline_values),
            psycopg2.extras.Json(report_fields),
        ),
    )
    conn.commit()


@router.post("/start", response_model=OnboardingSession)
async def start_onboarding(auth_session: dict = Depends(require_admin)):
    session_id = str(uuid.uuid4())
    now = datetime.now()
    db_service = get_db_service()
    conn = db_service.get_connection()
    reasons, outcomes, pipeline_values, report_fields = _load_dashboard_options(conn)
    db_service.put_connection(conn)
    session = OnboardingSession(
        session_id=session_id,
        current_step=1,
        dashboard_reasons=reasons,
        dashboard_outcomes=outcomes,
        pipeline_values=pipeline_values,
        dashboard_report_fields=report_fields,
        created_at=now,
        updated_at=now,
    )
    sessions[session_id] = session
    return session


@router.get("/{session_id}", response_model=OnboardingSession)
async def get_onboarding_session(session_id: str, auth_session: dict = Depends(require_admin)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _save_session(session: OnboardingSession):
    session.updated_at = datetime.now()
    sessions[session.session_id] = session


@router.put("/{session_id}/step/{step}", response_model=OnboardingSession)
async def update_onboarding_step(
    session_id: str,
    step: int,
    data: Dict[str, Any],
    auth_session: dict = Depends(require_admin),
):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if step < 1 or step > 5:
        raise HTTPException(status_code=400, detail="Invalid step")

    if step == 1:
        session.business_name = data.get("business_name")
        session.industry = data.get("industry")
        session.business_description = data.get("business_description")
    elif step == 2:
        session.system_prompt = data.get("system_prompt")
        session.knowledge_base = data.get("knowledge_base")  # Deprecated
        session.knowledge_bases = data.get("knowledge_bases", [])
    elif step == 3:
        session.dashboard_reasons = data.get("dashboard_reasons", [])
        session.dashboard_outcomes = data.get("dashboard_outcomes", [])
        session.pipeline_values = data.get("pipeline_values", [])
        session.dashboard_report_fields = data.get("dashboard_report_fields", [])
        db_service = get_db_service()
        conn = db_service.get_connection()
        _save_dashboard_options(
            conn,
            session.dashboard_reasons,
            session.dashboard_outcomes,
            session.pipeline_values,
            session.dashboard_report_fields,
        )
        db_service.put_connection(conn)
    elif step == 4:
        session.n8n_workflows = data.get("n8n_workflows", [])
    elif step == 5:
        session.phone_number = data.get("phone_number")
        session.telnyx_api_key = data.get("telnyx_api_key") or data.get("twilio_account_sid")
        session.telnyx_connection_id = data.get("telnyx_connection_id") or data.get("twilio_auth_token")
        session.telnyx_phone_number = data.get("telnyx_phone_number") or data.get("twilio_phone_number")
        session.voice_webhook_url = data.get("voice_webhook_url")
        session.status_callback_url = data.get("status_callback_url")
        session.transfer_contact_name = data.get("transfer_contact_name")
        session.transfer_contact_title = data.get("transfer_contact_title")
        session.transfer_contact_phone = data.get("transfer_contact_phone")
        session.is_live = data.get("is_live", session.is_live)

    session.current_step = step
    _save_session(session)
    return session


@router.post("/{session_id}/complete")
async def complete_onboarding(session_id: str, auth_session: dict = Depends(require_admin)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Stress test now handled in Persona & Purpose step

    if not session.business_name or not session.phone_number:
        raise HTTPException(status_code=400, detail="Incomplete onboarding data")

    create_request = CreateTenantRequest(
        business_name=session.business_name,
        phone_number=session.phone_number,
        template_id="full_receptionist",
    )
    tenant = await create_tenant(create_request)

    if session.system_prompt:
        tenant.system_prompt = session.system_prompt
    
    # Handle old single knowledge_base (deprecated)
    if session.knowledge_base:
        tenant.static_knowledge = session.knowledge_base
    
    await update_tenant_config(tenant.tenant_id, tenant)
    
    # Save multiple knowledge bases to new table
    if session.knowledge_bases:
        db_service = get_db_service()
        conn = db_service.get_connection()
        cur = conn.cursor()
        
        try:
            for kb in session.knowledge_bases:
                # Skip temporary IDs from frontend
                if not kb.get('id') or str(kb.get('id', '')).startswith('temp-'):
                    kb_id = str(uuid.uuid4())
                else:
                    kb_id = kb['id']
                
                cur.execute(
                    """
                    INSERT INTO tenant_knowledge_bases (id, tenant_id, name, description, content, filler_text)
                    VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, name) DO UPDATE SET
                        description = EXCLUDED.description,
                        content = EXCLUDED.content,
                        filler_text = EXCLUDED.filler_text,
                        updated_at = NOW()
                    """,
                    (
                        kb_id,
                        str(tenant.tenant_id),
                        kb['name'],
                        kb.get('description', ''),
                        kb['content'],
                        kb.get('filler_text'),
                    )
                )
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to save knowledge bases: {e}", exc_info=True)
        finally:
            cur.close()
            db_service.put_connection(conn)

    # Persist per-tenant onboarding settings for Operations -> Configure
    try:
        db_service = get_db_service()
        conn = db_service.get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO tenant_onboarding_settings (
                tenant_id, system_prompt, knowledge_base, n8n_workflows,
                dashboard_reasons, dashboard_outcomes, pipeline_values,
                dashboard_report_fields, telephony, updated_at
            ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (tenant_id) DO UPDATE SET
                system_prompt = EXCLUDED.system_prompt,
                knowledge_base = EXCLUDED.knowledge_base,
                n8n_workflows = EXCLUDED.n8n_workflows,
                dashboard_reasons = EXCLUDED.dashboard_reasons,
                dashboard_outcomes = EXCLUDED.dashboard_outcomes,
                pipeline_values = EXCLUDED.pipeline_values,
                dashboard_report_fields = EXCLUDED.dashboard_report_fields,
                telephony = EXCLUDED.telephony,
                updated_at = NOW()
            """,
            (
                str(tenant.tenant_id),
                session.system_prompt,
                session.knowledge_base,
                psycopg2.extras.Json(session.n8n_workflows or []),
                psycopg2.extras.Json(session.dashboard_reasons or []),
                psycopg2.extras.Json(session.dashboard_outcomes or []),
                psycopg2.extras.Json(session.pipeline_values or []),
                psycopg2.extras.Json(session.dashboard_report_fields or []),
                psycopg2.extras.Json(
                    {
                        "phone_number": session.phone_number,
                        "telnyx_api_key": session.telnyx_api_key,
                        "telnyx_connection_id": session.telnyx_connection_id,
                        "telnyx_phone_number": session.telnyx_phone_number,
                        "voice_webhook_url": session.voice_webhook_url,
                        "status_callback_url": session.status_callback_url,
                        "transfer_contact_name": session.transfer_contact_name,
                        "transfer_contact_title": session.transfer_contact_title,
                        "transfer_contact_phone": session.transfer_contact_phone,
                    }
                ),
            ),
        )
        conn.commit()
        db_service.put_connection(conn)
    except Exception as exc:
        logger.error(f"Failed to persist onboarding settings: {exc}", exc_info=True)

    session.is_live = True
    _save_session(session)
    return {"tenant_id": tenant.tenant_id, "session_id": session.session_id}


class KnowledgeValidationRequest(BaseModel):
    knowledge: str


@router.post("/validate-knowledge")
async def validate_knowledge(
    payload: KnowledgeValidationRequest,
    session: dict = Depends(require_admin),
):
    try:
        tokens = validate_static_knowledge(payload.knowledge)
    except KnowledgeTooLargeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"tokens": tokens}
