"""
Prompt service for Layer 1 + Layer 2 prompt composition with caching.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional, Any

from psycopg2.extras import RealDictCursor, Json

from ..database.db_service import get_db_service
from ..prompts.knowledge_combiner import combine_prompts

logger = logging.getLogger(__name__)


class PromptService:
    """Manages Layer 1 + Layer 2 prompt combination with in-memory caching."""

    def __init__(self, db_service=None):
        self.db = db_service or get_db_service()
        self._cache: Dict[str, Optional[str]] = {}

    def get_system_prompt(
        self,
        tenant_id: str,
        static_knowledge: Optional[str] = None,
    ) -> str:
        """
        Get combined Layer 1 + Layer 2 prompt for a tenant.

        Args:
            tenant_id: Tenant UUID.
            static_knowledge: Optional Tier 1 knowledge.

        Returns:
            Combined system prompt string.
        """
        layer_2 = self._get_layer_2_cached(tenant_id)
        return combine_prompts(
            static_knowledge=static_knowledge,
            layer2_system_prompt=layer_2,
        )

    def _get_layer_2_cached(self, tenant_id: str) -> Optional[str]:
        if tenant_id not in self._cache:
            layer_2 = self._fetch_active_layer_2(tenant_id)
            self._cache[tenant_id] = layer_2
        return self._cache[tenant_id]

    def _fetch_active_layer_2(self, tenant_id: str) -> Optional[str]:
        query = """
            SELECT layer_2_content
            FROM prompts
            WHERE tenant_id = %s AND is_active = true
            ORDER BY version DESC
            LIMIT 1
        """
        conn = self.db.get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (tenant_id,))
                row = cur.fetchone()
                if row:
                    return row.get("layer_2_content")
        except Exception as exc:
            logger.exception("Failed to fetch Layer 2 prompt: %s", exc)
        finally:
            self.db.put_connection(conn)
        logger.warning("No active Layer 2 prompt for tenant %s", tenant_id)
        return None

    def update_layer_2(
        self,
        tenant_id: str,
        content: str,
        created_by: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Create new Layer 2 prompt version (deactivates old versions).

        Returns:
            New version number.
        """
        conn = self.db.get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
                    FROM prompts
                    WHERE tenant_id = %s
                    """,
                    (tenant_id,),
                )
                next_version = cur.fetchone()["next_version"]

                cur.execute(
                    "UPDATE prompts SET is_active = false WHERE tenant_id = %s",
                    (tenant_id,),
                )

                cur.execute(
                    """
                    INSERT INTO prompts (
                        tenant_id,
                        version,
                        layer_2_content,
                        is_active,
                        created_by,
                        metadata
                    ) VALUES (%s, %s, %s, true, %s, %s)
                    """,
                    (
                        tenant_id,
                        next_version,
                        content,
                        created_by,
                        Json(metadata or {}),
                    ),
                )
                conn.commit()
        except Exception as exc:
            conn.rollback()
            logger.exception("Failed to update Layer 2 prompt: %s", exc)
            raise
        finally:
            self.db.put_connection(conn)

        self._cache.pop(tenant_id, None)
        logger.info("Updated Layer 2 for tenant %s to version %s", tenant_id, next_version)
        return next_version

    def rollback_version(self, tenant_id: str, version: int) -> None:
        """Rollback to a specific version."""
        conn = self.db.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE prompts SET is_active = false WHERE tenant_id = %s",
                    (tenant_id,),
                )
                cur.execute(
                    """
                    UPDATE prompts
                    SET is_active = true
                    WHERE tenant_id = %s AND version = %s
                    """,
                    (tenant_id, version),
                )
                conn.commit()
        except Exception as exc:
            conn.rollback()
            logger.exception("Failed to rollback Layer 2 prompt: %s", exc)
            raise
        finally:
            self.db.put_connection(conn)

        self._cache.pop(tenant_id, None)
        logger.info("Rolled back tenant %s to prompt version %s", tenant_id, version)
