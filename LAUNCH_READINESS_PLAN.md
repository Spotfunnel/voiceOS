# Production Launch Readiness Plan
*Complete Implementation Guide - All Critical & Nice-to-Have Features*

## Mission
Complete all remaining production readiness tasks to ensure a stable, secure, and well-tested launch of the SpotFunnel voice AI system.

**System Flow**: Admin configures agents → Voice calls happen → Call data flows to customer dashboard (view-only)

**Timeline**: 2-3 days for critical items, +1 day for nice-to-haves

**Scope**: 
- ✅ **Admin Portal**: Full configuration capabilities (agents, knowledge bases, system prompts, etc.)
- ✅ **Voice Pipeline**: Call handling, STT/LLM/TTS with fallbacks, cost tracking
- ✅ **Customer Dashboard**: View-only interface for call logs, analytics, action items (no configuration)
- ❌ **Removed**: All customer-facing configuration UI (voice selection, knowledge base editing, email templates)

---

## 🚨 CRITICAL PATH (Day 1-2)

### Task 1: User-Facing Error Fallback Messages
**Priority**: CRITICAL - Poor UX when providers fail  
**Estimated time**: 3 hours  
**Status**: Partially done (logging exists, but no user-facing fallback)

#### Problem
Currently when LLM/TTS providers fail, the system logs errors to `system_errors` but doesn't provide fallback messages to the caller. The call just dies silently.

#### Implementation

**Step 1: Create error handler service**

Create [`voice-core/src/pipeline/error_handlers.py`](voice-core/src/pipeline/error_handlers.py):

```python
"""
Pipeline error handlers for graceful degradation.
Provides user-facing fallback messages when providers fail.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class PipelineErrorHandler:
    """Handle pipeline errors gracefully with user-facing fallbacks."""
    
    def __init__(self, tenant_id: str, call_sid: str):
        self.tenant_id = tenant_id
        self.call_sid = call_sid
    
    def get_llm_failure_message(self) -> str:
        """
        Get fallback message for LLM provider failure.
        This message will be spoken to the caller via TTS (if available)
        or Twilio's built-in TTS as last resort.
        """
        logger.critical(
            "All LLM providers failed for call %s (tenant %s)",
            self.call_sid, self.tenant_id
        )
        
        return (
            "I apologize, but I'm experiencing technical difficulties right now. "
            "Let me transfer you to someone who can help you immediately."
        )
    
    def get_tts_failure_message(self) -> str:
        """
        Get fallback message for TTS provider failure.
        This will be played using Twilio's built-in TTS.
        """
        logger.critical(
            "All TTS providers failed for call %s (tenant %s)",
            self.call_sid, self.tenant_id
        )
        
        return (
            "I'm sorry, I'm having trouble with my voice system. "
            "Please hold while I transfer you to a representative."
        )
    
    def get_stt_failure_message(self) -> str:
        """Get fallback message for STT failure."""
        logger.critical(
            "STT failed for call %s (tenant %s)",
            self.call_sid, self.tenant_id
        )
        
        return (
            "I'm having trouble hearing you clearly. "
            "Let me connect you with someone who can help."
        )
    
    def get_generic_error_message(self) -> str:
        """Get generic error message for unexpected failures."""
        return (
            "I apologize, but something went wrong. "
            "Let me transfer you to someone who can assist you."
        )
```

**Step 2: Create Twilio fallback service**

Create [`voice-core/src/services/twilio_fallback.py`](voice-core/src/services/twilio_fallback.py):

```python
"""
Twilio fallback service for emergency error handling.
When pipeline fails, use Twilio API to play message and transfer.
"""
import os
import logging
from typing import Optional
from twilio.rest import Client

logger = logging.getLogger(__name__)


class TwilioFallbackService:
    """Use Twilio API directly for emergency fallback."""
    
    def __init__(self):
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        
        if not account_sid or not auth_token:
            logger.warning("Twilio credentials not configured for fallback service")
            self.client = None
        else:
            self.client = Client(account_sid, auth_token)
    
    async def play_message_and_transfer(
        self,
        call_sid: str,
        message: str,
        transfer_phone: Optional[str] = None,
        transfer_name: str = "support"
    ) -> bool:
        """
        Play fallback message and optionally transfer call.
        
        Args:
            call_sid: Twilio call SID
            message: Message to speak to caller
            transfer_phone: Phone number to transfer to (optional)
            transfer_name: Name of transfer destination
        
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("Twilio client not configured, cannot play fallback")
            return False
        
        try:
            # Build TwiML
            from twilio.twiml.voice_response import VoiceResponse
            
            response = VoiceResponse()
            response.say(message, voice='Polly.Joanna')
            
            if transfer_phone:
                response.dial(
                    transfer_phone,
                    action='/webhooks/transfer-complete',
                    timeout=30
                )
            else:
                # No transfer number, just hang up after message
                response.hangup()
            
            # Update the call with new TwiML
            call = self.client.calls(call_sid).update(
                twiml=str(response)
            )
            
            logger.info(
                "Played fallback message and %s for call %s",
                f"transferred to {transfer_phone}" if transfer_phone else "hung up",
                call_sid
            )
            return True
            
        except Exception as e:
            logger.exception("Failed to play fallback message: %s", e)
            return False
    
    async def emergency_hangup(self, call_sid: str, message: str) -> bool:
        """Emergency hangup with message (no transfer available)."""
        return await self.play_message_and_transfer(
            call_sid=call_sid,
            message=message,
            transfer_phone=None
        )
```

**Step 3: Update bot_runner to use fallback**

Update [`voice-core/src/bot_runner.py`](voice-core/src/bot_runner.py) in the `_run_pipeline_guarded` function:

```python
# Add imports at top
from .pipeline.error_handlers import PipelineErrorHandler
from .services.twilio_fallback import TwilioFallbackService

# Initialize fallback service once
twilio_fallback = TwilioFallbackService()

async def _run_pipeline_guarded(call_id: str, task: PipelineTask, runner: PipelineRunner, pipeline) -> None:
    context = call_log_contexts.get(call_id)
    
    # Get tenant config for transfer info
    tenant_config = None
    if context:
        try:
            tenant_config = get_tenant_config(context.tenant_id)
        except Exception:
            logger.warning("Could not load tenant config for fallback")
    
    error_handler = PipelineErrorHandler(
        tenant_id=context.tenant_id if context else "unknown",
        call_sid=context.call_sid if context else call_id
    )
    
    try:
        await runner.run(task)
        
    except AllLLMProvidersFailed as exc:
        logger.error("All LLM providers failed for call %s: %s", call_id, exc)
        log_system_error(
            error_type="LLM_PROVIDERS_FAILED",
            error_message=str(exc),
            tenant_id=context.tenant_id if context else None,
            call_id=call_id,
            severity="CRITICAL",
            exception=exc,
        )
        
        # CRITICAL: Play fallback message to user
        fallback_message = error_handler.get_llm_failure_message()
        
        # Get transfer phone from tenant config
        transfer_phone = None
        if tenant_config and tenant_config.get('telephony'):
            transfer_phone = tenant_config['telephony'].get('transfer_contact_phone')
        
        # Use Twilio API to play message and transfer
        if context and context.call_sid:
            await twilio_fallback.play_message_and_transfer(
                call_sid=context.call_sid,
                message=fallback_message,
                transfer_phone=transfer_phone
            )
        
        # Update call log
        if context:
            context.outcome = "failed"
            context.status = "failed"
            context.end_time = datetime.utcnow()
            costs = _extract_costs_from_pipeline(pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
    
    except AllTTSProvidersFailed as exc:
        logger.error("All TTS providers failed for call %s: %s", call_id, exc)
        log_system_error(
            error_type="TTS_PROVIDERS_FAILED",
            error_message=str(exc),
            tenant_id=context.tenant_id if context else None,
            call_id=call_id,
            severity="CRITICAL",
            exception=exc,
        )
        
        # CRITICAL: Play fallback message using Twilio's built-in TTS
        fallback_message = error_handler.get_tts_failure_message()
        
        transfer_phone = None
        if tenant_config and tenant_config.get('telephony'):
            transfer_phone = tenant_config['telephony'].get('transfer_contact_phone')
        
        if context and context.call_sid:
            await twilio_fallback.play_message_and_transfer(
                call_sid=context.call_sid,
                message=fallback_message,
                transfer_phone=transfer_phone
            )
        
        # Update call log
        if context:
            context.outcome = "failed"
            context.status = "failed"
            context.end_time = datetime.utcnow()
            costs = _extract_costs_from_pipeline(pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
    
    except Exception as exc:
        logger.exception("Pipeline failed for call %s: %s", call_id, exc)
        log_system_error(
            error_type="PIPELINE_ERROR",
            error_message=str(exc),
            tenant_id=context.tenant_id if context else None,
            call_id=call_id,
            severity="ERROR",
            exception=exc,
        )
        
        # CRITICAL: Generic error fallback
        fallback_message = error_handler.get_generic_error_message()
        
        transfer_phone = None
        if tenant_config and tenant_config.get('telephony'):
            transfer_phone = tenant_config['telephony'].get('transfer_contact_phone')
        
        if context and context.call_sid:
            await twilio_fallback.play_message_and_transfer(
                call_sid=context.call_sid,
                message=fallback_message,
                transfer_phone=transfer_phone
            )
        
        # Update call log
        if context:
            context.outcome = "failed"
            context.status = "failed"
            context.end_time = datetime.utcnow()
            costs = _extract_costs_from_pipeline(pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
    
    finally:
        active_calls.pop(call_id, None)
```

#### Testing

1. **Test LLM failure**:
   - Set invalid OpenAI and Gemini API keys
   - Make test call
   - Verify caller hears fallback message
   - Verify call transfers if transfer phone configured
   - Check `system_errors` table for logged error

2. **Test TTS failure**:
   - Set invalid Cartesia and ElevenLabs API keys
   - Make test call
   - Verify fallback message plays via Twilio TTS

3. **Test with no transfer number**:
   - Remove `transfer_contact_phone` from tenant config
   - Trigger error
   - Verify call hangs up gracefully after message

---

### Task 2: Stress Testing & Load Testing
**Priority**: CRITICAL - Unknown performance  
**Estimated time**: 6 hours  
**Status**: Not started

#### Problem
System has never been load tested. Unknown how it behaves under concurrent load, database connection limits, memory usage patterns.

#### Implementation

**Step 1: Test existing stress test API**

Create [`voice-core/tests/manual_stress_test.py`](voice-core/tests/manual_stress_test.py):

```python
"""
Manual stress test runner for adversarial conversation testing.
Uses existing /api/stress-test/run endpoint.
"""
import asyncio
import httpx
from datetime import datetime


async def run_adversarial_stress_test():
    """Run 20 adversarial conversations against a tenant."""
    
    print("=" * 60)
    print("ADVERSARIAL STRESS TEST")
    print("=" * 60)
    
    # TODO: Replace with actual tenant ID
    tenant_id = input("Enter tenant ID to test: ").strip()
    
    test_config = {
        "tenant_id": tenant_id,
        "num_conversations": 20,
        "industry": "HVAC",
        "system_prompt": (
            "You are a helpful HVAC receptionist. "
            "Answer questions about service appointments, pricing, and availability."
        ),
        "knowledge_base": (
            "Service call fee: $95. "
            "Available Monday-Friday 8am-6pm. "
            "Emergency service available 24/7 at $150/hour."
        ),
    }
    
    print(f"\nStarting test with {test_config['num_conversations']} conversations...")
    print(f"Tenant: {tenant_id}")
    print(f"Industry: {test_config['industry']}")
    
    start_time = datetime.now()
    
    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/stress-test/run",
                json=test_config
            )
            response.raise_for_status()
            result = response.json()
            
        except httpx.TimeoutException:
            print("\n❌ Test timed out (>10 minutes)")
            return
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            return
    
    duration = (datetime.now() - start_time).total_seconds()
    
    # Print results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    summary = result.get('summary', {})
    print(f"\nTotal conversations: {summary.get('total_conversations', 0)}")
    print(f"Passed: {summary.get('passed_count', 0)}")
    print(f"Failed: {summary.get('failed_count', 0)}")
    print(f"Pass rate: {summary.get('pass_rate', 0):.1f}%")
    print(f"Duration: {duration:.1f}s")
    
    # Show failed conversations
    failed_convos = [
        c for c in result.get('conversations', [])
        if c.get('result', {}).get('overallResult') == 'FAIL'
    ]
    
    if failed_convos:
        print(f"\n⚠️  {len(failed_convos)} conversations failed:")
        for i, convo in enumerate(failed_convos, 1):
            print(f"\n--- Failed Conversation {i} ---")
            print("Transcript:")
            print(convo.get('transcript', 'N/A'))
            print("\nReason:")
            result_obj = convo.get('result', {})
            print(f"  - Politeness: {result_obj.get('politeness', 'N/A')}")
            print(f"  - Accuracy: {result_obj.get('accuracy', 'N/A')}")
            print(f"  - Escalation: {result_obj.get('escalation', 'N/A')}")
    else:
        print("\n✅ All conversations passed!")
    
    # Pass criteria
    print("\n" + "=" * 60)
    print("PASS CRITERIA")
    print("=" * 60)
    
    pass_rate = summary.get('pass_rate', 0)
    
    if pass_rate >= 85:
        print(f"✅ PASS: {pass_rate:.1f}% pass rate (target: ≥85%)")
    else:
        print(f"❌ FAIL: {pass_rate:.1f}% pass rate (target: ≥85%)")
    
    if duration < 120:
        print(f"✅ PASS: {duration:.1f}s duration (target: <120s)")
    else:
        print(f"⚠️  SLOW: {duration:.1f}s duration (target: <120s)")


if __name__ == "__main__":
    asyncio.run(run_adversarial_stress_test())
```

**Step 2: Create concurrent call load test**

Create [`voice-core/tests/load_test_concurrent_calls.py`](voice-core/tests/load_test_concurrent_calls.py):

```python
"""
Load test for concurrent voice calls.
Simulates multiple simultaneous callers to test system capacity.
"""
import asyncio
import httpx
import time
from datetime import datetime
from typing import List, Dict


async def simulate_call(
    call_num: int,
    tenant_id: str,
    test_phone: str
) -> Dict:
    """Simulate a single call via start_call endpoint."""
    
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Start call
            response = await client.post(
                "http://localhost:8000/start_call",
                json={
                    "call_sid": f"TEST-CALL-{call_num}-{int(time.time())}",
                    "tenant_id": tenant_id,
                    "caller_phone": test_phone,
                    "transport": "twilio"
                }
            )
            
            if response.status_code != 200:
                return {
                    "call_num": call_num,
                    "status": "failed",
                    "error": f"Start failed: {response.status_code}",
                    "duration": time.time() - start_time
                }
            
            # Wait for call to initialize
            await asyncio.sleep(5)
            
            # Stop call
            call_sid = response.json().get('call_sid')
            await client.post(
                "http://localhost:8000/stop_call",
                json={"call_id": call_sid}
            )
            
            duration = time.time() - start_time
            
            return {
                "call_num": call_num,
                "status": "success",
                "duration": duration,
                "call_sid": call_sid
            }
            
    except asyncio.TimeoutError:
        return {
            "call_num": call_num,
            "status": "timeout",
            "duration": time.time() - start_time
        }
    except Exception as e:
        return {
            "call_num": call_num,
            "status": "error",
            "error": str(e),
            "duration": time.time() - start_time
        }


async def run_concurrent_call_test(
    num_concurrent: int = 10,
    tenant_id: str = None,
    test_phone: str = "+15555551234"
):
    """Run concurrent call load test."""
    
    print("=" * 60)
    print(f"CONCURRENT CALL LOAD TEST ({num_concurrent} calls)")
    print("=" * 60)
    
    if not tenant_id:
        tenant_id = input("Enter tenant ID: ").strip()
    
    print(f"\nTenant: {tenant_id}")
    print(f"Concurrent calls: {num_concurrent}")
    print(f"Test phone: {test_phone}")
    
    start_time = datetime.now()
    
    # Launch all calls concurrently
    print(f"\n🚀 Launching {num_concurrent} concurrent calls...")
    
    tasks = [
        simulate_call(i + 1, tenant_id, test_phone)
        for i in range(num_concurrent)
    ]
    
    results = await asyncio.gather(*tasks)
    
    total_duration = (datetime.now() - start_time).total_seconds()
    
    # Analyze results
    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] == 'failed']
    timeouts = [r for r in results if r['status'] == 'timeout']
    errors = [r for r in results if r['status'] == 'error']
    
    avg_duration = sum(r['duration'] for r in successful) / len(successful) if successful else 0
    
    # Print results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    print(f"\nTotal calls: {num_concurrent}")
    print(f"✅ Successful: {len(successful)}")
    print(f"❌ Failed: {len(failed)}")
    print(f"⏱️  Timeouts: {len(timeouts)}")
    print(f"🔥 Errors: {len(errors)}")
    
    print(f"\nTotal test duration: {total_duration:.2f}s")
    print(f"Average call duration: {avg_duration:.2f}s")
    
    if failed or errors:
        print("\n⚠️  Failed/Error calls:")
        for r in failed + errors:
            print(f"  Call #{r['call_num']}: {r.get('error', 'Unknown error')}")
    
    # Pass criteria
    print("\n" + "=" * 60)
    print("PASS CRITERIA")
    print("=" * 60)
    
    success_rate = len(successful) / num_concurrent * 100
    
    if success_rate >= 90:
        print(f"✅ PASS: {success_rate:.1f}% success rate (target: ≥90%)")
    else:
        print(f"❌ FAIL: {success_rate:.1f}% success rate (target: ≥90%)")
    
    if avg_duration < 10:
        print(f"✅ PASS: {avg_duration:.2f}s avg duration (target: <10s)")
    else:
        print(f"⚠️  SLOW: {avg_duration:.2f}s avg duration (target: <10s)")
    
    if len(timeouts) == 0:
        print("✅ PASS: No timeouts")
    else:
        print(f"❌ FAIL: {len(timeouts)} timeouts")


async def run_load_test_suite():
    """Run full load test suite with increasing concurrency."""
    
    tenant_id = input("Enter tenant ID: ").strip()
    test_phone = input("Enter test phone number (default: +15555551234): ").strip() or "+15555551234"
    
    print("\n" + "=" * 60)
    print("LOAD TEST SUITE")
    print("=" * 60)
    
    test_levels = [5, 10, 20]
    
    for num_concurrent in test_levels:
        print(f"\n\n{'=' * 60}")
        print(f"Testing with {num_concurrent} concurrent calls")
        print("=" * 60)
        
        await run_concurrent_call_test(
            num_concurrent=num_concurrent,
            tenant_id=tenant_id,
            test_phone=test_phone
        )
        
        # Rest between tests
        if num_concurrent < test_levels[-1]:
            print("\n⏳ Resting 30s before next test...")
            await asyncio.sleep(30)
    
    print("\n\n" + "=" * 60)
    print("LOAD TEST SUITE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Single test with specified concurrency
        num = int(sys.argv[1])
        asyncio.run(run_concurrent_call_test(num_concurrent=num))
    else:
        # Full suite
        asyncio.run(run_load_test_suite())
```

**Step 3: Database connection pool monitoring**

Create [`voice-core/tests/db_connection_test.py`](voice-core/tests/db_connection_test.py):

```python
"""
Test database connection pool under load.
Monitors for connection leaks and pool exhaustion.
"""
import asyncio
import psycopg2
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.database.db_service import get_db_service


async def test_connection_pool(num_iterations: int = 100):
    """Test connection pool by rapidly acquiring and releasing connections."""
    
    print("=" * 60)
    print(f"DATABASE CONNECTION POOL TEST ({num_iterations} iterations)")
    print("=" * 60)
    
    db_service = get_db_service()
    
    start_time = datetime.now()
    errors = []
    
    print(f"\n🔄 Running {num_iterations} connection acquire/release cycles...")
    
    for i in range(num_iterations):
        try:
            conn = db_service.get_connection()
            
            # Do a simple query
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            cur.close()
            
            # Return to pool
            db_service.put_connection(conn)
            
            if (i + 1) % 10 == 0:
                print(f"  Completed {i + 1}/{num_iterations} cycles...")
            
        except Exception as e:
            errors.append((i, str(e)))
            print(f"  ❌ Error on iteration {i}: {e}")
    
    duration = (datetime.now() - start_time).total_seconds()
    
    # Results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    success_count = num_iterations - len(errors)
    success_rate = success_count / num_iterations * 100
    
    print(f"\nTotal iterations: {num_iterations}")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed: {len(errors)}")
    print(f"Success rate: {success_rate:.1f}%")
    print(f"Duration: {duration:.2f}s")
    print(f"Avg time per cycle: {duration/num_iterations*1000:.2f}ms")
    
    if errors:
        print("\n⚠️  Errors encountered:")
        for idx, error in errors[:10]:  # Show first 10 errors
            print(f"  Iteration {idx}: {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")
    
    # Pass criteria
    print("\n" + "=" * 60)
    print("PASS CRITERIA")
    print("=" * 60)
    
    if success_rate == 100:
        print("✅ PASS: 100% success rate")
    elif success_rate >= 95:
        print(f"⚠️  WARNING: {success_rate:.1f}% success rate (target: 100%)")
    else:
        print(f"❌ FAIL: {success_rate:.1f}% success rate (target: 100%)")


if __name__ == "__main__":
    asyncio.run(test_connection_pool(num_iterations=100))
```

#### Testing Steps

1. **Run adversarial stress test**:
   ```bash
   cd voice-core
   python tests/manual_stress_test.py
   # Target: ≥85% pass rate, <120s duration
   ```

2. **Run concurrent call test**:
   ```bash
   python tests/load_test_concurrent_calls.py 10
   # Target: ≥90% success rate, <10s avg duration
   ```

3. **Run full load test suite** (5, 10, 20 concurrent):
   ```bash
   python tests/load_test_concurrent_calls.py
   # Monitor for degradation at higher concurrency
   ```

4. **Test connection pool**:
   ```bash
   python tests/db_connection_test.py
   # Target: 100% success rate, no leaks
   ```

5. **Monitor during tests**:
   - CPU usage (`top` or Task Manager)
   - Memory usage (watch for leaks)
   - Database connections (PostgreSQL `pg_stat_activity`)
   - Response times
   - Error logs

#### Pass Criteria

- ✅ Adversarial test: ≥85% pass rate
- ✅ Concurrent calls: ≥90% success rate with 10+ concurrent
- ✅ No connection pool exhaustion
- ✅ No memory leaks during sustained load
- ✅ Response times stay under 10s

---

### Task 3: Production Environment Setup
**Priority**: CRITICAL - Security & stability  
**Estimated time**: 6 hours  
**Status**: Not started

#### Problem
System only configured for local development. Need production-grade environment setup.

#### Implementation

**Step 1: Environment variables**

Create [`voice-core/.env.production.example`](voice-core/.env.production.example):

```bash
# Production Environment Variables Template
# Copy to .env.production and fill in real values

# === API Keys ===
OPENAI_API_KEY=sk-prod-xxxxx
GEMINI_API_KEY=xxxxx
DEEPGRAM_API_KEY=xxxxx
CARTESIA_API_KEY=xxxxx
ELEVENLABS_API_KEY=xxxxx

# === Twilio ===
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890

# === Database ===
DATABASE_URL=postgresql://user:password@prod-db-host:5432/voice_os
DB_POOL_MIN=5
DB_POOL_MAX=20

# === Daily.co ===
DAILY_API_KEY=xxxxx
DAILY_API_URL=https://api.daily.co/v1

# === Security ===
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SESSION_SECRET=xxxxx
API_SECRET_KEY=xxxxx

# === CORS ===
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# === Rate Limiting ===
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60

# === Monitoring ===
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
LOG_LEVEL=INFO
ENABLE_METRICS=true

# === Server ===
HOST=0.0.0.0
PORT=8000
WORKERS=4

# === SSL/TLS ===
SSL_CERT_PATH=/etc/ssl/certs/fullchain.pem
SSL_KEY_PATH=/etc/ssl/private/privkey.pem

# === Feature Flags ===
ENABLE_STRESS_TEST=false
ENABLE_DEBUG_ENDPOINTS=false
```

**Step 2: CORS configuration**

Update [`voice-core/src/bot_runner.py`](voice-core/src/bot_runner.py):

```python
from fastapi.middleware.cors import CORSMiddleware
import os

# Add after app = FastAPI(...)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

logger.info(f"CORS enabled for origins: {allowed_origins}")
```

**Step 3: Rate limiting**

Create [`voice-core/src/middleware/rate_limit.py`](voice-core/src/middleware/rate_limit.py):

```python
"""
Rate limiting middleware to prevent abuse.
"""
import time
from collections import defaultdict
from typing import Dict, Tuple
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
import os
import logging

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter.
    For production, consider Redis-based rate limiting for multi-server deployments.
    """
    
    def __init__(self, app, requests_per_period: int = 100, period_seconds: int = 60):
        super().__init__(app)
        self.requests_per_period = requests_per_period
        self.period_seconds = period_seconds
        self.requests: Dict[str, list] = defaultdict(list)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for X-Forwarded-For (if behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        # Check X-Real-IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct connection IP
        return request.client.host if request.client else "unknown"
    
    def _clean_old_requests(self, client_ip: str, current_time: float):
        """Remove requests older than the period."""
        cutoff_time = current_time - self.period_seconds
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if req_time > cutoff_time
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Clean old requests
        self._clean_old_requests(client_ip, current_time)
        
        # Check rate limit
        request_count = len(self.requests[client_ip])
        
        if request_count >= self.requests_per_period:
            logger.warning(
                f"Rate limit exceeded for {client_ip}: "
                f"{request_count} requests in {self.period_seconds}s"
            )
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {self.requests_per_period} requests per {self.period_seconds}s."
            )
        
        # Record this request
        self.requests[client_ip].append(current_time)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = self.requests_per_period - len(self.requests[client_ip])
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_period)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(current_time + self.period_seconds))
        
        return response
```

Add to [`voice-core/src/bot_runner.py`](voice-core/src/bot_runner.py):

```python
from .middleware.rate_limit import RateLimitMiddleware

# Add after CORS middleware
if os.getenv("ENABLE_RATE_LIMITING", "true").lower() == "true":
    rate_limit_requests = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    rate_limit_period = int(os.getenv("RATE_LIMIT_PERIOD", "60"))
    
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_period=rate_limit_requests,
        period_seconds=rate_limit_period
    )
    
    logger.info(f"Rate limiting enabled: {rate_limit_requests} req/{rate_limit_period}s")
```

**Step 4: Error monitoring (Sentry)**

Create [`voice-core/src/services/error_monitoring.py`](voice-core/src/services/error_monitoring.py):

```python
"""
Error monitoring integration (Sentry).
"""
import os
import logging

logger = logging.getLogger(__name__)


def init_error_monitoring():
    """Initialize Sentry for error tracking."""
    sentry_dsn = os.getenv("SENTRY_DSN")
    
    if not sentry_dsn:
        logger.info("Sentry not configured (SENTRY_DSN not set)")
        return
    
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=os.getenv("ENVIRONMENT", "production"),
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR
                ),
            ],
            traces_sample_rate=0.1,  # 10% of requests for performance monitoring
            profiles_sample_rate=0.1,
        )
        
        logger.info("Sentry error monitoring initialized")
        
    except ImportError:
        logger.warning("sentry-sdk not installed. Install with: pip install sentry-sdk")
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")


def capture_exception(exception: Exception, context: dict = None):
    """Capture exception to Sentry."""
    try:
        import sentry_sdk
        
        if context:
            sentry_sdk.set_context("custom", context)
        
        sentry_sdk.capture_exception(exception)
        
    except ImportError:
        pass  # Sentry not installed
    except Exception as e:
        logger.error(f"Failed to capture exception to Sentry: {e}")
```

Add to [`voice-core/src/bot_runner.py`](voice-core/src/bot_runner.py):

```python
from .services.error_monitoring import init_error_monitoring

# Add before app.include_router calls
init_error_monitoring()
```

**Step 5: SSL/HTTPS configuration**

Create [`voice-core/run_production.sh`](voice-core/run_production.sh):

```bash
#!/bin/bash
# Production startup script with SSL

set -e

echo "Starting Voice Core in PRODUCTION mode..."

# Load production environment
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "ERROR: .env.production not found"
    exit 1
fi

# Verify SSL certificates
if [ ! -f "$SSL_CERT_PATH" ]; then
    echo "ERROR: SSL certificate not found at $SSL_CERT_PATH"
    exit 1
fi

if [ ! -f "$SSL_KEY_PATH" ]; then
    echo "ERROR: SSL key not found at $SSL_KEY_PATH"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
python infrastructure/database/migrate.py

# Start with Uvicorn + SSL
echo "Starting server with SSL on $HOST:$PORT..."
uvicorn src.bot_runner:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS" \
    --ssl-keyfile "$SSL_KEY_PATH" \
    --ssl-certfile "$SSL_CERT_PATH" \
    --log-level info \
    --access-log \
    --proxy-headers \
    --forwarded-allow-ips '*'
```

Make executable:
```bash
chmod +x voice-core/run_production.sh
```

**Step 6: Production requirements**

Create [`voice-core/requirements.production.txt`](voice-core/requirements.production.txt):

```
# Production-specific dependencies
sentry-sdk>=1.39.0
gunicorn>=21.2.0
uvicorn[standard]>=0.25.0
```

#### Deployment Checklist

- [ ] Copy `.env.production.example` to `.env.production` and fill with real values
- [ ] Generate secure `SESSION_SECRET` and `API_SECRET_KEY`
- [ ] Configure SSL certificates (Let's Encrypt recommended)
- [ ] Set up domain DNS A/AAAA records
- [ ] Configure CORS for production domains
- [ ] Set up Sentry project and get DSN
- [ ] Install production dependencies: `pip install -r requirements.production.txt`
- [ ] Test SSL: `curl https://yourdomain.com/health`
- [ ] Verify CORS: Test from production frontend
- [ ] Verify rate limiting: Make 100+ rapid requests

---

### Task 4: Integration Testing
**Priority**: CRITICAL - Verify everything works  
**Estimated time**: 4 hours  
**Status**: Not started

#### Problem
No systematic end-to-end testing. Need to verify all critical flows work together.

#### Implementation

Create [`INTEGRATION_TEST_CHECKLIST.md`](INTEGRATION_TEST_CHECKLIST.md):

```markdown
# Integration Test Checklist
*Manual testing checklist for production readiness*

## Authentication Flow

### Login
- [ ] Login with valid credentials (admin)
- [ ] Verify `session_token` cookie set
- [ ] Verify `sf_session` cookie set
- [ ] Verify redirect to dashboard
- [ ] Login with invalid email → expect error
- [ ] Login with invalid password → expect error
- [ ] Check session in database: `SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;`

### Session Validation
- [ ] Access protected endpoint with valid session → expect 200
- [ ] Access protected endpoint without cookie → expect 401
- [ ] Delete session from DB, try to access → expect 401
- [ ] Login, verify `last_login_at` updated in users table

### Logout
- [ ] Logout via `/api/auth/logout`
- [ ] Verify session deleted from database
- [ ] Verify cookies cleared
- [ ] Try to access protected endpoint → expect 401

### Authorization
- [ ] Admin user can access `/api/admin/agents` → expect 200
- [ ] Customer user tries `/api/admin/agents` → expect 403 (if you have customer role)
- [ ] User tries to access another tenant's data → expect 403

---

## Voice Pipeline

### Basic Call Flow
- [ ] Start test call: `POST /start_call`
- [ ] Verify call appears in `call_logs` table
- [ ] Verify call status is "active" or "in_progress"
- [ ] Stop call: `POST /stop_call`
- [ ] Verify call status updated to "completed"
- [ ] Verify duration calculated
- [ ] Check costs tracked (STT, LLM, TTS)

### Knowledge Base Integration
- [ ] Create knowledge base via `/api/knowledge-bases`
- [ ] Start call with knowledge base configured
- [ ] Ask question that requires knowledge base
- [ ] Verify correct response
- [ ] Check logs for RAG retrieval

### Caller History Context
- [ ] Make first call from a phone number
- [ ] Verify `call_history` entry created
- [ ] Make second call from same number
- [ ] Verify bot has context from previous call

### Call Transfer
- [ ] Configure `transfer_contact_phone` in tenant config
- [ ] Make call and request transfer
- [ ] Verify transfer initiated
- [ ] Check call log for transfer outcome

---

## Error Handling

### LLM Provider Failure
- [ ] Set invalid OpenAI and Gemini API keys in `.env`
- [ ] Start test call
- [ ] Verify fallback message plays to caller
- [ ] Verify call transfers (if transfer phone configured)
- [ ] Check `system_errors` table for logged error
- [ ] Check `call_logs` status is "failed"
- [ ] Restore valid API keys

### TTS Provider Failure
- [ ] Set invalid Cartesia and ElevenLabs API keys
- [ ] Start test call
- [ ] Verify fallback message plays via Twilio TTS
- [ ] Verify call transfers or hangs up gracefully
- [ ] Check `system_errors` table
- [ ] Restore valid API keys

### Database Connection Failure
- [ ] Stop PostgreSQL: `sudo systemctl stop postgresql` (Linux) or stop service
- [ ] Try to start call → expect error
- [ ] Try to access dashboard → expect error
- [ ] Check logs for connection error
- [ ] Restart PostgreSQL
- [ ] Verify system recovers

---

## Cost Tracking

### Per-Call Costs
- [ ] Make 3 test calls
- [ ] Query `call_logs`: `SELECT call_id, stt_cost_usd, llm_cost_usd, tts_cost_usd, total_cost_usd FROM call_logs ORDER BY started_at DESC LIMIT 3;`
- [ ] Verify costs are non-zero and reasonable (e.g., $0.01-$0.50 per call)
- [ ] Verify `total_cost_usd = stt_cost_usd + llm_cost_usd + tts_cost_usd`

### Admin Cost Analytics
- [ ] Access Admin Intelligence page
- [ ] Check "Cost Analytics" section
- [ ] Verify shows real cost data (not mock)
- [ ] Verify cost breakdown by provider (STT, LLM, TTS)
- [ ] Test date range filter

---

## Admin Features

### Agent Management
- [ ] Access Admin Control Panel → Agents page
- [ ] Verify shows all tenants
- [ ] Click "View Details" on tenant
- [ ] Verify tenant config loads

### Onboarding New Agent
- [ ] Start onboarding: `POST /api/onboarding/start`
- [ ] Complete each step (system prompt, knowledge base, telephony)
- [ ] Complete onboarding: `POST /api/onboarding/{session_id}/complete`
- [ ] Verify new tenant created
- [ ] Verify tenant config saved

### User Invitation
- [ ] Invite user: `POST /api/admin/invite-user`
- [ ] Check email (if configured) or database for invitation
- [ ] Accept invitation → set password
- [ ] Login with new user

### Intelligence Dashboard
- [ ] Make 10+ test calls with varied outcomes
- [ ] Access Intelligence page
- [ ] Verify "Outcome Distribution" shows real data
- [ ] Verify "Reason Taxonomy" shows real reasons
- [ ] Verify "Action Required Rate" calculated correctly

### Quality Dashboard
- [ ] Trigger some errors (invalid API keys)
- [ ] Access Quality page
- [ ] Verify shows real errors from `system_errors` table
- [ ] Verify grouped by type and severity
- [ ] Verify error details include stack trace

---

## Customer Dashboard

### Call Logs
- [ ] Login as customer user
- [ ] Access Customer Dashboard
- [ ] Verify shows calls for their tenant only
- [ ] Test filters (date range, status, outcome)
- [ ] Test search (phone number, reason)
- [ ] Verify call details modal loads

### Export
- [ ] Click "Export" button
- [ ] Verify CSV download
- [ ] Verify CSV contains correct data

### Action Items
- [ ] Mark call as "requires action"
- [ ] Verify appears in action items list
- [ ] Resolve action item
- [ ] Verify removed from list

### Archive
- [ ] Archive old call
- [ ] Verify hidden from main list
- [ ] Toggle "Show archived"
- [ ] Verify appears in archived list

---

## Stress & Load Testing

### Adversarial Conversations
- [ ] Run: `python voice-core/tests/manual_stress_test.py`
- [ ] Target: ≥85% pass rate
- [ ] Target: <120s duration
- [ ] Review failed conversations for improvements

### Concurrent Calls
- [ ] Run: `python voice-core/tests/load_test_concurrent_calls.py 10`
- [ ] Target: ≥90% success rate
- [ ] Target: <10s avg duration
- [ ] Monitor CPU and memory during test

### Database Connection Pool
- [ ] Run: `python voice-core/tests/db_connection_test.py`
- [ ] Target: 100% success rate
- [ ] Verify no connection leaks

---

## Production Environment

### SSL/HTTPS
- [ ] Access via HTTPS: `https://yourdomain.com`
- [ ] Verify valid SSL certificate (no warnings)
- [ ] Test all API endpoints via HTTPS
- [ ] Verify WebSocket works over WSS

### CORS
- [ ] Access frontend from production domain
- [ ] Verify API calls work (no CORS errors in console)
- [ ] Try to access from unauthorized domain → expect CORS error

### Rate Limiting
- [ ] Make 100+ rapid requests to same endpoint
- [ ] Verify rate limit kicks in (429 response)
- [ ] Verify `X-RateLimit-*` headers present
- [ ] Wait for reset period, verify access restored

### Error Monitoring
- [ ] Trigger error (e.g., access invalid endpoint)
- [ ] Check Sentry dashboard for captured error
- [ ] Verify error includes context (user, tenant, etc.)

### Health Check
- [ ] Access `/health` endpoint
- [ ] Verify returns 200 OK
- [ ] Verify response time <100ms

---

## Performance Testing

### Response Times
- [ ] Measure `/api/dashboard/calls` response time → target: <500ms
- [ ] Measure `/api/admin/intelligence/outcomes` → target: <1s
- [ ] Measure `/start_call` response time → target: <2s
- [ ] TODO: Optimize agent response latency to <3s first response, <2s turn-taking

### Database Query Performance
- [ ] Run `EXPLAIN ANALYZE` on slow queries
- [ ] Verify indexes used for common filters
- [ ] Check `call_logs` queries use `idx_call_logs_tenant_started`

---

## Pass Criteria

✅ **Authentication**: All auth flows work without errors
✅ **Voice Pipeline**: 10+ successful calls with no crashes
✅ **Error Handling**: Graceful fallback on provider failures
✅ **Cost Tracking**: Costs tracked accurately per call
✅ **Admin Features**: All admin operations work
✅ **Customer Features**: Dashboard loads and filters work
✅ **Stress Tests**: ≥85% pass rate, ≥90% concurrent success
✅ **Production Config**: SSL, CORS, rate limiting, monitoring all work

**When all checked: READY FOR LAUNCH** 🚀
```

---

## 🌟 NICE-TO-HAVE (Day 3)

### Task 5: Session Management Improvements
**Priority**: NICE-TO-HAVE - Enhanced UX  
**Estimated time**: 3 hours  
**Status**: Not started

#### Implementation

**Step 1: Session cleanup cron job**

Create [`voice-core/src/services/session_cleanup.py`](voice-core/src/services/session_cleanup.py):

```python
"""
Background job to clean up expired sessions.
"""
import asyncio
import logging
from datetime import datetime, timezone
from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)


async def cleanup_expired_sessions():
    """Delete expired sessions from database."""
    db_service = get_db_service()
    conn = db_service.get_connection()
    
    try:
        cur = conn.cursor()
        
        # Delete expired sessions
        cur.execute("""
            DELETE FROM sessions
            WHERE expires_at < NOW()
            RETURNING session_id
        """)
        
        deleted_ids = cur.fetchall()
        deleted_count = len(deleted_ids)
        
        conn.commit()
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} expired sessions")
        
        return deleted_count
        
    except Exception as e:
        logger.error(f"Failed to cleanup sessions: {e}")
        conn.rollback()
        return 0
    finally:
        db_service.put_connection(conn)


async def session_cleanup_task():
    """Run cleanup every hour."""
    while True:
        try:
            await cleanup_expired_sessions()
        except Exception as e:
            logger.exception(f"Session cleanup task failed: {e}")
        
        # Wait 1 hour
        await asyncio.sleep(3600)


def start_session_cleanup_task():
    """Start the session cleanup background task."""
    asyncio.create_task(session_cleanup_task())
    logger.info("Session cleanup task started (runs hourly)")
```

Add to [`voice-core/src/bot_runner.py`](voice-core/src/bot_runner.py):

```python
from .services.session_cleanup import start_session_cleanup_task

# Add to app startup
@app.on_event("startup")
async def startup_event():
    logger.info("Voice Core starting up...")
    start_session_cleanup_task()


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Voice Core shutting down...")
    # Cleanup will stop when event loop stops
```

**Step 2: Session refresh endpoint**

Add to [`voice-core/src/api/auth.py`](voice-core/src/api/auth.py):

```python
@router.post("/refresh-session")
async def refresh_session(
    response: Response,
    session: dict = Depends(require_auth)
):
    """
    Refresh session expiration.
    Extends session for another 30 days.
    """
    from ..middleware.auth import get_session_from_token
    
    # Get current session token
    session_token = None
    # Extract from cookie...
    
    if not session_token:
        raise HTTPException(400, "No session to refresh")
    
    db_service = get_db_service()
    conn = db_service.get_connection()
    
    try:
        cur = conn.cursor()
        
        session_hash = hashlib.sha256(session_token.encode()).hexdigest()
        new_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        # Update expiration
        cur.execute("""
            UPDATE sessions
            SET expires_at = %s,
                last_accessed_at = NOW()
            WHERE session_hash = %s
            RETURNING session_id
        """, (new_expires_at, session_hash))
        
        if not cur.fetchone():
            raise HTTPException(404, "Session not found")
        
        conn.commit()
        
        # Update cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            max_age=30 * 24 * 60 * 60,
            httponly=True,
            secure=True,
            samesite="lax"
        )
        
        return {
            "message": "Session refreshed",
            "expires_at": new_expires_at.isoformat()
        }
        
    finally:
        db_service.put_connection(conn)
```

**Step 3: Multi-device session tracking**

Add to [`voice-ai-os/infrastructure/database/migrations/012_session_improvements.sql`](voice-ai-os/infrastructure/database/migrations/012_session_improvements.sql):

```sql
-- Add session tracking improvements
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);

-- Allow multiple sessions per user (remove if exists)
-- Sessions are already unique by session_hash, so this is OK

-- Add index for user's sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_active 
    ON sessions(user_id, expires_at) 
    WHERE expires_at > NOW();

COMMENT ON COLUMN sessions.user_agent IS 'Browser/device user agent string';
COMMENT ON COLUMN sessions.ip_address IS 'IP address when session created';
COMMENT ON COLUMN sessions.device_name IS 'User-friendly device name';
```

Update login to track device info in [`voice-core/src/api/auth.py`](voice-core/src/api/auth.py):

```python
# In login endpoint, when creating session:
user_agent = request.headers.get("User-Agent", "Unknown")
ip_address = request.client.host if request.client else "Unknown"

cur.execute("""
    INSERT INTO sessions (
        user_id, session_hash, expires_at, 
        user_agent, ip_address
    )
    VALUES (%s, %s, %s, %s, %s)
    RETURNING session_id
""", (user_id, session_hash, expires_at, user_agent, ip_address))
```

Add endpoint to list user's active sessions:

```python
@router.get("/sessions")
async def list_sessions(session: dict = Depends(require_auth)):
    """List all active sessions for current user."""
    user_id = session['user_id']
    
    db_service = get_db_service()
    conn = db_service.get_connection()
    
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute("""
            SELECT 
                session_id,
                created_at,
                last_accessed_at,
                expires_at,
                user_agent,
                ip_address
            FROM sessions
            WHERE user_id = %s
              AND expires_at > NOW()
            ORDER BY last_accessed_at DESC
        """, (user_id,))
        
        sessions = cur.fetchall()
        
        return {"sessions": [dict(s) for s in sessions]}
        
    finally:
        db_service.put_connection(conn)


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    session: dict = Depends(require_auth)
):
    """Revoke a specific session (logout from device)."""
    user_id = session['user_id']
    
    db_service = get_db_service()
    conn = db_service.get_connection()
    
    try:
        cur = conn.cursor()
        
        # Only allow user to revoke their own sessions
        cur.execute("""
            DELETE FROM sessions
            WHERE session_id = %s
              AND user_id = %s
            RETURNING session_id
        """, (session_id, user_id))
        
        if not cur.fetchone():
            raise HTTPException(404, "Session not found or access denied")
        
        conn.commit()
        
        return {"message": "Session revoked"}
        
    finally:
        db_service.put_connection(conn)
```

---

### Task 6: Database Schema Reconciliation
**Priority**: NICE-TO-HAVE - Documentation & cleanup  
**Estimated time**: 2 hours  
**Status**: Not started

#### Implementation

**Step 1: Generate current schema**

```bash
cd voice-ai-os/infrastructure/database

# Export current schema
pg_dump -U postgres -d voice_os --schema-only > schema_current.sql

# Compare with schema.sql
diff schema.sql schema_current.sql > schema_diff.txt
```

**Step 2: Update Prisma schema (if used)**

Check if [`apps/web/prisma/schema.prisma`](apps/web/prisma/schema.prisma) exists and update it:

```prisma
// Add new models

model Session {
  sessionId      String    @id @default(uuid()) @map("session_id")
  userId         String    @map("user_id")
  sessionHash    String    @unique @map("session_hash") @db.VarChar(64)
  expiresAt      DateTime  @map("expires_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  lastAccessedAt DateTime  @default(now()) @map("last_accessed_at")
  userAgent      String?   @map("user_agent")
  ipAddress      String?   @map("ip_address") @db.VarChar(45)
  
  user User @relation(fields: [userId], references: [userId], onDelete: Cascade)
  
  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

model CallLog {
  callLogId         String    @id @default(uuid()) @map("call_log_id")
  callId            String    @unique @map("call_id")
  callSid           String?   @map("call_sid")
  tenantId          String    @map("tenant_id")
  conversationId    String?   @map("conversation_id")
  
  callerPhone       String?   @map("caller_phone") @db.VarChar(30)
  direction         String?   @default("inbound") @db.VarChar(20)
  status            String?   @db.VarChar(50)
  
  startedAt         DateTime? @map("started_at")
  endedAt           DateTime? @map("ended_at")
  durationSeconds   Int?      @map("duration_seconds")
  
  transcript        String?
  summary           String?
  
  reasonForCalling  String?   @map("reason_for_calling") @db.VarChar(255)
  outcome           String?   @db.VarChar(255)
  capturedData      Json?     @map("captured_data")
  
  requiresAction    Boolean   @default(false) @map("requires_action")
  priority          String?   @db.VarChar(20)
  resolvedAt        DateTime? @map("resolved_at")
  archivedAt        DateTime? @map("archived_at")
  
  sttCostUsd        Decimal?  @map("stt_cost_usd") @db.Decimal(10, 6)
  llmCostUsd        Decimal?  @map("llm_cost_usd") @db.Decimal(10, 6)
  ttsCostUsd        Decimal?  @map("tts_cost_usd") @db.Decimal(10, 6)
  totalCostUsd      Decimal?  @map("total_cost_usd") @db.Decimal(10, 6)
  
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @default(now()) @map("updated_at")
  
  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  
  @@index([tenantId])
  @@index([tenantId, startedAt])
  @@index([callSid])
  @@index([status])
  @@index([tenantId, requiresAction])
  @@map("call_logs")
}

model SystemError {
  errorId      String    @id @default(uuid()) @map("error_id")
  tenantId     String?   @map("tenant_id")
  callId       String?   @map("call_id")
  errorType    String?   @map("error_type") @db.VarChar(100)
  errorMessage String?   @map("error_message")
  stackTrace   String?   @map("stack_trace")
  severity     String?   @db.VarChar(20)
  context      Json?
  resolved     Boolean   @default(false)
  createdAt    DateTime  @default(now()) @map("created_at")
  
  @@index([tenantId])
  @@index([severity])
  @@index([resolved])
  @@map("system_errors")
}
```

**Step 3: Document schema**

Create [`voice-ai-os/infrastructure/database/SCHEMA.md`](voice-ai-os/infrastructure/database/SCHEMA.md):

```markdown
# Database Schema Documentation

## Core Tables

### users
User accounts with authentication.

**Key fields:**
- `user_id`: UUID primary key
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `role`: 'admin' or 'customer'
- `tenant_id`: Links to tenant
- `is_active`: Account status
- `last_login_at`: Last login timestamp

### sessions
Active user sessions for authentication.

**Key fields:**
- `session_id`: UUID primary key
- `user_id`: References users.user_id
- `session_hash`: SHA-256 hash of session token
- `expires_at`: Expiration timestamp
- `last_accessed_at`: Last activity timestamp

**Indexes:**
- `idx_sessions_session_hash`: Fast lookup by hash
- `idx_sessions_user_id`: Find user's sessions

### tenants
Customer organizations (agents).

**Key fields:**
- `tenant_id`: UUID primary key
- `tenant_name`: Organization name
- `industry`: Industry category
- `config`: JSONB configuration
- `is_active`: Account status

### call_logs
Comprehensive call history and analytics.

**Key fields:**
- `call_log_id`: UUID primary key
- `call_id`: Unique call identifier
- `tenant_id`: References tenants.tenant_id
- `status`: Call status (active, completed, failed)
- `transcript`: Full conversation text
- `summary`: AI-generated summary
- `outcome`: Call outcome category
- `captured_data`: JSONB structured data
- `*_cost_usd`: Cost tracking (STT, LLM, TTS)

**Indexes:**
- `idx_call_logs_tenant_started`: Tenant call history
- `idx_call_logs_requires_action`: Action items
- `idx_call_logs_caller_phone`: Caller lookup

### system_errors
Structured error logging for monitoring.

**Key fields:**
- `error_id`: UUID primary key
- `error_type`: Error category
- `error_message`: Error description
- `stack_trace`: Full stack trace
- `severity`: ERROR, CRITICAL, WARNING
- `context`: JSONB additional context
- `resolved`: Resolution status

## Relationships

```
users ──┐
        ├─── sessions
        │
tenants ──┬─── call_logs
          ├─── knowledge_bases
          ├─── dashboard_options
          └─── system_errors (optional FK)
```

## Migration History

1. `001_initial_schema.sql` - Base schema
2. `002_add_user_authentication.sql` - Auth system
3. `003_add_dashboard_options.sql` - Dashboard config
4. `004_add_calendar_integration.sql` - Calendar
5. `005_add_phone_routing.sql` - Phone routing
6. `006_add_multi_knowledge_bases.sql` - Knowledge bases
7. `007_fix_onboarding_foreign_key.sql` - FK fix
8. `008_add_call_history.sql` - Call history
9. `009_add_sessions_table.sql` - Session management
10. `010_add_call_logs.sql` - Call logs
11. `011_add_system_errors.sql` - Error logging
12. `012_session_improvements.sql` - Multi-device sessions

## Maintenance

### Cleanup Tasks
- Expired sessions: Cleaned hourly by background task
- Old call logs: Archive after 90 days
- Resolved errors: Archive after 30 days

### Performance
- Indexes created for all common query patterns
- JSONB used for flexible schema fields
- Connection pooling (5-20 connections)
```

---

## 📋 FINAL LAUNCH CHECKLIST

### Pre-Launch (Day Before)

#### Code Complete
- [ ] All critical tasks implemented (error fallback, stress tests, production setup)
- [ ] All nice-to-have tasks completed (optional)
- [ ] Code reviewed and tested
- [ ] No critical linter errors

#### Database
- [ ] All migrations applied: `python infrastructure/database/migrate.py`
- [ ] Verify migrations: `SELECT * FROM schema_migrations ORDER BY applied_at;`
- [ ] Database backup configured
- [ ] Connection pool tested (no leaks)

#### Environment
- [ ] `.env.production` configured with real values
- [ ] SSL certificates installed and valid
- [ ] Domain DNS configured and propagated
- [ ] CORS origins set to production domains
- [ ] Rate limiting configured
- [ ] Sentry project created and DSN configured

#### Testing
- [ ] Integration test checklist 100% complete
- [ ] Stress test passed (≥85% pass rate)
- [ ] Load test passed (≥90% success with 10+ concurrent)
- [ ] Error scenarios tested (LLM, TTS failures)
- [ ] End-to-end call flow tested (10+ successful calls)

### Launch Day

#### Deployment
- [ ] Deploy backend: `./run_production.sh`
- [ ] Deploy frontend: `npm run build && npm run start`
- [ ] Verify health checks: `curl https://yourdomain.com/health`
- [ ] Test one complete call end-to-end
- [ ] Verify WebSocket connection works

#### Monitoring
- [ ] Check Sentry for any startup errors
- [ ] Monitor logs for warnings/errors
- [ ] Check database connection count
- [ ] Verify SSL certificate valid

### Post-Launch (First 24 Hours)

#### Monitoring
- [ ] Error rate <1%
- [ ] Response times <500ms (95th percentile)
- [ ] Call success rate >95%
- [ ] Database performance normal
- [ ] No memory leaks
- [ ] Cost burn rate within expected range

#### Validation
- [ ] 10+ production calls completed successfully
- [ ] Admin dashboard accessible and showing real data
- [ ] Customer dashboard accessible
- [ ] Email delivery working (invitations, notifications)
- [ ] Twilio webhooks delivering successfully

---

## 🎯 SUCCESS METRICS

**Minimum Viable Launch:**
- ✅ Authentication works (login, logout, sessions)
- ✅ Calls complete successfully (>90% success rate)
- ✅ Error fallback messages play to callers
- ✅ Cost tracking accurate
- ✅ Admin features operational
- ✅ Production environment secured (SSL, CORS, rate limiting)

**Excellent Launch:**
- ✅ Above + stress tests passed
- ✅ Above + integration tests 100% pass
- ✅ Above + nice-to-have features
- ✅ Above + monitoring/alerting configured
- ✅ Above + documentation complete

---

## 📞 EMERGENCY CONTACTS & ROLLBACK

### Rollback Plan

If critical issues arise:

1. **Quick fix possible** (< 15 minutes):
   - Apply hotfix
   - Restart services
   - Monitor for 30 minutes

2. **Complex issue** (> 15 minutes):
   - Rollback to previous version
   - Restore database backup if needed
   - Investigate in staging environment

### Rollback Commands

```bash
# Stop services
sudo systemctl stop voice-core
sudo systemctl stop frontend

# Restore database backup
psql -U postgres voice_os < backup_pre_launch.sql

# Deploy previous version
git checkout <previous-tag>
./run_production.sh

# Verify
curl https://yourdomain.com/health
```

---

## 📝 NOTES FOR CODEX

**Task Execution Order:**

1. **Day 1 Morning**: Task 1 (Error Fallback) - 3 hours
2. **Day 1 Afternoon**: Task 3 (Production Setup) - 6 hours
3. **Day 2 Morning**: Task 2 (Stress Testing) - 6 hours
4. **Day 2 Afternoon**: Task 4 (Integration Testing) - 4 hours
5. **Day 3** (optional): Tasks 5-6 (Nice-to-haves) - 5 hours

**Priority if time-constrained:**

1. ✅ Error fallback messages (CRITICAL - UX)
2. ✅ Production environment setup (CRITICAL - Security)
3. ✅ Basic stress testing (CRITICAL - Stability)
4. ✅ Integration testing checklist (CRITICAL - Verification)
5. ⭐ Session management (nice)
6. ⭐ Schema docs (nice)

**Key Principles:**

- Test thoroughly before marking complete
- Document any deviations from plan
- If tests fail, fix and re-test
- Don't skip error handling tests
- Verify in production environment, not just dev

**When Ready:**

✅ All critical tasks complete  
✅ All tests passing  
✅ Integration checklist done  
✅ Production environment configured  

**→ READY FOR LAUNCH** 🚀

Good luck with the launch!
