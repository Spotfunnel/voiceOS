"""
Error tracking service.
"""

from __future__ import annotations

import json
import logging
import traceback
from typing import Optional, Dict, Any

from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)


def log_system_error(
    error_type: str,
    error_message: str,
    *,
    tenant_id: Optional[str] = None,
    call_id: Optional[str] = None,
    severity: str = "ERROR",
    context: Optional[Dict[str, Any]] = None,
    exception: Optional[Exception] = None,
) -> None:
    stack_trace = None
    if exception:
        stack_trace = traceback.format_exc()

    db_service = get_db_service()
    conn = db_service.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO system_errors (
                tenant_id, call_id, error_type, error_message,
                stack_trace, severity, context
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                call_id,
                error_type,
                error_message,
                stack_trace,
                severity,
                json.dumps(context) if context else None,
            ),
        )
        conn.commit()
    except Exception as exc:
        logger.error("Failed to log error to database: %s", exc)
    finally:
        db_service.put_connection(conn)
