"""
Multi-knowledge base API for tenant-specific dynamic retrieval.

Allows tenants to configure multiple named knowledge bases that the AI
can query on-demand during conversations.
"""

import logging
import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import psycopg2.extras

from ..database.db_service import get_db_service
from ..middleware.auth import require_admin, check_tenant_access

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])


class KnowledgeBase(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    content: str
    filler_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    content: str = Field(..., min_length=1)
    filler_text: Optional[str] = None


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    content: Optional[str] = Field(None, min_length=1)
    filler_text: Optional[str] = None


class KnowledgeBaseQuery(BaseModel):
    query: str = Field(..., min_length=1)
    kb_names: Optional[List[str]] = None  # If None, search all KBs for tenant


class KnowledgeBaseQueryResult(BaseModel):
    kb_name: str
    kb_description: Optional[str]
    content: str
    relevance_score: float = 1.0  # For future semantic search


@router.get("/{tenant_id}", response_model=List[KnowledgeBase])
async def list_knowledge_bases(
    tenant_id: str,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    """Get all knowledge bases for a tenant."""
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute(
            """
            SELECT id, tenant_id, name, description, content, filler_text, created_at, updated_at
            FROM tenant_knowledge_bases
            WHERE tenant_id = %s::uuid
            ORDER BY name
            """,
            (tenant_id,)
        )
        
        rows = cur.fetchall()
        return [
            KnowledgeBase(
                id=str(row['id']),
                tenant_id=str(row['tenant_id']),
                name=row['name'],
                description=row['description'],
                content=row['content'],
                filler_text=row.get('filler_text'),
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )
            for row in rows
        ]
        
    except Exception as e:
        logger.error(f"Failed to list knowledge bases: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.post("/{tenant_id}", response_model=KnowledgeBase)
async def create_knowledge_base(
    tenant_id: str,
    kb: KnowledgeBaseCreate,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    """Create a new knowledge base for a tenant."""
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        kb_id = str(uuid.uuid4())
        
        cur.execute(
            """
            INSERT INTO tenant_knowledge_bases (id, tenant_id, name, description, content, filler_text)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
            RETURNING id, tenant_id, name, description, content, filler_text, created_at, updated_at
            """,
            (kb_id, tenant_id, kb.name, kb.description, kb.content, kb.filler_text)
        )
        
        row = cur.fetchone()
        conn.commit()
        
        return KnowledgeBase(
            id=str(row['id']),
            tenant_id=str(row['tenant_id']),
            name=row['name'],
            description=row['description'],
            content=row['content'],
            filler_text=row.get('filler_text'),
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
        
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        logger.warning(f"Duplicate KB name: {kb.name}")
        raise HTTPException(status_code=400, detail=f"Knowledge base '{kb.name}' already exists")
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Failed to create knowledge base: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.put("/{tenant_id}/{kb_id}", response_model=KnowledgeBase)
async def update_knowledge_base(
    tenant_id: str,
    kb_id: str,
    kb: KnowledgeBaseUpdate,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    """Update an existing knowledge base."""
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Build dynamic update query
        updates = []
        params = []
        
        if kb.name is not None:
            updates.append("name = %s")
            params.append(kb.name)
        if kb.description is not None:
            updates.append("description = %s")
            params.append(kb.description)
        if kb.content is not None:
            updates.append("content = %s")
            params.append(kb.content)
        if kb.filler_text is not None:
            updates.append("filler_text = %s")
            params.append(kb.filler_text)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.extend([kb_id, tenant_id])
        
        cur.execute(
            f"""
            UPDATE tenant_knowledge_bases
            SET {', '.join(updates)}
            WHERE id = %s::uuid AND tenant_id = %s::uuid
            RETURNING id, tenant_id, name, description, content, filler_text, created_at, updated_at
            """,
            params
        )
        
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        conn.commit()
        
        return KnowledgeBase(
            id=str(row['id']),
            tenant_id=str(row['tenant_id']),
            name=row['name'],
            description=row['description'],
            content=row['content'],
            filler_text=row.get('filler_text'),
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Failed to update knowledge base: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.delete("/{tenant_id}/{kb_id}")
async def delete_knowledge_base(
    tenant_id: str,
    kb_id: str,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    """Delete a knowledge base."""
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor()
        
        cur.execute(
            """
            DELETE FROM tenant_knowledge_bases
            WHERE id = %s::uuid AND tenant_id = %s::uuid
            """,
            (kb_id, tenant_id)
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        conn.commit()
        return {"success": True}
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Failed to delete knowledge base: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.post("/{tenant_id}/query", response_model=List[KnowledgeBaseQueryResult])
async def query_knowledge_bases(
    tenant_id: str,
    query: KnowledgeBaseQuery,
    session: dict = Depends(require_admin),
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    """
    Query knowledge bases for a tenant.
    
    For MVP: Simple full-text search across specified KBs.
    Future: Vector embeddings + semantic similarity.
    """
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if query.kb_names:
            # Query specific knowledge bases
            cur.execute(
                """
            SELECT name, description, content
                FROM tenant_knowledge_bases
                WHERE tenant_id = %s::uuid AND name = ANY(%s)
                ORDER BY name
                """,
                (tenant_id, query.kb_names)
            )
        else:
            # Query all knowledge bases for tenant
            cur.execute(
                """
                SELECT name, description, content
                FROM tenant_knowledge_bases
                WHERE tenant_id = %s::uuid
                ORDER BY name
                """,
                (tenant_id,)
            )
        
        rows = cur.fetchall()
        
        # For MVP: Return full content of matched KBs
        # Future: Filter by relevance, return only matching chunks
        results = [
            KnowledgeBaseQueryResult(
                kb_name=row['name'],
                kb_description=row['description'],
                content=row['content'],
                relevance_score=1.0
            )
            for row in rows
        ]
        
        return results
        
    except Exception as e:
        logger.error(f"Failed to query knowledge bases: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)
