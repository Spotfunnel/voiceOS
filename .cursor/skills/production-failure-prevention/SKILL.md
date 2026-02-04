# Production Failure Prevention Skill

Prevents the most common production failures observed in real Voice AI platforms (Vapi, Retell, Voiceflow, LiveKit) handling millions of calls. Based on 2024-2026 incident data, user complaints, and production outages.

## Why This Skill Matters

- **50% of incidents**: Telephony/Audio layer (not LLM/application logic)
- **Cascading failures**: Downstream service outages (STT, TTS, object storage) crash entire platform
- **Audio encoding mismatches**: 100% failure rate when Twilio mulaw 8kHz ≠ platform PCM 16kHz
- **Worker blocking**: I/O operations (recording uploads) block call workers, causing unavailability

## Critical Failure Modes to Prevent

### 1. Worker Blocking on I/O Operations

**What breaks**: Call workers blocked uploading recordings to object storage during downstream outages

**Real incident**: Vapi December 2025 - workers unavailable for 2+ hours when object storage failed

**Why it breaks**:
- Workers synchronously upload recordings after each call
- When object storage is slow/down, workers block waiting
- Blocked workers can't handle new calls → cascading failure

**How to prevent**:

```python
# ❌ WRONG: Synchronous recording upload blocks worker
async def end_call(call_id: str):
    recording = await get_recording(call_id)
    
    # Blocks worker until upload completes (could be minutes if storage is slow)
    await object_storage.upload(recording)  # BLOCKS WORKER
    
    return {"status": "completed"}

# ✅ CORRECT: Async background upload (non-blocking)
async def end_call(call_id: str):
    recording = await get_recording(call_id)
    
    # Queue for background processing (worker continues immediately)
    await recording_queue.enqueue({
        "call_id": call_id,
        "recording_url": recording.url,
        "priority": "low"  # Non-critical operation
    })
    
    # Worker available immediately for next call
    return {"status": "completed"}

# Background worker handles uploads separately
async def recording_upload_worker():
    while True:
        job = await recording_queue.dequeue()
        
        try:
            # Upload with retry + circuit breaker
            await upload_with_retry(job["recording_url"])
        except Exception as e:
            # Log failure, don't crash worker
            logger.error(f"Recording upload failed: {e}")
            await recording_queue.enqueue(job)  # Retry later
```

**Engineering Rule**: Never block call workers on non-critical I/O (recordings, logs, analytics)

---

### 2. Audio Encoding Mismatches (Telephony Integration)

**What breaks**: Garbled audio when platform encoding ≠ telephony provider encoding

**Real incident**: Retell + Twilio integration - mulaw 8kHz (Twilio) vs PCM 16kHz (Retell default)

**Why it breaks**:
- Twilio requires mulaw 8kHz for PSTN calls
- Most platforms default to PCM 16kHz (WebRTC standard)
- Encoding mismatch causes garbled audio, dropped packets

**How to prevent**:

```python
# ✅ CORRECT: Auto-detect telephony provider and set encoding
def configure_audio_encoding(telephony_provider: str, transport_type: str):
    """Configure audio encoding based on provider and transport"""
    
    if telephony_provider == "twilio" and transport_type == "pstn":
        # Twilio PSTN requires mulaw 8kHz
        return {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1
        }
    elif telephony_provider == "twilio" and transport_type == "webrtc":
        # Twilio WebRTC supports PCM 16kHz
        return {
            "encoding": "pcm",
            "sample_rate": 16000,
            "channels": 1
        }
    elif telephony_provider == "daily":
        # Daily.co always uses PCM 16kHz
        return {
            "encoding": "pcm",
            "sample_rate": 16000,
            "channels": 1
        }
    else:
        raise ValueError(f"Unknown provider: {telephony_provider}")

# Validate encoding compatibility before call starts
def validate_audio_pipeline(config: dict):
    """Ensure all components use compatible encoding"""
    
    telephony_encoding = config["telephony"]["encoding"]
    stt_encoding = config["stt"]["encoding"]
    tts_encoding = config["tts"]["encoding"]
    
    # All must match
    if not (telephony_encoding == stt_encoding == tts_encoding):
        raise AudioEncodingMismatchError(
            f"Encoding mismatch: telephony={telephony_encoding}, "
            f"stt={stt_encoding}, tts={tts_encoding}"
        )

# ❌ WRONG: Hardcoded encoding (breaks with some providers)
audio_config = {
    "encoding": "pcm",  # Breaks with Twilio PSTN
    "sample_rate": 16000
}
```

**Engineering Rule**: Validate audio encoding compatibility during onboarding, not in production

---

### 3. Workflow Blocking Conversation (3-Second Silences)

**What breaks**: Conversation freezes while waiting for workflow API responses

**Real incident**: Voiceflow "async steps that wait for long-running actions" cause 3-second silences

**Why it breaks**:
- Workflow API calls (CRM update, calendar booking) take 1-3 seconds
- Conversation waits synchronously for response
- User experiences awkward silence → feels broken

**How to prevent**:

```python
# ❌ WRONG: Conversation waits for workflow
async def capture_email_and_update_crm(email: str):
    # Capture email (fast)
    email = await capture_email()
    
    # Wait for CRM update (1-3 seconds) - USER HEARS SILENCE
    crm_response = await crm_api.update_contact(email)  # BLOCKS
    
    if crm_response.success:
        await say("Your details have been saved")
    else:
        await say("Sorry, there was an error")

# ✅ CORRECT: Fire-and-forget workflow (conversation continues)
async def capture_email_and_trigger_workflow(email: str):
    # Capture email (fast)
    email = await capture_email()
    
    # Emit event (non-blocking, <5ms)
    await event_bus.emit("objective_completed", {
        "objective_id": "capture_email",
        "data": {"email": email}
    })
    
    # Continue conversation immediately (no silence)
    await say("Thanks! We'll send you a confirmation email shortly.")
    
    # Workflow triggered asynchronously (user never waits)
    # If workflow fails, user never knows (conversation succeeded)
```

**Engineering Rule**: Layer 3 workflows MUST be async, never block conversation

---

### 4. Circuit Breakers for Downstream Services

**What breaks**: STT/TTS provider outages cause entire platform to fail

**Real incident**: Vapi January 2026 - Google Gemini rate limiting caused platform-wide downtime

**Why it breaks**:
- Platform depends on third-party services (Deepgram, ElevenLabs, OpenAI)
- When provider is down/rate-limited, all calls fail
- No fallback → 100% failure rate

**How to prevent**:

```python
# ✅ CORRECT: Circuit breaker with fallback providers
from circuitbreaker import circuit

class MultiProviderSTT:
    def __init__(self):
        self.providers = [
            DeepgramSTT(),      # Primary
            AssemblyAISTT(),    # Fallback 1
            WhisperSTT()        # Fallback 2 (local)
        ]
    
    @circuit(failure_threshold=5, recovery_timeout=60)
    async def transcribe_with_primary(self, audio: bytes) -> str:
        """Primary provider with circuit breaker"""
        return await self.providers[0].transcribe(audio)
    
    async def transcribe(self, audio: bytes) -> str:
        """Try primary, fallback on failure"""
        
        try:
            # Try primary (Deepgram)
            return await self.transcribe_with_primary(audio)
        except CircuitBreakerOpen:
            # Circuit open, skip primary
            logger.warning("Primary STT circuit open, using fallback")
        except Exception as e:
            logger.error(f"Primary STT failed: {e}")
        
        # Try fallback 1 (AssemblyAI)
        try:
            return await self.providers[1].transcribe(audio)
        except Exception as e:
            logger.error(f"Fallback 1 STT failed: {e}")
        
        # Try fallback 2 (Whisper local)
        try:
            return await self.providers[2].transcribe(audio)
        except Exception as e:
            logger.error(f"Fallback 2 STT failed: {e}")
            raise AllSTTProvidersFailed()

# ❌ WRONG: Single provider, no fallback
async def transcribe(audio: bytes) -> str:
    return await deepgram.transcribe(audio)  # 100% failure if Deepgram down
```

**Engineering Rule**: All critical external services MUST have fallback providers + circuit breakers

---

### 5. Memory Threshold Monitoring (Worker Crashes)

**What breaks**: Workers crash when memory usage exceeds threshold

**Real incident**: Vapi March 2025 - "vapifault-transport-never-connected" errors due to memory threshold issues

**Why it breaks**:
- Audio buffers accumulate in memory during long calls
- Workers don't release memory after call ends
- Memory usage grows until threshold → crash

**How to prevent**:

```python
# ✅ CORRECT: Memory monitoring with auto-scaling
import psutil

class WorkerHealthMonitor:
    def __init__(self, memory_threshold_percent: float = 80.0):
        self.memory_threshold = memory_threshold_percent
        
    async def monitor_loop(self):
        """Monitor worker health every 10 seconds"""
        while True:
            await asyncio.sleep(10)
            
            # Check memory usage
            memory_percent = psutil.virtual_memory().percent
            
            if memory_percent > self.memory_threshold:
                logger.warning(f"Memory usage high: {memory_percent}%")
                
                # Trigger graceful shutdown (stop accepting new calls)
                await self.graceful_shutdown()
                
                # Alert ops team
                await alert_ops(f"Worker memory critical: {memory_percent}%")
    
    async def graceful_shutdown(self):
        """Stop accepting new calls, finish existing calls"""
        
        # Mark worker as unhealthy (load balancer stops routing)
        self.health_status = "draining"
        
        # Wait for existing calls to complete (max 30 minutes)
        await self.wait_for_calls_to_complete(timeout=1800)
        
        # Exit process (orchestrator will restart)
        sys.exit(0)

# Release memory after each call
async def handle_call(call_id: str):
    audio_buffer = []
    
    try:
        # Process call
        async for audio_chunk in call_stream:
            audio_buffer.append(audio_chunk)
            await process_audio(audio_chunk)
    finally:
        # CRITICAL: Release memory explicitly
        audio_buffer.clear()
        del audio_buffer
        
        # Force garbage collection for large objects
        import gc
        gc.collect()

# ❌ WRONG: No memory monitoring, no cleanup
async def handle_call(call_id: str):
    audio_buffer = []  # Accumulates forever
    async for audio_chunk in call_stream:
        audio_buffer.append(audio_chunk)  # Memory leak
```

**Engineering Rule**: Monitor worker memory usage, implement graceful shutdown at 80% threshold

---

### 6. Speculative Execution for Tool Calls (Latency Hiding)

**What breaks**: Tool calls (CRM lookup, calendar check) add 1.5-2 seconds latency

**Production pattern**: LiveKit agents use speculative execution to hide latency

**How it works**:
- Run 2 parallel tracks: **filler track** (agent speaks) + **speculation track** (tool call executes)
- If tool returns before filler completes, use tool result
- If filler completes first, continue conversation (tool result ignored)

**How to implement**:

```python
# ✅ CORRECT: Speculative execution hides tool call latency
async def handle_user_request_with_speculation(user_input: str):
    """Run filler + tool call in parallel"""
    
    # Detect if tool call needed
    if requires_tool_call(user_input):
        # Start both tracks in parallel
        filler_task = asyncio.create_task(speak_filler())
        tool_task = asyncio.create_task(execute_tool_call(user_input))
        
        # Wait for first to complete
        done, pending = await asyncio.wait(
            [filler_task, tool_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        if tool_task in done:
            # Tool returned first, use result
            tool_result = tool_task.result()
            
            # Cancel filler if still speaking
            filler_task.cancel()
            
            # Speak tool result
            await speak(f"I found that {tool_result}")
        else:
            # Filler completed first, continue conversation
            # Tool result will be ignored (or used in next turn)
            await speak("Let me check on that for you...")
    else:
        # No tool call needed, respond normally
        await speak(generate_response(user_input))

async def speak_filler():
    """Speak filler while tool executes"""
    await say("Let me check that for you...")
    await asyncio.sleep(1.5)  # Typical filler duration

async def execute_tool_call(user_input: str):
    """Execute tool call (CRM lookup, calendar check)"""
    return await crm_api.lookup_customer(user_input)

# ❌ WRONG: Sequential (user waits 1.5-2 seconds)
async def handle_user_request_sequential(user_input: str):
    if requires_tool_call(user_input):
        tool_result = await execute_tool_call(user_input)  # Wait 1.5-2s
        await speak(f"I found that {tool_result}")
```

**Engineering Rule**: Use speculative execution for tool calls >500ms to hide latency

---

## 4-Stack Incident Response

**Finding**: 50% of voice AI incidents are in Telephony/Audio layer (not LLM)

**Why it matters**: Teams waste time debugging wrong layer (4x slower resolution)

**4-Stack Structure**:

1. **Telephony/Audio Stack** (50% of incidents)
   - Symptoms: Garbled audio, dropped calls, one-way audio, echo
   - Debug: Check encoding (mulaw vs PCM), sample rate (8kHz vs 16kHz), network latency
   - Team: Infrastructure/DevOps

2. **Voice Core Stack** (30% of incidents)
   - Symptoms: High latency (>1s), interruptions, missed speech, wrong transcripts
   - Debug: Check STT/TTS providers, VAD thresholds, barge-in logic
   - Team: Voice AI engineers

3. **Orchestration Stack** (15% of incidents)
   - Symptoms: Wrong objective sequence, skipped confirmations, incorrect state
   - Debug: Check objective graph, event stream, state transitions
   - Team: Backend engineers

4. **Workflow Stack** (5% of incidents)
   - Symptoms: CRM not updated, calendar not booked, email not sent
   - Debug: Check workflow logs, API responses, event triggers
   - Team: Integration engineers

**Incident Response Process**:

```python
# ✅ CORRECT: Structured incident response by layer
def debug_incident(incident_report: dict):
    """Route incident to correct team based on symptoms"""
    
    symptoms = incident_report["symptoms"]
    
    # Layer 1: Telephony/Audio (50% of incidents)
    if any(s in symptoms for s in ["garbled audio", "dropped call", "one-way audio", "echo"]):
        return {
            "layer": "telephony",
            "team": "infrastructure",
            "debug_steps": [
                "Check audio encoding (mulaw vs PCM)",
                "Verify sample rate (8kHz vs 16kHz)",
                "Test network latency (ping, traceroute)",
                "Review Twilio/Daily.co logs"
            ]
        }
    
    # Layer 2: Voice Core (30% of incidents)
    elif any(s in symptoms for s in ["high latency", "interruptions", "missed speech", "wrong transcript"]):
        return {
            "layer": "voice_core",
            "team": "voice_ai_engineers",
            "debug_steps": [
                "Check STT/TTS provider status",
                "Review VAD threshold settings",
                "Test barge-in logic",
                "Replay conversation from event stream"
            ]
        }
    
    # Layer 3: Orchestration (15% of incidents)
    elif any(s in symptoms for s in ["wrong sequence", "skipped confirmation", "incorrect state"]):
        return {
            "layer": "orchestration",
            "team": "backend_engineers",
            "debug_steps": [
                "Review objective graph configuration",
                "Replay event stream for state transitions",
                "Check objective completion conditions"
            ]
        }
    
    # Layer 4: Workflow (5% of incidents)
    else:
        return {
            "layer": "workflow",
            "team": "integration_engineers",
            "debug_steps": [
                "Check workflow logs (n8n)",
                "Review API responses (CRM, calendar)",
                "Verify event triggers fired"
            ]
        }
```

---

## Production Metrics to Track

Based on real incident data, track these metrics:

### Worker Health
- **Memory usage**: Alert at 80%, graceful shutdown at 85%
- **CPU usage**: Alert at 70%, scale at 80%
- **Active calls per worker**: Alert at 80% capacity

### Audio Quality
- **Encoding compatibility**: 100% (validate before call starts)
- **Packet loss**: <1% (alert at 2%)
- **Jitter**: <30ms (alert at 50ms)

### Provider Health
- **STT provider latency**: P95 <150ms (alert at 300ms)
- **TTS provider latency**: P95 <150ms (alert at 300ms)
- **Circuit breaker trips**: <5 per hour (alert at 10)

### Workflow Isolation
- **Workflow latency**: Track but don't block conversation
- **Workflow failure rate**: <5% (alert at 10%)
- **Event emission latency**: P95 <10ms (alert at 50ms)

---

## Critical Rules (Non-Negotiable)

1. ✅ **Never block call workers on non-critical I/O** (recordings, logs, analytics)
2. ✅ **Validate audio encoding compatibility during onboarding** (not in production)
3. ✅ **Layer 3 workflows MUST be async** (never block conversation)
4. ✅ **All critical external services MUST have fallback providers** (circuit breakers)
5. ✅ **Monitor worker memory usage** (graceful shutdown at 80% threshold)
6. ✅ **Use speculative execution for tool calls >500ms** (hide latency)
7. ✅ **Structure incident response by 4-stack** (Telephony, Voice Core, Orchestration, Workflow)

## References

- Research: `research/23-production-platform-insights.md`
- Vapi incidents: Worker blocking, memory thresholds
- Retell incidents: Audio encoding mismatches
- Voiceflow incidents: Workflow blocking conversation
- LiveKit patterns: Speculative execution
