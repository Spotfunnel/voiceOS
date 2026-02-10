"\"\"\""
"Phone routing service for tenant lookup."
"\"\"\""

import asyncio
import json
import logging
import re
from typing import Any, Dict, Optional

from psycopg2.extras import RealDictCursor

from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)


def normalize_phone_number(phone: str) -> str:
    """
    Normalize phone number to E.164 format for matching.
    """
    digits = re.sub(r"[^\d+]", "", phone)
    if not digits:
        return phone

    if not digits.startswith("+"):
        if digits.startswith("61"):
            digits = f"+{digits}"
        elif digits.startswith("0"):
            digits = f"+61{digits[1:]}"
        else:
            digits = f"+{digits}"

    return digits


async def resolve_phone_to_tenant(phone_number: str) -> Optional[str]:
    """
    Look up tenant ID for an incoming phone number.
    """
    normalized = normalize_phone_number(phone_number)
    logger.info("Resolving phone routing: %s → %s", phone_number, normalized)

    return await asyncio.to_thread(_query_phone_routing, normalized)


def _query_phone_routing(normalized_phone: str) -> Optional[str]:
    db = get_db_service()
    conn = db.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tenant_id FROM phone_routing WHERE phone_number = %s",
                (normalized_phone,),
            )
            row = cur.fetchone()
            if row:
                logger.info("Phone %s routed to tenant %s", normalized_phone, row[0])
                return row[0]
            logger.warning("No routing entry for %s", normalized_phone)
            return None
    except Exception as exc:
        logger.exception("Failed to query phone routing: %s", exc)
        return None
    finally:
        db.put_connection(conn)


async def get_tenant_config(tenant_id: str) -> Optional[Dict[str, Any]]:
    """
    Load tenant configuration for a given tenant.
    """
    return await asyncio.to_thread(_load_tenant_config, tenant_id)


def _load_tenant_config(tenant_id: str) -> Optional[Dict[str, Any]]:
    db = get_db_service()
    conn = db.get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    t.locale,
                    t.metadata,
                    t.system_prompt,
                    t.agent_role,
                    t.agent_personality,
                    t.greeting_message
                FROM tenants t
                WHERE t.tenant_id = %s
                """,
                (tenant_id,),
            )
            row = cur.fetchone()
            if not row:
                logger.warning("Tenant config not found for %s", tenant_id)
                return None

            metadata = _deserialize_json_field(row.get("metadata")) or {}
            return {
                "tenant_id": tenant_id,
                # objective_graph removed - using simple STT→LLM→TTS pipeline
                "locale": row.get("locale") or "en-AU",
                "service_catalog": metadata.get("service_catalog", []),
                "faq_knowledge_base": metadata.get("faq_knowledge_base", []),
                "system_prompt": row.get("system_prompt"),
                "agent_role": row.get("agent_role", "receptionist"),
                "agent_personality": row.get("agent_personality", "friendly"),
                "greeting_message": row.get("greeting_message"),
            }
    except Exception as exc:
        logger.exception("Failed to load tenant config: %s", exc)
        return None
    finally:
        db.put_connection(conn)


def _deserialize_json_field(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        logger.warning("Unable to parse JSON field: %s", value)
        return None
