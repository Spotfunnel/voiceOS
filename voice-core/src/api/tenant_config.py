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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..database.db_service import get_db_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tenants", tags=["tenants"])


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


def _to_tenant_config(tenant_row, config_row) -> TenantConfig:
    return TenantConfig(
        tenant_id=tenant_row["tenant_id"],
        business_name=tenant_row["business_name"],
        phone_number=tenant_row["phone_number"],
        locale=config_row["locale"],
        objective_graph=json.loads(config_row["objective_graph"]),
        service_catalog=config_row.get("service_catalog") or [],
        faq_knowledge_base=config_row.get("faq_knowledge_base") or [],
        created_at=tenant_row["created_at"],
    )


@router.get("/{tenant_id}/config", response_model=TenantConfig)
async def get_tenant_config(tenant_id: str):
    conn = get_db_connection()
    try:
        tenant = conn.execute(
            "SELECT tenant_id, business_name, phone_number, created_at FROM tenants WHERE tenant_id = ?",
            (tenant_id,),
        ).fetchone()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        config = conn.execute(
            "SELECT objective_graph, locale, service_catalog, faq_knowledge_base FROM tenant_configs WHERE tenant_id = ?",
            (tenant_id,),
        ).fetchone()
        if not config:
            raise HTTPException(status_code=404, detail="Tenant config not found")

        return _to_tenant_config(tenant, config)
    finally:
        conn.close()


@router.post("", response_model=TenantConfig)
async def create_tenant(request: CreateTenantRequest):
    tenant_id = str(uuid.uuid4())
    template = load_template(request.template_id)
    if not template:
        raise HTTPException(status_code=400, detail="Invalid template")

    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO tenants (tenant_id, business_name, phone_number, created_at) VALUES (?, ?, ?, ?)",
            (tenant_id, request.business_name, request.phone_number, datetime.now()),
        )
        conn.execute(
            """
            INSERT INTO tenant_configs (tenant_id, objective_graph, service_catalog, faq_knowledge_base, locale)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                tenant_id,
                json.dumps(template["objective_graph"]),
                json.dumps(template.get("service_catalog", [])),
                json.dumps(template.get("faq_knowledge_base", [])),
                request.locale,
            ),
        )
        conn.commit()
        return TenantConfig(
            tenant_id=tenant_id,
            business_name=request.business_name,
            phone_number=request.phone_number,
            locale=request.locale,
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
        conn.close()


@router.put("/{tenant_id}/config", response_model=TenantConfig)
async def update_tenant_config(tenant_id: str, config: TenantConfig):
    conn = get_db_connection()
    try:
        tenant = conn.execute("SELECT tenant_id FROM tenants WHERE tenant_id = ?", (tenant_id,)).fetchone()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        conn.execute(
            """
            UPDATE tenant_configs
            SET objective_graph = ?, service_catalog = ?, faq_knowledge_base = ?, locale = ?
            WHERE tenant_id = ?
            """,
            (
                json.dumps(config.objective_graph),
                json.dumps([item.dict() for item in config.service_catalog]),
                json.dumps([item.dict() for item in config.faq_knowledge_base]),
                config.locale,
                tenant_id,
            ),
        )
        conn.commit()
        return config
    except Exception as exc:
        conn.rollback()
        logger.exception("Failed to update tenant config: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update tenant config")
    finally:
        conn.close()


@router.get("/templates")
async def list_templates():
    return [
        {"id": "lead_capture", "name": "Lead Capture", "description": "Basic lead generation flow"},
        {"id": "appointment_booking", "name": "Appointment Booking", "description": "Full appointment scheduling"},
        {"id": "full_receptionist", "name": "Full Receptionist", "description": "Lead capture + appointments + FAQ + automation"},
    ]
