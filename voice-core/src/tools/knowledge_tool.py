"""
Knowledge base query tool for LLM function calling.

Allows the AI to dynamically retrieve information from specific
named knowledge bases during a conversation.
"""

import logging
import re
import time
from typing import List, Optional, Dict, Tuple

from ..database.db_service import get_db_service
import psycopg2.extras
from pipecat.services.llm_service import FunctionCallParams

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 900
_KB_QUERY_CACHE: Dict[Tuple[str, str, str], Tuple[float, str]] = {}
_KB_FILLER_CACHE: Dict[str, Tuple[float, Dict[str, str]]] = {}


def _normalize_topic(query: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", query.lower())
    words = [w for w in cleaned.split() if len(w) > 2]
    return " ".join(words[:12]).strip()


def _extract_relevant_chunks(content: str, query: str) -> str:
    if not content:
        return content
    topic_words = set(_normalize_topic(query).split())
    if not topic_words:
        return content

    chunks = re.split(r"\n{2,}", content)
    scored = []
    for chunk in chunks:
        lower = chunk.lower()
        score = sum(1 for w in topic_words if w in lower)
        if score > 0:
            scored.append((score, chunk))

    if not scored:
        return content

    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = [c for _, c in scored[:3]]
    return "\n\n".join(top_chunks)


# OpenAI/Anthropic function definition
KNOWLEDGE_QUERY_TOOL = {
    "type": "function",
    "function": {
        "name": "query_knowledge",
        "description": "Search one or more knowledge bases for information to answer the caller's question. Only call this when you need specific information that would be in a knowledge base (hours, services, pricing, policies, troubleshooting, etc.). Don't call for general conversation.",
        "parameters": {
            "type": "object",
            "properties": {
                "kb_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Names of knowledge bases to search (e.g., ['FAQs', 'Pricing']). If you're not sure which KB has the info, you can specify multiple or leave empty to search all."
                },
                "query": {
                    "type": "string",
                    "description": "What you're looking for (e.g., 'business hours', 'pricing for HVAC installation', 'how to reset device')"
                }
            },
            "required": ["query"]
        }
    }
}


async def execute_knowledge_query(
    tenant_id: str,
    kb_names: Optional[List[str]],
    query: str
) -> str:
    """
    Execute a knowledge base query and return formatted results.
    
    Args:
        tenant_id: Tenant ID to query KBs for
        kb_names: Specific KB names to search, or None for all
        query: Search query (currently unused, but for future semantic search)
    
    Returns:
        Formatted string with KB results for LLM context
    """
    topic = _normalize_topic(query)
    kb_key = ",".join(sorted(kb_names)) if kb_names else "ALL"
    cache_key = (tenant_id, kb_key, topic)
    now = time.time()
    cached = _KB_QUERY_CACHE.get(cache_key)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if kb_names:
            cur.execute(
                """
                SELECT name, description, content
                FROM tenant_knowledge_bases
                WHERE tenant_id = %s::uuid AND name = ANY(%s)
                ORDER BY name
                """,
                (tenant_id, kb_names)
            )
        else:
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
        
        if not rows:
            return "No knowledge bases found. You may not have information to answer this question - consider offering to connect the caller with someone who can help."
        
        # Format results for LLM (only relevant chunks for this topic)
        results = []
        for row in rows:
            kb_section = f"=== {row['name']} ==="
            if row['description']:
                kb_section += f"\n({row['description']})"
            relevant = _extract_relevant_chunks(row['content'], query)
            kb_section += f"\n\n{relevant}"
            results.append(kb_section)
        
        formatted = "\n\n".join(results)
        
        logger.info(f"Knowledge query for tenant {tenant_id}: {query} → {len(rows)} KB(s) found")
        
        _KB_QUERY_CACHE[cache_key] = (now, formatted)
        return formatted
        
    except Exception as e:
        logger.error(f"Knowledge query failed: {e}", exc_info=True)
        return f"Error retrieving knowledge: {str(e)}"
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


def format_knowledge_bases_for_system_prompt(tenant_id: str) -> str:
    """
    Get list of available knowledge bases to include in system prompt.
    This tells the AI what KBs are available without loading all content.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        Formatted string listing available KBs with descriptions
    """
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute(
            """
            SELECT name, description
            FROM tenant_knowledge_bases
            WHERE tenant_id = %s::uuid
            ORDER BY name
            """,
            (tenant_id,)
        )
        
        rows = cur.fetchall()
        
        if not rows:
            return "\nNo knowledge bases configured for this agent."
        
        kb_list = ["Available Knowledge Bases:"]
        for row in rows:
            desc = f" - {row['description']}" if row['description'] else ""
            kb_list.append(f"  • \"{row['name']}\"{desc}")
        
        return "\n".join(kb_list)
        
    except Exception as e:
        logger.error(f"Failed to list KBs: {e}", exc_info=True)
        return "\nError loading knowledge base list."
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


def register_knowledge_tool(llm, tenant_id: str):
    """
    Register the query_knowledge tool with the LLM service.
    """

    async def _handle_query_knowledge(params: FunctionCallParams):
        kb_names = params.arguments.get("kb_names")
        query = params.arguments.get("query", "")
        result = await execute_knowledge_query(
            tenant_id=tenant_id,
            kb_names=kb_names,
            query=query,
        )
        await params.result_callback(result)

    llm.register_function("query_knowledge", _handle_query_knowledge)


def get_kb_filler_text(tenant_id: str, kb_names: Optional[List[str]]) -> Optional[str]:
    """
    Get filler text for the first matching KB name.
    """
    now = time.time()
    cached = _KB_FILLER_CACHE.get(tenant_id)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        filler_map = cached[1]
    else:
        filler_map = {}
        db_service = get_db_service()
        conn = None
        try:
            conn = db_service.get_connection()
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT name, filler_text
                FROM tenant_knowledge_bases
                WHERE tenant_id = %s::uuid
                """,
                (tenant_id,)
            )
            rows = cur.fetchall()
            filler_map = {row['name']: row.get('filler_text') for row in rows}
            _KB_FILLER_CACHE[tenant_id] = (now, filler_map)
        except Exception as e:
            logger.error("Failed to load KB filler text: %s", e, exc_info=True)
        finally:
            if conn:
                cur.close()
                db_service.put_connection(conn)

    if not kb_names:
        return None
    for name in kb_names:
        if name in filler_map and filler_map[name]:
            return filler_map[name]
    return None
