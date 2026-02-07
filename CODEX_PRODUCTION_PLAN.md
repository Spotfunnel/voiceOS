# Codex Production Launch Plan
*Full Production Launch - 3 Week Timeline*

## Mission
Prepare SpotFunnel voice AI system for production launch by implementing authentication, completing analytics infrastructure, adding robust error handling, and stress testing the entire system.

---

## 🎯 PHASE 1: CRITICAL BLOCKERS (Week 1)

### Task 1.1: Implement Authentication Middleware
**Priority**: CRITICAL - Security vulnerability
**Estimated time**: 6 hours

#### Overview
All API endpoints are currently publicly accessible. Need to implement session-based authentication middleware to protect admin and customer endpoints.

#### Implementation Steps

**Step 1: Create authentication utilities**

Create `voice-core/src/middleware/auth.py`:

```python
"""
Authentication middleware for FastAPI endpoints.
Validates session tokens and provides user context.
"""
from fastapi import HTTPException, Cookie, Depends
from typing import Optional
import hashlib
import logging

logger = logging.getLogger(__name__)

# Import your db connection
from ..services.db_service import get_db_connection

def get_session_from_cookie(sf_session: Optional[str] = Cookie(None)) -> Optional[dict]:
    """
    Validate session cookie and return session data.
    
    Returns:
        dict with 'user_id', 'tenant_id', 'role', 'email'
        None if invalid/expired
    """
    if not sf_session:
        return None
    
    # Hash the session token
    session_hash = hashlib.sha256(sf_session.encode()).hexdigest()
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Query users table for session
        # Note: You may need to add a 'session_hash' column to users table
        # For now, reconstruct from email (temp solution)
        cur.execute("""
            SELECT user_id, tenant_id, email, role, is_active
            FROM users
            WHERE is_active = TRUE
        """)
        users = cur.fetchall()
        
        # Find matching session
        # TODO: Proper session table with expiration
        for user in users:
            user_id, tenant_id, email, role, is_active = user
            # Reconstruct expected token
            expected_token = hashlib.sha256(f"{email}:{user_id}".encode()).hexdigest()
            if expected_token == session_hash:
                return {
                    'user_id': str(user_id),
                    'tenant_id': str(tenant_id),
                    'email': email,
                    'role': role
                }
        
        return None
    finally:
        conn.close()


async def require_auth(sf_session: Optional[str] = Cookie(None)) -> dict:
    """
    Dependency: Require valid authentication.
    Raises 401 if not authenticated.
    """
    session = get_session_from_cookie(sf_session)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    return session


async def require_admin(sf_session: Optional[str] = Cookie(None)) -> dict:
    """
    Dependency: Require admin authentication.
    Raises 401 if not authenticated, 403 if not admin.
    """
    session = get_session_from_cookie(sf_session)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    # For now, all authenticated users are admins
    # TODO: Check session['role'] == 'admin' when roles implemented
    
    return session


def check_tenant_access(session: dict, tenant_id: str) -> bool:
    """
    Check if user has access to specific tenant.
    Admins can access all tenants.
    Customers can only access their own tenant.
    """
    # For now, all users are admins during onboarding
    # Later: if session['role'] == 'customer' and session['tenant_id'] != tenant_id:
    #     return False
    return True
```

**Step 2: Add session table (proper solution)**

Create migration `voice-ai-os/infrastructure/database/migrations/009_add_sessions_table.sql`:

```sql
-- Add sessions table for proper session management
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_session_hash ON sessions(session_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Update users table to track last login
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
```

**Step 3: Update login endpoint to create sessions**

Update `voice-core/src/api/auth.py` `/login` endpoint:

```python
# After password verification succeeds:

# Create session in database
session_token = secrets.token_urlsafe(32)
session_hash = hashlib.sha256(session_token.encode()).hexdigest()
expires_at = datetime.now(timezone.utc) + timedelta(days=30)

cur.execute("""
    INSERT INTO sessions (user_id, session_hash, expires_at)
    VALUES (%s, %s, %s)
    RETURNING session_id
""", (user_id, session_hash, expires_at))

session_id = cur.fetchone()[0]
conn.commit()

# Update last login
cur.execute("""
    UPDATE users 
    SET last_login_at = NOW()
    WHERE user_id = %s
""", (user_id,))
conn.commit()

# Set cookie
response.set_cookie(
    key="sf_session",
    value=session_token,
    max_age=30 * 24 * 60 * 60,  # 30 days
    httponly=True,
    secure=False,  # Set to True in production with HTTPS
    samesite="lax"
)
```

**Step 4: Protect all endpoints**

Update these files to add authentication:

**`voice-core/src/api/admin_agents.py`**:
```python
from ..middleware.auth import require_admin, check_tenant_access

@router.get("/agents")
async def get_all_agents(session: dict = Depends(require_admin)):
    # Already returns all agents, good for admins
    ...

@router.get("/user-status/{tenant_id}")
async def get_user_status(
    tenant_id: str,
    session: dict = Depends(require_admin)
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(403, "Access denied")
    ...
```

**`voice-core/src/api/dashboard.py`**:
```python
from ..middleware.auth import require_auth, check_tenant_access

@router.get("/calls")
async def get_dashboard_calls(
    tenant_id: str,
    session: dict = Depends(require_auth)
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(403, "Access denied")
    ...
```

**`voice-core/src/api/tenant_config.py`**:
```python
from ..middleware.auth import require_admin, check_tenant_access

@router.get("/{tenant_id}/config")
async def get_tenant_config(
    tenant_id: str,
    session: dict = Depends(require_admin)
):
    if not check_tenant_access(session, tenant_id):
        raise HTTPException(403, "Access denied")
    ...
```

**Files to update** (add `session: dict = Depends(require_admin)` or `require_auth`):
- `voice-core/src/api/admin_agents.py` (all endpoints)
- `voice-core/src/api/admin/operations.py` (all endpoints)
- `voice-core/src/api/admin/configure.py` (all endpoints)
- `voice-core/src/api/admin/intelligence.py` (all endpoints)
- `voice-core/src/api/admin/quality.py` (all endpoints)
- `voice-core/src/api/dashboard.py` (all endpoints)
- `voice-core/src/api/tenant_config.py` (all endpoints)
- `voice-core/src/api/knowledge_bases.py` (all endpoints)
- `voice-core/src/api/call_history.py` (all endpoints)
- `voice-core/src/api/onboarding.py` (all endpoints)
- `voice-core/src/api/stress_test.py` (all endpoints)

**Step 5: Add logout endpoint**

Add to `voice-core/src/api/auth.py`:

```python
@router.post("/logout")
async def logout(
    response: Response,
    sf_session: Optional[str] = Cookie(None)
):
    """Logout user and invalidate session."""
    if sf_session:
        session_hash = hashlib.sha256(sf_session.encode()).hexdigest()
        
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                DELETE FROM sessions
                WHERE session_hash = %s
            """, (session_hash,))
            conn.commit()
        finally:
            conn.close()
    
    # Clear cookie
    response.delete_cookie(key="sf_session")
    
    return {"status": "logged_out"}


@router.get("/me")
async def get_current_user(session: dict = Depends(require_auth)):
    """Get current authenticated user info."""
    return {
        "user_id": session['user_id'],
        "tenant_id": session['tenant_id'],
        "email": session['email'],
        "role": session['role']
    }
```

#### Testing Steps
1. Run migration 009
2. Test login → verify session created in database
3. Test protected endpoint without cookie → expect 401
4. Test protected endpoint with valid cookie → expect 200
5. Test logout → verify session deleted
6. Test accessing another tenant's data → expect 403

---

### Task 1.2: Create Call Logs Table
**Priority**: CRITICAL - Analytics won't work
**Estimated time**: 2 hours

#### Overview
`call_logs` table is referenced throughout the codebase but doesn't exist. Create comprehensive call logs table for analytics and reporting.

#### Implementation

**Step 1: Create migration**

Create `voice-ai-os/infrastructure/database/migrations/010_add_call_logs.sql`:

```sql
-- Create comprehensive call logs table
CREATE TABLE call_logs (
    call_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id VARCHAR(255) UNIQUE NOT NULL,
    call_sid VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(conversation_id),
    
    -- Call metadata
    caller_phone VARCHAR(30),
    direction VARCHAR(20) DEFAULT 'inbound',
    status VARCHAR(50),
    
    -- Timing
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Content
    transcript TEXT,
    summary TEXT,
    
    -- Captured data
    reason_for_calling VARCHAR(255),
    outcome VARCHAR(255),
    captured_data JSONB DEFAULT '{}',
    
    -- Action tracking
    requires_action BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20),
    resolved_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    
    -- Costs (internal tracking)
    stt_cost_usd NUMERIC(10, 6),
    llm_cost_usd NUMERIC(10, 6),
    tts_cost_usd NUMERIC(10, 6),
    total_cost_usd NUMERIC(10, 6),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX idx_call_logs_tenant_started ON call_logs(tenant_id, started_at DESC);
CREATE INDEX idx_call_logs_call_sid ON call_logs(call_sid);
CREATE INDEX idx_call_logs_status ON call_logs(status);
CREATE INDEX idx_call_logs_requires_action ON call_logs(tenant_id, requires_action) WHERE requires_action = TRUE;
CREATE INDEX idx_call_logs_caller_phone ON call_logs(caller_phone);

-- Trigger for updated_at
CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON call_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Unique constraint
ALTER TABLE call_logs ADD CONSTRAINT unique_tenant_call 
    UNIQUE(tenant_id, call_id);
```

**Step 2: Update DB service**

Verify `voice-core/src/services/db_service.py` has `upsert_call_log()` that matches new schema:

```python
def upsert_call_log(
    call_id: str,
    tenant_id: str,
    caller_phone: Optional[str] = None,
    started_at: Optional[datetime] = None,
    ended_at: Optional[datetime] = None,
    duration_seconds: Optional[int] = None,
    transcript: Optional[str] = None,
    summary: Optional[str] = None,
    reason_for_calling: Optional[str] = None,
    outcome: Optional[str] = None,
    captured_data: Optional[dict] = None,
    requires_action: bool = False,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    call_sid: Optional[str] = None,
    conversation_id: Optional[str] = None,
    stt_cost: Optional[float] = None,
    llm_cost: Optional[float] = None,
    tts_cost: Optional[float] = None,
) -> str:
    """Insert or update call log."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        total_cost = None
        if stt_cost or llm_cost or tts_cost:
            total_cost = (stt_cost or 0) + (llm_cost or 0) + (tts_cost or 0)
        
        cur.execute("""
            INSERT INTO call_logs (
                call_id, tenant_id, caller_phone, started_at, ended_at,
                duration_seconds, transcript, summary, reason_for_calling,
                outcome, captured_data, requires_action, priority, status,
                call_sid, conversation_id,
                stt_cost_usd, llm_cost_usd, tts_cost_usd, total_cost_usd
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            ON CONFLICT (call_id) DO UPDATE SET
                ended_at = EXCLUDED.ended_at,
                duration_seconds = EXCLUDED.duration_seconds,
                transcript = COALESCE(EXCLUDED.transcript, call_logs.transcript),
                summary = COALESCE(EXCLUDED.summary, call_logs.summary),
                reason_for_calling = COALESCE(EXCLUDED.reason_for_calling, call_logs.reason_for_calling),
                outcome = COALESCE(EXCLUDED.outcome, call_logs.outcome),
                captured_data = COALESCE(EXCLUDED.captured_data, call_logs.captured_data),
                requires_action = COALESCE(EXCLUDED.requires_action, call_logs.requires_action),
                priority = COALESCE(EXCLUDED.priority, call_logs.priority),
                status = COALESCE(EXCLUDED.status, call_logs.status),
                stt_cost_usd = COALESCE(EXCLUDED.stt_cost_usd, call_logs.stt_cost_usd),
                llm_cost_usd = COALESCE(EXCLUDED.llm_cost_usd, call_logs.llm_cost_usd),
                tts_cost_usd = COALESCE(EXCLUDED.tts_cost_usd, call_logs.tts_cost_usd),
                total_cost_usd = COALESCE(EXCLUDED.total_cost_usd, call_logs.total_cost_usd),
                updated_at = NOW()
            RETURNING call_log_id
        """, (
            call_id, tenant_id, caller_phone, started_at, ended_at,
            duration_seconds, transcript, summary, reason_for_calling,
            outcome, json.dumps(captured_data) if captured_data else None,
            requires_action, priority, status, call_sid, conversation_id,
            stt_cost, llm_cost, tts_cost, total_cost
        ))
        
        call_log_id = cur.fetchone()[0]
        conn.commit()
        return str(call_log_id)
    finally:
        conn.close()
```

**Step 3: Wire call log creation into bot_runner**

Update `voice-core/src/bot_runner.py` to persist costs:

```python
# In _call_log_observer, when call_ended event received:

async def _call_log_observer(call_id: str, tenant_id: str, metadata: dict, event: dict):
    ...
    if event_type == "call_ended":
        # Extract costs from context if available
        stt_cost = ctx.get('stt_cost', 0.0)
        llm_cost = ctx.get('llm_cost', 0.0)
        tts_cost = ctx.get('tts_cost', 0.0)
        
        # Persist to call_logs
        upsert_call_log(
            call_id=call_id,
            tenant_id=tenant_id,
            caller_phone=metadata.get('caller_phone'),
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=duration,
            summary=summary,
            outcome=outcome,
            captured_data=captured_data,
            requires_action=requires_action,
            status='completed',
            call_sid=metadata.get('call_sid'),
            stt_cost=stt_cost,
            llm_cost=llm_cost,
            tts_cost=tts_cost
        )
```

**Step 4: Track costs during call**

Update `voice-core/src/llm/multi_provider_llm.py` and `voice-core/src/tts/multi_provider_tts.py`:

```python
# In process_frame methods, accumulate costs
async def process_frame(self, frame):
    ...
    # After successful LLM call
    cost = self._estimate_cost(input_tokens, output_tokens)
    
    # Store in call context (need to pass context through)
    if hasattr(self, '_call_context'):
        self._call_context['llm_cost'] = self._call_context.get('llm_cost', 0.0) + cost
```

Note: May need to refactor to pass call context through pipeline.

#### Testing Steps
1. Run migration 010
2. Make a test call
3. Verify call_log created with correct data
4. Check dashboard queries work
5. Verify costs are tracked (can be 0.0 initially)

---

### Task 1.3: Add Pipeline Error Handling
**Priority**: CRITICAL - Calls crash on provider failure
**Estimated time**: 3 hours

#### Overview
If all LLM or TTS providers fail, the call crashes. Need graceful degradation.

#### Implementation

**Step 1: Add fallback message handler**

Create `voice-core/src/pipeline/error_handlers.py`:

```python
"""
Pipeline error handlers for graceful degradation.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class PipelineErrorHandler:
    """Handle pipeline errors gracefully."""
    
    def __init__(self, tenant_id: str, call_sid: str):
        self.tenant_id = tenant_id
        self.call_sid = call_sid
    
    async def handle_llm_failure(self) -> str:
        """
        Handle complete LLM provider failure.
        Returns fallback message.
        """
        logger.critical(
            "All LLM providers failed for call %s (tenant %s)",
            self.call_sid, self.tenant_id
        )
        
        return (
            "I apologize, but I'm experiencing technical difficulties. "
            "Let me transfer you to someone who can help you right away."
        )
    
    async def handle_tts_failure(self) -> str:
        """
        Handle complete TTS provider failure.
        Returns fallback message (will use Twilio's built-in TTS).
        """
        logger.critical(
            "All TTS providers failed for call %s (tenant %s)",
            self.call_sid, self.tenant_id
        )
        
        return (
            "I'm sorry, I'm having trouble with my voice system. "
            "Please hold while I transfer you."
        )
    
    async def handle_stt_failure(self):
        """
        Handle STT provider failure.
        Returns fallback action.
        """
        logger.critical(
            "STT failed for call %s (tenant %s)",
            self.call_sid, self.tenant_id
        )
        
        return (
            "I'm having trouble hearing you clearly. "
            "Let me connect you with someone who can help."
        )
```

**Step 2: Update bot_runner to catch exceptions**

Update `voice-core/src/bot_runner.py`:

```python
from .pipeline.error_handlers import PipelineErrorHandler
from .llm.exceptions import AllLLMProvidersFailed
from .tts.exceptions import AllTTSProvidersFailed
from .api.call_transfer import initiate_transfer

async def start_bot_call(
    call_sid: str,
    tenant_id: str,
    caller_phone: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    system_prompt: Optional[str] = None
):
    """Start bot call with error handling."""
    
    error_handler = PipelineErrorHandler(tenant_id, call_sid)
    
    try:
        # Existing call setup code...
        runner = VoicePipeline(...)
        task = PipelineTask(...)
        
        # Run pipeline with error handling
        await runner.run(task)
        
    except AllLLMProvidersFailed as e:
        logger.error("All LLM providers failed: %s", e)
        
        # Play fallback message
        fallback_msg = await error_handler.handle_llm_failure()
        
        # Attempt to transfer to human
        transfer_config = config.get('telephony', {}) if config else {}
        transfer_phone = transfer_config.get('transfer_contact_phone')
        transfer_name = transfer_config.get('transfer_contact_name', 'support')
        
        if transfer_phone:
            await initiate_transfer(
                call_sid=call_sid,
                transfer_phone=transfer_phone,
                transfer_name=transfer_name,
                reason=fallback_msg
            )
        else:
            # No transfer number configured, play message and hang up
            logger.error("No transfer number configured for tenant %s", tenant_id)
            # TODO: Play message via Twilio API before hanging up
        
        # Mark call as failed
        upsert_call_log(
            call_id=call_sid,
            tenant_id=tenant_id,
            status='failed',
            outcome='technical_failure',
            summary='Call failed due to LLM provider outage'
        )
        
    except AllTTSProvidersFailed as e:
        logger.error("All TTS providers failed: %s", e)
        
        fallback_msg = await error_handler.handle_tts_failure()
        
        # Similar transfer logic
        # ...
        
    except Exception as e:
        logger.exception("Unexpected error in call %s: %s", call_sid, e)
        
        # Generic error handling
        upsert_call_log(
            call_id=call_sid,
            tenant_id=tenant_id,
            status='failed',
            outcome='system_error',
            summary=f'Call failed: {str(e)[:200]}'
        )
        
        # Try to transfer if possible
        # ...
```

**Step 3: Create exception classes if missing**

Create `voice-core/src/llm/exceptions.py`:

```python
class AllLLMProvidersFailed(Exception):
    """Raised when all LLM providers fail."""
    pass
```

Create `voice-core/src/tts/exceptions.py`:

```python
class AllTTSProvidersFailed(Exception):
    """Raised when all TTS providers fail."""
    pass
```

Update `multi_provider_llm.py` and `multi_provider_tts.py` to raise these exceptions when all providers fail.

**Step 4: Add STT fallback**

Update `voice-core/src/pipeline/voice_pipeline.py`:

```python
# Add fallback STT provider
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAISTTService

def __init__(self, ...):
    # Primary STT
    self.stt = DeepgramSTTService(...)
    
    # Fallback STT
    self.stt_fallback = OpenAISTTService(
        api_key=os.getenv("OPENAI_API_KEY"),
        model="whisper-1"
    )
```

Add try-catch around STT in pipeline to use fallback.

#### Testing Steps
1. Simulate LLM failure (invalid API keys)
2. Verify call doesn't crash
3. Verify fallback message plays
4. Verify call transfers or hangs up gracefully
5. Verify call_log marked as 'failed'

---

### Task 1.4: Run Stress Tests
**Priority**: CRITICAL - Unknown performance characteristics
**Estimated time**: 8 hours (testing + fixes)

#### Overview
System has never been load tested. Need to identify bottlenecks before production.

#### Test Plan

**Test 1: Stress Test API (existing feature)**

```python
# Use existing /api/stress-test/run endpoint

import httpx
import asyncio

async def run_stress_test():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/stress-test/run",
            json={
                "tenant_id": "<test-tenant-id>",
                "num_conversations": 20,
                "industry": "HVAC",
                "system_prompt": "You are a helpful HVAC assistant...",
                "knowledge_base": "HVAC troubleshooting guide...",
            },
            timeout=300.0  # 5 minutes
        )
        
        result = response.json()
        print(f"Pass rate: {result['summary']['pass_rate']}")
        print(f"Failed: {result['summary']['failed_count']}")
        
        for convo in result['conversations']:
            if convo['result']['overallResult'] == 'FAIL':
                print(f"\nFailed conversation:")
                print(convo['transcript'])

asyncio.run(run_stress_test())
```

**Test 2: Concurrent calls simulation**

Create `voice-core/tests/load_test_calls.py`:

```python
"""
Load test for concurrent voice calls.
Simulates multiple callers hitting the system simultaneously.
"""
import asyncio
import httpx
import time
from datetime import datetime

async def simulate_call(call_num: int, tenant_id: str):
    """Simulate a single call."""
    start = time.time()
    
    async with httpx.AsyncClient() as client:
        try:
            # Start call
            response = await client.post(
                "http://localhost:8000/start_call",
                json={
                    "tenant_id": tenant_id,
                    "caller_phone": f"+155501{call_num:05d}",
                    "call_sid": f"test-call-{call_num}",
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                print(f"Call {call_num} failed to start: {response.status_code}")
                return False
            
            # Simulate call duration
            await asyncio.sleep(30)
            
            # Stop call
            await client.post(
                "http://localhost:8000/stop_call",
                json={"call_id": f"test-call-{call_num}"}
            )
            
            elapsed = time.time() - start
            print(f"Call {call_num} completed in {elapsed:.2f}s")
            return True
            
        except Exception as e:
            print(f"Call {call_num} error: {e}")
            return False

async def load_test(num_calls: int, tenant_id: str):
    """Run load test with N concurrent calls."""
    print(f"Starting load test: {num_calls} concurrent calls")
    print(f"Time: {datetime.now()}")
    
    start = time.time()
    
    # Launch all calls concurrently
    tasks = [simulate_call(i, tenant_id) for i in range(num_calls)]
    results = await asyncio.gather(*tasks)
    
    elapsed = time.time() - start
    success_count = sum(results)
    
    print(f"\n=== Results ===")
    print(f"Total calls: {num_calls}")
    print(f"Successful: {success_count}")
    print(f"Failed: {num_calls - success_count}")
    print(f"Duration: {elapsed:.2f}s")
    print(f"Calls/sec: {num_calls / elapsed:.2f}")

if __name__ == "__main__":
    tenant_id = "<your-test-tenant-id>"
    asyncio.run(load_test(10, tenant_id))
```

**Test 3: Knowledge base query performance**

Create `voice-core/tests/test_kb_performance.py`:

```python
"""
Test knowledge base query performance with large KBs.
"""
import asyncio
import httpx
import time

async def test_kb_query(kb_size: str):
    """Test KB query with different sizes."""
    
    # Create large KB
    large_content = "HVAC Manual\n" + ("Details about troubleshooting...\n" * 1000)
    
    async with httpx.AsyncClient() as client:
        # Create KB
        response = await client.post(
            f"http://localhost:8000/api/knowledge-bases/{tenant_id}",
            json={
                "name": f"Test KB {kb_size}",
                "description": "Test",
                "content": large_content,
                "filler_text": "Looking that up..."
            }
        )
        
        kb_id = response.json()['id']
        
        # Query it 10 times
        times = []
        for i in range(10):
            start = time.time()
            
            response = await client.post(
                f"http://localhost:8000/api/knowledge-bases/{tenant_id}/query",
                json={
                    "kb_names": [f"Test KB {kb_size}"],
                    "query": "How do I fix a furnace that won't turn on?"
                }
            )
            
            elapsed = time.time() - start
            times.append(elapsed)
            print(f"Query {i+1}: {elapsed:.3f}s")
        
        avg_time = sum(times) / len(times)
        print(f"\nAverage query time ({kb_size}): {avg_time:.3f}s")
        
        # Cleanup
        await client.delete(f"http://localhost:8000/api/knowledge-bases/{tenant_id}/{kb_id}")

if __name__ == "__main__":
    tenant_id = "<your-test-tenant-id>"
    asyncio.run(test_kb_query("5_pages"))
```

**Test 4: Caller history performance**

Test with 100+ previous calls for same caller.

**Test 5: Database connection pool**

Monitor database connections during high load. Check for connection pool exhaustion.

#### What to Monitor
- Response times (P50, P95, P99)
- Error rates
- Memory usage
- CPU usage
- Database connections
- LLM provider circuit breakers
- TTS provider circuit breakers

#### Expected Issues to Fix
1. Database connection pool too small
2. Knowledge base queries too slow
3. Memory leaks in long-running calls
4. Circuit breakers triggering under load
5. Rate limiting from LLM providers

#### Success Criteria
- 10 concurrent calls: 0% error rate
- 20 concurrent calls: <5% error rate
- Knowledge base queries: <2s average
- Caller history lookup: <500ms
- No memory leaks over 1 hour

---

## 🎯 PHASE 2: HIGH PRIORITY (Week 2)

### Task 2.1: Wire Admin Intelligence Page
**Priority**: HIGH - Uses mock data
**Estimated time**: 4 hours

#### Overview
Intelligence page shows hardcoded mock data. Wire to real database queries.

#### Implementation

**Step 1: Create analytics queries**

Update `voice-core/src/api/admin/intelligence.py`:

```python
@router.get("/outcomes")
async def get_outcomes_analytics(
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: dict = Depends(require_admin)
):
    """Get outcome analytics from real call logs."""
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Build query with filters
        where_clauses = []
        params = []
        
        if tenant_id:
            where_clauses.append("tenant_id = %s")
            params.append(tenant_id)
        
        if start_date:
            where_clauses.append("started_at >= %s")
            params.append(start_date)
        
        if end_date:
            where_clauses.append("started_at <= %s")
            params.append(end_date)
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Outcome distribution
        cur.execute(f"""
            SELECT outcome, COUNT(*) as count
            FROM call_logs
            {where_sql}
            GROUP BY outcome
            ORDER BY count DESC
        """, params)
        
        outcomes = []
        for row in cur.fetchall():
            outcomes.append({
                "outcome": row[0] or "unknown",
                "count": row[1]
            })
        
        # Reason distribution
        cur.execute(f"""
            SELECT reason_for_calling, COUNT(*) as count
            FROM call_logs
            {where_sql}
            GROUP BY reason_for_calling
            ORDER BY count DESC
            LIMIT 10
        """, params)
        
        reasons = []
        for row in cur.fetchall():
            reasons.append({
                "reason": row[0] or "unknown",
                "count": row[1]
            })
        
        # Action required rate
        cur.execute(f"""
            SELECT 
                COUNT(CASE WHEN requires_action THEN 1 END) as action_required,
                COUNT(*) as total
            FROM call_logs
            {where_sql}
        """, params)
        
        action_row = cur.fetchone()
        action_rate = (action_row[0] / action_row[1] * 100) if action_row[1] > 0 else 0
        
        return {
            "outcomes": outcomes,
            "reasons": reasons,
            "action_required_rate": round(action_rate, 1),
            "total_calls": action_row[1]
        }
    finally:
        conn.close()


@router.get("/cost-analytics")
async def get_cost_analytics(
    tenant_id: Optional[str] = None,
    session: dict = Depends(require_admin)
):
    """Get cost analytics from call logs."""
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        where_sql = "WHERE tenant_id = %s" if tenant_id else ""
        params = [tenant_id] if tenant_id else []
        
        # Total costs
        cur.execute(f"""
            SELECT 
                SUM(stt_cost_usd) as total_stt,
                SUM(llm_cost_usd) as total_llm,
                SUM(tts_cost_usd) as total_tts,
                SUM(total_cost_usd) as total,
                AVG(total_cost_usd) as avg_per_call,
                COUNT(*) as call_count
            FROM call_logs
            {where_sql}
        """, params)
        
        row = cur.fetchone()
        
        return {
            "total_stt_cost": float(row[0] or 0),
            "total_llm_cost": float(row[1] or 0),
            "total_tts_cost": float(row[2] or 0),
            "total_cost": float(row[3] or 0),
            "avg_cost_per_call": float(row[4] or 0),
            "call_count": row[5] or 0
        }
    finally:
        conn.close()


@router.get("/reason-taxonomy")
async def get_reason_taxonomy(
    tenant_id: Optional[str] = None,
    session: dict = Depends(require_admin)
):
    """Get reason taxonomy from dashboard_options and actual usage."""
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Get configured reasons from dashboard_options
        cur.execute("""
            SELECT reasons_for_calling
            FROM dashboard_options
            WHERE is_global = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        row = cur.fetchone()
        configured_reasons = row[0] if row else []
        
        # Get actual usage counts
        where_sql = "WHERE tenant_id = %s" if tenant_id else ""
        params = [tenant_id] if tenant_id else []
        
        cur.execute(f"""
            SELECT reason_for_calling, COUNT(*) as usage_count
            FROM call_logs
            {where_sql}
            GROUP BY reason_for_calling
            ORDER BY usage_count DESC
        """, params)
        
        usage = {}
        for row in cur.fetchall():
            usage[row[0]] = row[1]
        
        # Combine
        taxonomy = []
        for reason in configured_reasons:
            taxonomy.append({
                "reason": reason,
                "usage_count": usage.get(reason, 0),
                "configured": True
            })
        
        # Add unconfigured reasons that appeared
        for reason, count in usage.items():
            if reason not in configured_reasons:
                taxonomy.append({
                    "reason": reason,
                    "usage_count": count,
                    "configured": False
                })
        
        return {"reasons": taxonomy}
    finally:
        conn.close()
```

**Step 2: Update frontend to remove mock data**

Update `apps/web/src/admin_control_panel/intelligence/IntelligencePage.tsx`:

```typescript
// Remove MOCK_DATA
// const MOCK_DATA = { ... };

// Fetch real data
useEffect(() => {
  const fetchIntelligence = async () => {
    const response = await fetch('/api/admin/intelligence/outcomes');
    const data = await response.json();
    setOutcomes(data.outcomes);
    setReasons(data.reasons);
    // ...
  };
  
  fetchIntelligence();
}, []);
```

#### Testing
1. Verify intelligence page loads real data
2. Test with no calls (should show empty state)
3. Test with calls (should show actual distribution)
4. Test filtering by date range

---

### Task 2.2: Wire Admin Quality Page
**Priority**: HIGH - Uses mock data
**Estimated time**: 4 hours

#### Overview
Quality page shows hardcoded error logs. Need real error tracking.

#### Implementation

**Step 1: Create system_errors table (if not exists)**

Migration might already exist in schema.sql. If not, create `011_add_system_errors.sql`:

```sql
CREATE TABLE system_errors (
    error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    call_id VARCHAR(255),
    error_type VARCHAR(100),
    error_message TEXT,
    stack_trace TEXT,
    severity VARCHAR(20),
    context JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_errors_tenant ON system_errors(tenant_id);
CREATE INDEX idx_system_errors_severity ON system_errors(severity);
CREATE INDEX idx_system_errors_created ON system_errors(created_at DESC);
```

**Step 2: Create error logging utility**

Create `voice-core/src/services/error_tracking.py`:

```python
"""Error tracking service."""
import logging
from typing import Optional, Dict, Any
import traceback
from .db_service import get_db_connection

logger = logging.getLogger(__name__)

def log_system_error(
    error_type: str,
    error_message: str,
    tenant_id: Optional[str] = None,
    call_id: Optional[str] = None,
    severity: str = "ERROR",
    context: Optional[Dict[str, Any]] = None,
    exception: Optional[Exception] = None
):
    """Log system error to database."""
    
    stack_trace = None
    if exception:
        stack_trace = traceback.format_exc()
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO system_errors (
                tenant_id, call_id, error_type, error_message,
                stack_trace, severity, context
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id, call_id, error_type, error_message,
            stack_trace, severity,
            json.dumps(context) if context else None
        ))
        conn.commit()
    except Exception as e:
        logger.error("Failed to log error to database: %s", e)
    finally:
        conn.close()
```

**Step 3: Use error tracking throughout codebase**

Update key error points:

```python
# In bot_runner.py
from .services.error_tracking import log_system_error

try:
    # ... call logic
except AllLLMProvidersFailed as e:
    log_system_error(
        error_type="LLM_PROVIDERS_FAILED",
        error_message=str(e),
        tenant_id=tenant_id,
        call_id=call_sid,
        severity="CRITICAL",
        exception=e
    )
```

**Step 4: Update quality API**

Update `voice-core/src/api/admin/quality.py`:

```python
@router.get("/errors")
async def get_quality_errors(
    tenant_id: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    session: dict = Depends(require_admin)
):
    """Get system errors."""
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        where_clauses = []
        params = []
        
        if tenant_id:
            where_clauses.append("tenant_id = %s")
            params.append(tenant_id)
        
        if severity:
            where_clauses.append("severity = %s")
            params.append(severity)
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        params.append(limit)
        
        cur.execute(f"""
            SELECT 
                error_id, tenant_id, call_id, error_type,
                error_message, severity, context, created_at, resolved
            FROM system_errors
            {where_sql}
            ORDER BY created_at DESC
            LIMIT %s
        """, params)
        
        errors = []
        for row in cur.fetchall():
            errors.append({
                "error_id": str(row[0]),
                "tenant_id": str(row[1]) if row[1] else None,
                "call_id": row[2],
                "error_type": row[3],
                "error_message": row[4],
                "severity": row[5],
                "context": row[6],
                "created_at": row[7].isoformat() if row[7] else None,
                "resolved": row[8]
            })
        
        return {"errors": errors}
    finally:
        conn.close()
```

#### Testing
1. Trigger an error (e.g., invalid API key)
2. Verify error appears in database
3. Verify quality page shows error
4. Test filtering by severity

---

### Task 2.3: Implement Internal Cost Tracking
**Priority**: HIGH - Need to monitor burn rate
**Estimated time**: 3 hours

#### Overview
Track costs internally to monitor spend. Already have cost fields in call_logs, need to populate them.

#### Implementation

**Step 1: Add cost tracking to providers**

Update `voice-core/src/llm/multi_provider_llm.py`:

```python
class MultiProviderLLM:
    def __init__(self, ...):
        # ... existing code
        self.call_costs = {
            'llm': 0.0,
            'stt': 0.0,
            'tts': 0.0
        }
    
    def _estimate_cost(self, provider: str, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost based on provider and tokens."""
        if provider == "gemini":
            # Gemini 2.5 Flash: $0.075/1M input, $0.30/1M output
            input_cost = (input_tokens / 1_000_000) * 0.075
            output_cost = (output_tokens / 1_000_000) * 0.30
            return input_cost + output_cost
        elif provider == "openai":
            # GPT-4o: $2.50/1M input, $10/1M output
            input_cost = (input_tokens / 1_000_000) * 2.50
            output_cost = (output_tokens / 1_000_000) * 10.00
            return input_cost + output_cost
        return 0.0
    
    async def process_frame(self, frame):
        # ... existing logic
        
        # After successful LLM call
        if hasattr(response, 'usage'):
            cost = self._estimate_cost(
                current_provider,
                response.usage.input_tokens,
                response.usage.output_tokens
            )
            self.call_costs['llm'] += cost
            logger.debug(f"LLM call cost: ${cost:.6f} (total: ${self.call_costs['llm']:.6f})")
    
    def get_total_cost(self) -> float:
        """Get total LLM cost for this call."""
        return self.call_costs['llm']
```

Similar updates for TTS:

```python
# voice-core/src/tts/multi_provider_tts.py

class MultiProviderTTS:
    def __init__(self, ...):
        self.call_costs = {'tts': 0.0}
    
    def _estimate_cost(self, provider: str, char_count: int) -> float:
        """Estimate TTS cost."""
        if provider == "cartesia":
            # Cartesia: $0.000037/char
            return char_count * 0.000037
        elif provider == "elevenlabs":
            # ElevenLabs: ~$0.00020/char
            return char_count * 0.00020
        return 0.0
    
    async def process_frame(self, frame):
        # ... existing logic
        
        if isinstance(frame, TextFrame):
            char_count = len(frame.text)
            cost = self._estimate_cost(current_provider, char_count)
            self.call_costs['tts'] += cost
```

**Step 2: Pass costs to call log**

Update `voice-core/src/bot_runner.py`:

```python
# Store references to providers
call_context = {
    'llm_service': llm_service,
    'tts_service': tts_service,
    # ...
}

ACTIVE_CALLS[call_id] = {
    'runner': runner,
    'task': task,
    'context': call_context,
    # ...
}

# In stop_call or _call_log_observer:
context = ACTIVE_CALLS[call_id]['context']
llm_cost = context['llm_service'].get_total_cost()
tts_cost = context['tts_service'].get_total_cost()

upsert_call_log(
    # ... other fields
    llm_cost=llm_cost,
    tts_cost=tts_cost,
)
```

**Step 3: Add cost dashboard**

Create simple endpoint for cost overview:

```python
# voice-core/src/api/admin/operations.py

@router.get("/cost-summary")
async def get_cost_summary(
    days: int = 30,
    session: dict = Depends(require_admin)
):
    """Get cost summary for last N days."""
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                DATE(started_at) as date,
                SUM(stt_cost_usd) as stt,
                SUM(llm_cost_usd) as llm,
                SUM(tts_cost_usd) as tts,
                SUM(total_cost_usd) as total,
                COUNT(*) as calls
            FROM call_logs
            WHERE started_at >= NOW() - INTERVAL '%s days'
            GROUP BY DATE(started_at)
            ORDER BY date DESC
        """, (days,))
        
        daily_costs = []
        for row in cur.fetchall():
            daily_costs.append({
                "date": row[0].isoformat(),
                "stt_cost": float(row[1] or 0),
                "llm_cost": float(row[2] or 0),
                "tts_cost": float(row[3] or 0),
                "total_cost": float(row[4] or 0),
                "calls": row[5]
            })
        
        # Calculate totals
        total = sum(d['total_cost'] for d in daily_costs)
        total_calls = sum(d['calls'] for d in daily_costs)
        avg_per_call = total / total_calls if total_calls > 0 else 0
        
        return {
            "daily": daily_costs,
            "summary": {
                "total_cost": total,
                "total_calls": total_calls,
                "avg_cost_per_call": avg_per_call,
                "period_days": days
            }
        }
    finally:
        conn.close()
```

#### Testing
1. Make test calls
2. Verify costs appear in call_logs
3. Check cost summary endpoint
4. Verify costs are reasonable (not 0, not absurdly high)

---

### Task 2.4: Add STT Fallback Provider
**Priority**: HIGH - Single point of failure
**Estimated time**: 3 hours

#### Implementation

Update `voice-core/src/pipeline/voice_pipeline.py`:

```python
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAISTTService

class STTWithFallback:
    """STT service with automatic fallback."""
    
    def __init__(self):
        self.primary = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            model="nova-3",
            language="en-AU"
        )
        
        self.fallback = OpenAISTTService(
            api_key=os.getenv("OPENAI_API_KEY"),
            model="whisper-1"
        )
        
        self.using_fallback = False
    
    async def process_frame(self, frame):
        """Process frame with fallback."""
        try:
            if not self.using_fallback:
                return await self.primary.process_frame(frame)
            else:
                return await self.fallback.process_frame(frame)
        except Exception as e:
            logger.warning(f"Primary STT failed: {e}, switching to fallback")
            self.using_fallback = True
            return await self.fallback.process_frame(frame)
```

Use `STTWithFallback` instead of direct `DeepgramSTTService`.

---

## 🎯 PHASE 3: POLISH & LAUNCH (Week 3)

### Task 3.1: Session Management Improvements
**Estimated time**: 2 hours

Add:
- Token expiration cleanup (cron job)
- Session refresh endpoint
- Multiple device support (track sessions per user)

### Task 3.2: Customer Dashboard Config Persistence
**Estimated time**: 2 hours

Wire `/dashboard/configuration` page to save changes via API.

### Task 3.3: Database Schema Reconciliation
**Estimated time**: 3 hours

- Reconcile Prisma schema with migrations
- Remove unused schema definitions
- Document schema

### Task 3.4: Production Environment Setup
**Estimated time**: 6 hours

- Environment variables
- SSL certificates
- Domain configuration
- CORS settings
- Rate limiting
- Log aggregation
- Monitoring (Sentry?)

### Task 3.5: Final Integration Testing
**Estimated time**: 8 hours

- End-to-end auth flow testing
- Full call flow testing (50+ calls)
- Load testing (concurrent calls)
- Error scenario testing
- Knowledge base testing
- Call history testing
- Transfer testing

---

## 📋 TESTING CHECKLIST

### Authentication Testing
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Access protected endpoint without session
- [ ] Access protected endpoint with valid session
- [ ] Access another tenant's data (should fail)
- [ ] Logout and verify session destroyed
- [ ] Session expiration
- [ ] Password reset flow
- [ ] Invitation flow

### Voice Pipeline Testing
- [ ] 10 successful calls
- [ ] Call with knowledge base query
- [ ] Call with caller history context
- [ ] Call transfer when requested
- [ ] Simulate LLM failure (fallback)
- [ ] Simulate TTS failure (fallback)
- [ ] Simulate STT failure (fallback)
- [ ] Long call (10+ minutes)
- [ ] Concurrent calls (10+)

### Data Persistence Testing
- [ ] Call logs created correctly
- [ ] Costs tracked accurately
- [ ] Caller history persists
- [ ] Knowledge base CRUD operations
- [ ] Agent config updates persist
- [ ] Dashboard signal updates persist

### Admin Features Testing
- [ ] Create new agent (onboarding)
- [ ] Edit agent configuration
- [ ] Invite user
- [ ] Resend invitation
- [ ] View intelligence data (real, not mock)
- [ ] View quality errors (real, not mock)
- [ ] Run stress test

### Customer Dashboard Testing
- [ ] View call logs
- [ ] Filter call logs
- [ ] Export call logs
- [ ] Resolve action items
- [ ] Archive calls
- [ ] Update configuration

### Error Handling Testing
- [ ] Invalid API keys
- [ ] Database connection failure
- [ ] Network timeout
- [ ] Malformed requests
- [ ] Missing required fields

---

## 🚀 LAUNCH DAY CHECKLIST

### Pre-Launch (24 hours before)
- [ ] All migrations applied to production DB
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] DNS configured
- [ ] Monitoring enabled
- [ ] Error tracking enabled
- [ ] Backup system verified
- [ ] Load tested (passed)
- [ ] All critical tests passed

### Launch Day
- [ ] Deploy backend (voice-core)
- [ ] Deploy frontend (apps/web)
- [ ] Verify health checks
- [ ] Test one complete flow
- [ ] Monitor logs for errors
- [ ] Monitor performance metrics
- [ ] Have rollback plan ready

### Post-Launch (First 24 hours)
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor cost burn rate
- [ ] Check database performance
- [ ] Verify calls completing successfully
- [ ] Check for memory leaks
- [ ] Verify email delivery
- [ ] Check Twilio webhook delivery

---

## 🔧 TOOLS & SCRIPTS

### Quick database inspection
```bash
# Check call_logs count
psql -U postgres -d voice_os -c "SELECT COUNT(*) FROM call_logs;"

# Check recent errors
psql -U postgres -d voice_os -c "SELECT * FROM system_errors ORDER BY created_at DESC LIMIT 10;"

# Check session count
psql -U postgres -d voice_os -c "SELECT COUNT(*) FROM sessions WHERE expires_at > NOW();"

# Check costs
psql -U postgres -d voice_os -c "SELECT SUM(total_cost_usd), COUNT(*) FROM call_logs WHERE started_at >= NOW() - INTERVAL '24 hours';"
```

### Health check script
```bash
#!/bin/bash
# health_check.sh

echo "Checking voice-core health..."
curl -f http://localhost:8000/health || exit 1

echo "Checking frontend health..."
curl -f http://localhost:3001 || exit 1

echo "Checking database..."
psql -U postgres -d voice_os -c "SELECT 1;" || exit 1

echo "All systems operational ✓"
```

---

## 📞 SUPPORT CONTACTS

- Database issues: Check `voice-ai-os/infrastructure/database/README.md`
- API issues: Check `voice-core/src/api/README.md` (if exists)
- Frontend issues: Check `apps/web/README.md`

---

## 🎯 SUCCESS METRICS

### Week 1 Complete
- ✅ All endpoints protected with authentication
- ✅ Call logs table created and populated
- ✅ Pipeline errors handled gracefully
- ✅ Stress tests pass (20+ conversations, 10+ concurrent calls)

### Week 2 Complete
- ✅ Admin intelligence shows real data
- ✅ Admin quality shows real errors
- ✅ Costs tracked per call
- ✅ STT fallback implemented

### Week 3 Complete
- ✅ All integration tests pass
- ✅ Production environment configured
- ✅ Documentation complete
- ✅ Ready for launch

---

## 📝 NOTES FOR CODEX

**Key principles:**
1. Security first - implement auth before anything else
2. Test thoroughly - don't skip stress testing
3. Monitor everything - log all errors
4. Fail gracefully - never crash a call
5. Document as you go

**When stuck:**
1. Check the transcript for context
2. Read existing code before modifying
3. Test incrementally
4. Ask for clarification if requirements unclear

**Priority order if time constrained:**
1. Authentication (MUST HAVE)
2. Call logs table (MUST HAVE)
3. Pipeline error handling (MUST HAVE)
4. Basic stress testing (MUST HAVE)
5. Everything else (NICE TO HAVE)

Good luck! 🚀
