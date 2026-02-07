"""
Admin Agents API

Provides endpoints for managing agents (tenants) and their associated users.
"""

import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import psycopg2.extras

from ..database.db_service import get_db_service
from ..middleware.auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-agents"])

# Debug: Verify this file is being loaded
print("[DEBUG] admin_agents.py loaded - using psycopg2 connection pool")


class AgentResponse(BaseModel):
    """Agent with user status information"""
    id: str
    name: str
    company: str
    industry: str
    phone_number: str = Field(..., alias="phoneNumber")
    status: str
    user_status: str = Field(..., alias="userStatus")
    user_email: Optional[str] = Field(None, alias="userEmail")
    user_id: Optional[str] = Field(None, alias="userId")
    last_login: Optional[datetime] = Field(None, alias="lastLogin")
    invitation_sent_at: Optional[datetime] = Field(None, alias="invitationSentAt")
    invitation_expires_at: Optional[datetime] = Field(None, alias="invitationExpiresAt")
    # Call statistics (can be populated from conversations table)
    calls_handled: int = Field(0, alias="callsHandled")
    success_rate: str = Field("0%", alias="successRate")
    total_minutes: int = Field(0, alias="totalMinutes")
    
    class Config:
        populate_by_name = True
        by_alias = True


@router.get("/agents", response_model=List[AgentResponse])
async def get_all_agents(session: dict = Depends(require_admin)):
    """
    Get all agents (tenants) with their user status.
    Uses the agent_user_status view for efficient querying.
    """
    db_service = get_db_service()
    conn = None
    
    try:
        # Get connection from pool
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Query directly from agent_user_status view with call stats
        query = """
            SELECT 
                aus.tenant_id,
                aus.business_name,
                aus.phone_number,
                t.state as industry,
                aus.agent_status,
                aus.user_status,
                aus.user_email,
                aus.user_id,
                aus.last_login,
                aus.invitation_created_at,
                aus.invitation_expires_at,
                -- Get call statistics from conversations
                COALESCE(call_stats.total_calls, 0) as calls_handled,
                COALESCE(call_stats.total_minutes, 0) as total_minutes,
                COALESCE(call_stats.success_rate, 0) as success_rate_value
            FROM agent_user_status aus
            JOIN tenants t ON aus.tenant_id = t.tenant_id
            LEFT JOIN LATERAL (
                SELECT 
                    COUNT(*) as total_calls,
                    SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::int as total_minutes,
                    (COUNT(*) FILTER (WHERE status = 'completed')::float / NULLIF(COUNT(*), 0) * 100)::int as success_rate
                FROM conversations
                WHERE tenant_id = aus.tenant_id
                  AND started_at >= NOW() - INTERVAL '24 hours'
            ) call_stats ON true
            WHERE aus.agent_status = 'active'
            ORDER BY aus.tenant_id
        """
        
        cur.execute(query)
        agents = cur.fetchall()
        
        # Debug logging
        logger.info(f"Fetched {len(agents)} agents from database")
        for agent in agents:
            logger.info(f"Agent {agent['tenant_id']}: user_status={agent['user_status']}, user_id={agent['user_id']}, user_email={agent['user_email']}")
        
        result = []
        for agent in agents:
            result.append(AgentResponse(
                id=str(agent['tenant_id']),
                name=f"{agent['business_name']} AI",
                company=agent['business_name'],
                industry=agent['industry'] or 'General',
                phone_number=agent['phone_number'],
                status=agent['agent_status'],
                user_status=agent['user_status'],
                user_email=agent['user_email'],
                user_id=str(agent['user_id']) if agent['user_id'] else None,
                last_login=agent['last_login'],
                invitation_sent_at=agent['invitation_created_at'],
                invitation_expires_at=agent['invitation_expires_at'],
                calls_handled=agent['calls_handled'],
                total_minutes=agent['total_minutes'],
                success_rate=f"{agent['success_rate_value']}%" if agent['success_rate_value'] else "0%",
            ))
        
        logger.info(f"Successfully fetched {len(result)} agents")
        return result
        
    except Exception as e:
        logger.error(f"Error fetching agents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch agents: {str(e)}")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)
