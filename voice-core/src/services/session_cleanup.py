"""
Background job to clean up expired sessions.
"""
from __future__ import annotations

import asyncio
import logging

from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)


async def cleanup_expired_sessions() -> int:
    """Delete expired sessions from database."""
    db_service = get_db_service()
    conn = db_service.get_connection()

    try:
        cur = conn.cursor()
        cur.execute(
            """
            DELETE FROM sessions
            WHERE expires_at < NOW()
            RETURNING session_id
            """
        )
        deleted_ids = cur.fetchall()
        deleted_count = len(deleted_ids)
        conn.commit()

        if deleted_count > 0:
            logger.info("Cleaned up %s expired sessions", deleted_count)

        return deleted_count
    except Exception as exc:
        logger.error("Failed to cleanup sessions: %s", exc)
        conn.rollback()
        return 0
    finally:
        cur.close()
        db_service.put_connection(conn)


async def session_cleanup_task() -> None:
    """Run cleanup every hour."""
    while True:
        try:
            await cleanup_expired_sessions()
        except Exception as exc:
            logger.exception("Session cleanup task failed: %s", exc)
        await asyncio.sleep(3600)


def start_session_cleanup_task() -> None:
    """Start the session cleanup background task."""
    asyncio.create_task(session_cleanup_task())
    logger.info("Session cleanup task started (runs hourly)")
