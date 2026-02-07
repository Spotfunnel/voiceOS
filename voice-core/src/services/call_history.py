"""
Call history service.

Stores and retrieves recent call summaries per tenant + caller phone.
Used to provide continuity across calls.
"""

import logging
from typing import List, Optional, Dict, Any

from psycopg2.extras import RealDictCursor

from ..database.db_service import get_db_service
from .phone_routing import normalize_phone_number

logger = logging.getLogger(__name__)


def get_recent_call_history(
    tenant_id: str,
    caller_phone: Optional[str],
    limit: int = 3,
) -> List[Dict[str, Any]]:
    if not tenant_id or not caller_phone:
        return []

    normalized = normalize_phone_number(caller_phone)
    db = get_db_service()
    conn = db.get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT summary, outcome, created_at
                FROM call_history
                WHERE tenant_id = %s::uuid AND caller_phone = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (tenant_id, normalized, limit),
            )
            return cur.fetchall()
    except Exception as exc:
        logger.exception("Failed to fetch call history: %s", exc)
        return []
    finally:
        db.put_connection(conn)


def insert_call_summary(
    tenant_id: str,
    caller_phone: Optional[str],
    summary: str,
    outcome: Optional[str] = None,
    conversation_id: Optional[str] = None,
    call_sid: Optional[str] = None,
    started_at: Optional[str] = None,
    ended_at: Optional[str] = None,
) -> bool:
    if not tenant_id or not summary:
        return False

    normalized = normalize_phone_number(caller_phone or "")
    db = get_db_service()
    conn = db.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO call_history (
                    tenant_id, caller_phone, summary, outcome,
                    conversation_id, call_sid, started_at, ended_at
                ) VALUES (%s::uuid, %s, %s, %s, %s::uuid, %s, %s, %s)
                """,
                (
                    tenant_id,
                    normalized or None,
                    summary,
                    outcome,
                    conversation_id,
                    call_sid,
                    started_at,
                    ended_at,
                ),
            )
        conn.commit()
        return True
    except Exception as exc:
        logger.exception("Failed to insert call summary: %s", exc)
        conn.rollback()
        return False
    finally:
        db.put_connection(conn)
