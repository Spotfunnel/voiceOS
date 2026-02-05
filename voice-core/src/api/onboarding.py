"""
Onboarding wizard backend API.

Tracks operator progress through a 6-step configuration flow.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .tenant_config import CreateTenantRequest, create_tenant, update_tenant_config
from ..prompts.knowledge_combiner import (
    KnowledgeTooLargeError,
    validate_static_knowledge,
)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


class OnboardingSession(BaseModel):
    session_id: str
    current_step: int
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    phone_number: Optional[str] = None
    contact_email: Optional[str] = None
    state: Optional[str] = None
    timezone: Optional[str] = None
    business_hours: Optional[str] = None
    template_id: Optional[str] = None
    customizations: Dict[str, Any] = {}
    static_knowledge: Optional[str] = None
    test_call_completed: bool = False
    is_live: bool = False
    created_at: datetime
    updated_at: datetime


sessions: Dict[str, OnboardingSession] = {}


@router.post("/start", response_model=OnboardingSession)
async def start_onboarding():
    session_id = str(uuid.uuid4())
    now = datetime.now()
    session = OnboardingSession(
        session_id=session_id,
        current_step=1,
        created_at=now,
        updated_at=now,
    )
    sessions[session_id] = session
    return session


@router.get("/{session_id}", response_model=OnboardingSession)
async def get_onboarding_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _save_session(session: OnboardingSession):
    session.updated_at = datetime.now()
    sessions[session.session_id] = session


@router.put("/{session_id}/step/{step}", response_model=OnboardingSession)
async def update_onboarding_step(session_id: str, step: int, data: Dict[str, Any]):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if step < 1 or step > 6:
        raise HTTPException(status_code=400, detail="Invalid step")

    if step == 1:
        session.business_name = data.get("business_name")
        session.business_type = data.get("business_type")
        session.phone_number = data.get("phone_number")
        session.contact_email = data.get("contact_email")
        session.state = data.get("state")
        session.timezone = data.get("timezone")
        session.business_hours = data.get("business_hours")
    elif step == 2:
        session.template_id = data.get("template_id")
    elif step == 3:
        session.customizations = data
    elif step == 4:
        session.static_knowledge = data.get("static_knowledge")
    elif step == 5:
        session.test_call_completed = data.get("test_call_completed", False)
    elif step == 6:
        session.is_live = data.get("is_live", session.is_live)

    session.current_step = step
    _save_session(session)
    return session


@router.post("/{session_id}/complete")
async def complete_onboarding(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.test_call_completed:
        raise HTTPException(status_code=400, detail="Test call must be completed")

    if not session.business_name or not session.phone_number or not session.template_id:
        raise HTTPException(status_code=400, detail="Incomplete onboarding data")

    create_request = CreateTenantRequest(
        business_name=session.business_name,
        phone_number=session.phone_number,
        template_id=session.template_id,
    )
    tenant = await create_tenant(create_request)

    if session.customizations:
        customizations = session.customizations
        tenant.service_catalog = customizations.get(
            "service_catalog", tenant.service_catalog
        )
        tenant.faq_knowledge_base = customizations.get(
            "faq_knowledge_base", tenant.faq_knowledge_base
        )
        tenant.system_prompt = customizations.get(
            "system_prompt", tenant.system_prompt
        )
        tenant.agent_role = customizations.get("agent_role", tenant.agent_role)
        tenant.agent_personality = customizations.get(
            "agent_personality", tenant.agent_personality
        )
        tenant.greeting_message = customizations.get(
            "greeting_message", tenant.greeting_message
        )
        await update_tenant_config(tenant.tenant_id, tenant)

    if session.static_knowledge:
        tenant.static_knowledge = session.static_knowledge
        await update_tenant_config(tenant.tenant_id, tenant)

    session.is_live = True
    _save_session(session)
    return {"tenant_id": tenant.tenant_id, "session_id": session.session_id}


class KnowledgeValidationRequest(BaseModel):
    knowledge: str


@router.post("/validate-knowledge")
async def validate_knowledge(payload: KnowledgeValidationRequest):
    try:
        tokens = validate_static_knowledge(payload.knowledge)
    except KnowledgeTooLargeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"tokens": tokens}
