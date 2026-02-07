"""
Database service for saving captured data to PostgreSQL.

Handles connection pooling and saving objectives/completed data.
"""

import os
import asyncio
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger(__name__)


class DatabaseService:
    """
    Database service for PostgreSQL operations.
    
    Handles:
    - Connection pooling
    - Saving captured objectives
    - Saving events
    - Conversation tracking
    """
    
    def __init__(self):
        """Initialize database service from environment variables."""
        self.db_url = os.getenv(
            "DATABASE_URL",
            f"postgresql://{os.getenv('POSTGRES_USER', 'spotfunnel')}:"
            f"{os.getenv('POSTGRES_PASSWORD', 'dev')}@"
            f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
            f"{os.getenv('POSTGRES_PORT', '5432')}/"
            f"{os.getenv('POSTGRES_DB', 'spotfunnel')}"
        )
        
        self.pool: Optional[ThreadedConnectionPool] = None
        
    def connect(self):
        """Initialize connection pool."""
        try:
            self.pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=self.db_url
            )
            logger.info("Database connection pool initialized")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise
    
    def get_connection(self):
        """Get connection from pool."""
        if not self.pool:
            self.connect()
        return self.pool.getconn()
    
    def put_connection(self, conn):
        """Return connection to pool."""
        if self.pool:
            self.pool.putconn(conn)
    
    async def save_objective(
        self,
        conversation_id: str,
        objective_type: str,
        captured_data: Dict[str, Any],
        trace_id: str,
        tenant_id: str = "demo-tenant",
        state: str = "COMPLETED"
    ) -> Optional[str]:
        """
        Save completed objective to database.
        
        Args:
            conversation_id: Conversation UUID
            objective_type: Type of objective (e.g., "capture_email_au")
            captured_data: Captured data (e.g., {"email": "jane@gmail.com"})
            trace_id: Correlation ID
            tenant_id: Tenant ID
            state: Objective state (default: "COMPLETED")
            
        Returns:
            Objective ID if successful, None otherwise
        """
        conn = None
        try:
            conn = self.get_connection()
            cur = conn.cursor()
            
            # Insert objective
            query = """
                INSERT INTO objectives (
                    conversation_id, objective_type, state, captured_data,
                    started_at, completed_at, retry_count
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING objective_id
            """
            
            now = datetime.utcnow()
            cur.execute(
                query,
                (
                    conversation_id,
                    objective_type,
                    state,
                    psycopg2.extras.Json(captured_data),
                    now,  # started_at
                    now,  # completed_at
                    0  # retry_count
                )
            )
            
            objective_id = cur.fetchone()[0]
            conn.commit()
            
            logger.info(
                f"Saved objective {objective_id}: {objective_type} = {captured_data}"
            )
            
            return objective_id
            
        except Exception as e:
            logger.error(f"Failed to save objective: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if conn:
                cur.close()
                self.put_connection(conn)
    
    async def save_event(
        self,
        trace_id: str,
        tenant_id: str,
        event_type: str,
        payload: Dict[str, Any],
        conversation_id: Optional[str] = None,
        sequence_number: Optional[int] = None
    ) -> Optional[str]:
        """
        Save event to events table.
        
        Args:
            trace_id: Correlation ID
            tenant_id: Tenant ID
            event_type: Event type (e.g., "objective_completed")
            payload: Event payload
            conversation_id: Optional conversation ID
            sequence_number: Optional sequence number (auto-generated if None)
            
        Returns:
            Event ID if successful, None otherwise
        """
        conn = None
        try:
            conn = self.get_connection()
            cur = conn.cursor()
            
            # Get next sequence number if not provided
            if sequence_number is None:
                cur.execute(
                    "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM events WHERE trace_id = %s",
                    (trace_id,)
                )
                result = cur.fetchone()
                sequence_number = result[0] if result else 1
            
            # Insert event
            query = """
                INSERT INTO events (
                    trace_id, tenant_id, event_type, sequence_number,
                    payload, timestamp, conversation_id
                )
                VALUES (%s, %s, %s, %s, %s, NOW(), %s)
                RETURNING event_id
            """
            
            cur.execute(
                query,
                (
                    trace_id,
                    tenant_id,
                    event_type,
                    sequence_number,
                    psycopg2.extras.Json(payload),
                    conversation_id
                )
            )
            
            event_id = cur.fetchone()[0]
            conn.commit()
            
            logger.debug(f"Saved event {event_id}: {event_type}")
            
            return event_id
            
        except Exception as e:
            logger.error(f"Failed to save event: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if conn:
                cur.close()
                self.put_connection(conn)
    
    def upsert_call_log(
        self,
        *,
        call_id: str,
        tenant_id: str,
        caller_phone: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        duration_seconds: Optional[int] = None,
        outcome: Optional[str] = None,
        transcript: Optional[str] = None,
        summary: Optional[str] = None,
        reason_for_calling: Optional[str] = None,
        captured_data: Optional[Dict[str, Any]] = None,
        requires_action: Optional[bool] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        call_sid: Optional[str] = None,
        conversation_id: Optional[str] = None,
        stt_cost_usd: Optional[float] = None,
        llm_cost_usd: Optional[float] = None,
        tts_cost_usd: Optional[float] = None,
        total_cost_usd: Optional[float] = None,
    ) -> Optional[str]:
        """
        Insert or update a call_logs record for the dashboard.
        """
        conn = None
        try:
            conn = self.get_connection()
            cur = conn.cursor()
            if total_cost_usd is None:
                total_cost_usd = (stt_cost_usd or 0.0) + (llm_cost_usd or 0.0) + (tts_cost_usd or 0.0)
            query = """
                INSERT INTO call_logs (
                    call_id,
                    tenant_id,
                    caller_phone,
                    start_time,
                    end_time,
                    duration_seconds,
                    outcome,
                    transcript,
                    summary,
                    reason_for_calling,
                    captured_data,
                    requires_action,
                    priority,
                    status,
                    call_sid,
                    conversation_id,
                    stt_cost_usd,
                    llm_cost_usd,
                    tts_cost_usd,
                    total_cost_usd,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (call_id) DO UPDATE SET
                    caller_phone = COALESCE(EXCLUDED.caller_phone, call_logs.caller_phone),
                    start_time = COALESCE(call_logs.start_time, EXCLUDED.start_time),
                    end_time = COALESCE(EXCLUDED.end_time, call_logs.end_time),
                    duration_seconds = COALESCE(EXCLUDED.duration_seconds, call_logs.duration_seconds),
                    outcome = COALESCE(EXCLUDED.outcome, call_logs.outcome),
                    transcript = COALESCE(EXCLUDED.transcript, call_logs.transcript),
                    summary = COALESCE(EXCLUDED.summary, call_logs.summary),
                    reason_for_calling = COALESCE(EXCLUDED.reason_for_calling, call_logs.reason_for_calling),
                    captured_data = COALESCE(EXCLUDED.captured_data, call_logs.captured_data),
                    requires_action = COALESCE(EXCLUDED.requires_action, call_logs.requires_action),
                    priority = COALESCE(EXCLUDED.priority, call_logs.priority),
                    status = COALESCE(EXCLUDED.status, call_logs.status),
                    call_sid = COALESCE(EXCLUDED.call_sid, call_logs.call_sid),
                    conversation_id = COALESCE(EXCLUDED.conversation_id, call_logs.conversation_id),
                    stt_cost_usd = COALESCE(EXCLUDED.stt_cost_usd, call_logs.stt_cost_usd),
                    llm_cost_usd = COALESCE(EXCLUDED.llm_cost_usd, call_logs.llm_cost_usd),
                    tts_cost_usd = COALESCE(EXCLUDED.tts_cost_usd, call_logs.tts_cost_usd),
                    total_cost_usd = COALESCE(EXCLUDED.total_cost_usd, call_logs.total_cost_usd),
                    updated_at = NOW()
                RETURNING id
            """
            cur.execute(
                query,
                (
                    call_id,
                    tenant_id,
                    caller_phone,
                    start_time,
                    end_time,
                    duration_seconds,
                    outcome,
                    transcript,
                    summary,
                    reason_for_calling,
                    psycopg2.extras.Json(captured_data or {}),
                    requires_action,
                    priority,
                    status,
                    call_sid,
                    conversation_id,
                    stt_cost_usd,
                    llm_cost_usd,
                    tts_cost_usd,
                    total_cost_usd,
                ),
            )
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
        except Exception as e:
            logger.error(f"Failed to upsert call log: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if conn:
                cur.close()
                self.put_connection(conn)

    def close(self):
        """Close connection pool."""
        if self.pool:
            self.pool.closeall()
            logger.info("Database connection pool closed")


# Global database service instance
_db_service: Optional[DatabaseService] = None


def get_db_service() -> DatabaseService:
    """Get global database service instance."""
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
        _db_service.connect()
    return _db_service


def get_db_connection():
    """Get a database connection from the pool."""
    return get_db_service().get_connection()
