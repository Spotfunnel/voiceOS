"""
Authentication middleware for FastAPI endpoints.

Validates session tokens and provides user context.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import HTTPException, Cookie, Header
import psycopg2.extras

from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)


def _extract_session_token(
    session_token: Optional[str],
    authorization: Optional[str],
    x_session_token: Optional[str],
) -> Optional[str]:
    if session_token:
        return session_token
    if x_session_token:
        return x_session_token
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def get_session_from_token(session_token: str) -> Optional[Dict[str, Any]]:
    session_hash = hashlib.sha256(session_token.encode()).hexdigest()
    db_service = get_db_service()
    conn = db_service.get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                s.session_id,
                s.user_id,
                s.expires_at,
                u.tenant_id,
                u.email,
                u.role,
                u.is_active
            FROM sessions s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.session_hash = %s
            """,
            (session_hash,),
        )
        session = cur.fetchone()
        if not session:
            return None
        if session["expires_at"] and session["expires_at"] < datetime.now(timezone.utc):
            return None
        if not session["is_active"]:
            return None

        # Update last_accessed_at
        cur.execute(
            """
            UPDATE sessions
            SET last_accessed_at = NOW()
            WHERE session_id = %s
            """,
            (session["session_id"],),
        )
        conn.commit()

        return {
            "session_id": str(session["session_id"]),
            "user_id": str(session["user_id"]),
            "tenant_id": str(session["tenant_id"]),
            "email": session["email"],
            "role": session["role"],
        }
    except Exception as exc:
        logger.error("Failed to validate session: %s", exc)
        return None
    finally:
        db_service.put_connection(conn)


def require_auth(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
) -> Dict[str, Any]:
    token = _extract_session_token(session_token, authorization, x_session_token)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    session = get_session_from_token(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session


def require_admin(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
) -> Dict[str, Any]:
    session = require_auth(
        session_token=session_token,
        authorization=authorization,
        x_session_token=x_session_token,
    )
    if session["role"] not in ("operator", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return session


def check_tenant_access(session: Dict[str, Any], tenant_id: str) -> bool:
    if session["role"] in ("operator", "admin"):
        return True
    return session.get("tenant_id") == tenant_id
