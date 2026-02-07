"""
Tenant configuration API.

Creates, reads, and updates tenant configs/templates for onboarding.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import psycopg2.extras

from ..database.db_service import get_db_connection
from ..middleware.auth import require_admin, check_tenant_access

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tenants", tags=["tenants"])


class OnboardingSettings(BaseModel):
    tenant_id: str
    system_prompt: Optional[str] = None
    knowledge_base: Optional[str] = None
    n8n_workflows: List[Dict[str, Any]] = Field(default_factory=list)
    dashboard_reasons: List[str] = Field(default_factory=list)
    dashboard_outcomes: List[Dict[str, Any]] = Field(default_factory=list)
    pipeline_values: List[Dict[str, Any]] = Field(default_factory=list)
    dashboard_report_fields: List[Dict[str, Any]] = Field(default_factory=list)
    telephony: Dict[str, Any] = Field(default_factory=dict)


@router.get("/{tenant_id}/onboarding-settings", response_model=OnboardingSettings)
async def get_onboarding_settings(
    tenant_id: str,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT tenant_id, system_prompt, knowledge_base, n8n_workflows,
                   dashboard_reasons, dashboard_outcomes, pipeline_values,
                   dashboard_report_fields, telephony
            FROM tenant_onboarding_settings
            WHERE tenant_id = %s
            """,
            (tenant_id,),
        )
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Settings not found")

        return OnboardingSettings(
            tenant_id=str(row["tenant_id"]),
            system_prompt=row.get("system_prompt"),
            knowledge_base=row.get("knowledge_base"),
            n8n_workflows=row.get("n8n_workflows") or [],
            dashboard_reasons=row.get("dashboard_reasons") or [],
            dashboard_outcomes=row.get("dashboard_outcomes") or [],
            pipeline_values=row.get("pipeline_values") or [],
            dashboard_report_fields=row.get("dashboard_report_fields") or [],
            telephony=row.get("telephony") or {},
        )
    finally:
        cur.close()
        conn.close()


@router.put("/{tenant_id}/onboarding-settings", response_model=OnboardingSettings)
async def update_onboarding_settings(
    tenant_id: str,
    payload: OnboardingSettings,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    conn = get_db_connection()
    try:
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
                tenant_id,
                payload.system_prompt,
                payload.knowledge_base,
                json.dumps(payload.n8n_workflows),
                json.dumps(payload.dashboard_reasons),
                json.dumps(payload.dashboard_outcomes),
                json.dumps(payload.pipeline_values),
                json.dumps(payload.dashboard_report_fields),
                json.dumps(payload.telephony),
            ),
        )
        conn.commit()

        return OnboardingSettings(
            tenant_id=tenant_id,
            system_prompt=payload.system_prompt,
            knowledge_base=payload.knowledge_base,
            n8n_workflows=payload.n8n_workflows,
            dashboard_reasons=payload.dashboard_reasons,
            dashboard_outcomes=payload.dashboard_outcomes,
            pipeline_values=payload.pipeline_values,
            dashboard_report_fields=payload.dashboard_report_fields,
            telephony=payload.telephony,
        )
    finally:
        cur.close()
        conn.close()


class ServiceCatalogItem(BaseModel):
    id: str
    name: str
    keywords: List[str]
    description: Optional[str] = None


class FAQItem(BaseModel):
    question: str
    keywords: List[str]
    answer: str


class TenantConfig(BaseModel):
    tenant_id: str
    business_name: str
    phone_number: str
    locale: str = "en-AU"
    system_prompt: Optional[str] = None
    agent_role: str = "receptionist"
    agent_personality: str = "friendly"
    greeting_message: Optional[str] = None
    static_knowledge: Optional[str] = None
    objective_graph: Dict[str, Any]
    service_catalog: List[ServiceCatalogItem] = Field(default_factory=list)
    faq_knowledge_base: List[FAQItem] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class CreateTenantRequest(BaseModel):
    business_name: str
    phone_number: str
    template_id: str
    locale: str = "en-AU"


def _load_json(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def load_template(template_id: str) -> Optional[Dict[str, Any]]:
    path = os.path.join("voice-core", "templates", f"{template_id}.json")
    try:
        return _load_json(path)
    except FileNotFoundError:
        return None


def _to_tenant_config(tenant_row, config_row, template_data) -> TenantConfig:
    return TenantConfig(
        tenant_id=tenant_row["tenant_id"],
        business_name=tenant_row["business_name"],
        phone_number=tenant_row["phone_number"],
        locale=tenant_row.get("locale", "en-AU"),
        system_prompt=tenant_row.get("system_prompt"),
        agent_role=tenant_row.get("agent_role", "receptionist"),
        agent_personality=tenant_row.get("agent_personality", "friendly"),
        greeting_message=tenant_row.get("greeting_message"),
        static_knowledge=tenant_row.get("static_knowledge"),
        objective_graph=json.loads(config_row["objective_graph"]) if isinstance(config_row["objective_graph"], str) else config_row["objective_graph"],
        service_catalog=template_data.get("service_catalog", []),
        faq_knowledge_base=template_data.get("faq_knowledge_base", []),
        created_at=tenant_row["created_at"],
    )


@router.get("/{tenant_id}/config", response_model=TenantConfig)
async def get_tenant_config(
    tenant_id: str,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT tenant_id, business_name, phone_number, locale, created_at,
                   system_prompt, agent_role, agent_personality, greeting_message,
                   static_knowledge
            FROM tenants WHERE tenant_id = %s
            """,
            (tenant_id,),
        )
        tenant = cur.fetchone()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        cur.execute(
            "SELECT objective_graph FROM objective_configs WHERE tenant_id = %s AND active = true",
            (tenant_id,),
        )
        config = cur.fetchone()
        if not config:
            raise HTTPException(status_code=404, detail="Tenant config not found")

        # Load template data for service catalog / FAQ
        template_data = {}
        obj_graph = json.loads(config["objective_graph"]) if isinstance(config["objective_graph"], str) else config["objective_graph"]
        
        return _to_tenant_config(tenant, config, template_data)
    finally:
        cur.close()
        conn.close()


@router.post("", response_model=TenantConfig)
async def create_tenant(request: CreateTenantRequest, session: dict = Depends(require_admin)):
    tenant_id = str(uuid.uuid4())
    template = load_template(request.template_id)
    if not template:
        raise HTTPException(status_code=400, detail="Invalid template")

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO tenants (
                tenant_id, business_name, phone_number, created_at,
                system_prompt, agent_role, agent_personality, greeting_message,
                static_knowledge
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                request.business_name,
                request.phone_number,
                datetime.now(),
                template.get("system_prompt"),
                template.get("agent_role", "receptionist"),
                template.get("agent_personality", "friendly"),
                template.get("greeting_message"),
                template.get("static_knowledge"),
            ),
        )
        cur.execute(
            """
            INSERT INTO objective_configs (tenant_id, version, objective_graph, active, schema_version)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                1,
                json.dumps(template["objective_graph"]),
                True,
                "v1",
            ),
        )
        conn.commit()
        return TenantConfig(
            tenant_id=tenant_id,
            business_name=request.business_name,
            phone_number=request.phone_number,
            locale=request.locale,
            system_prompt=template.get("system_prompt"),
            agent_role=template.get("agent_role", "receptionist"),
            agent_personality=template.get("agent_personality", "friendly"),
            greeting_message=template.get("greeting_message"),
            static_knowledge=template.get("static_knowledge"),
            objective_graph=template["objective_graph"],
            service_catalog=template.get("service_catalog", []),
            faq_knowledge_base=template.get("faq_knowledge_base", []),
            created_at=datetime.now(),
        )
    except Exception as exc:
        conn.rollback()
        logger.exception("Failed to create tenant: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create tenant")
    finally:
        cur.close()
        conn.close()


@router.put("/{tenant_id}/config", response_model=TenantConfig)
async def update_tenant_config(
    tenant_id: str,
    config: TenantConfig,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT tenant_id FROM tenants WHERE tenant_id = %s",
            (tenant_id,),
        )
        tenant = cur.fetchone()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Update tenant metadata
        cur.execute(
            """
            UPDATE tenants
            SET system_prompt = %s, agent_role = %s, agent_personality = %s, greeting_message = %s, static_knowledge = %s
            WHERE tenant_id = %s
            """,
            (
                config.system_prompt,
                config.agent_role,
                config.agent_personality,
                config.greeting_message,
                config.static_knowledge,
                tenant_id,
            ),
        )

        # Deactivate old config
        cur.execute(
            "UPDATE objective_configs SET active = false WHERE tenant_id = %s",
            (tenant_id,),
        )
        
        # Get next version
        cur.execute(
            "SELECT COALESCE(MAX(version), 0) FROM objective_configs WHERE tenant_id = %s",
            (tenant_id,),
        )
        max_version = cur.fetchone()[0]
        
        # Insert new version
        cur.execute(
            """
            INSERT INTO objective_configs (tenant_id, version, objective_graph, active, schema_version)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                max_version + 1,
                json.dumps(config.objective_graph),
                True,
                "v1",
            ),
        )
        conn.commit()
        return config
    except Exception as exc:
        conn.rollback()
        logger.exception("Failed to update tenant config: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update tenant config")
    finally:
        cur.close()
        conn.close()


@router.get("/templates")
async def list_templates(session: dict = Depends(require_admin)):
    return [
        {"id": "lead_capture", "name": "Lead Capture", "description": "Basic lead generation flow"},
        {"id": "appointment_booking", "name": "Appointment Booking", "description": "Full appointment scheduling"},
        {"id": "full_receptionist", "name": "Full Receptionist", "description": "Lead capture + appointments + FAQ + automation"},
    ]
