# Production Observability & Event-Driven Architecture

Enables 4x faster incident resolution (30-60 min vs 2-4 hours) and prevents "can't reproduce" debugging sessions. Logs alone cannot debug distributed voice AI systems—they lack correlation, ordering guarantees, and replay capability.

## Why This Skill Matters

- **Incident resolution**: 4x faster (30-60 min vs 2-4 hours)
- **Replay capability**: Every conversation can be replayed deterministically
- **Root cause analysis**: Correlation across STT, LLM, TTS, workflows
- **Compliance**: GDPR, HIPAA, TCPA require PII sanitization

## Event Spine Architecture

### What is Event Spine?

**Event Spine**: Append-only log of all significant events in a conversation

**Not just logs**: Structured events with schemas, correlation IDs, sequence numbers

**Benefits**:
- Conversation replay (deterministic debugging)
- Root cause analysis (correlate events across components)
- Dashboards (real-time metrics)
- Workflow triggers (fire-and-forget)

### Event Structure

```python
# ✅ CORRECT: Structured event
{
    "event_id": "uuid-v4",  # Unique event identifier
    "event_type": "user_spoke",  # Typed event (not free-form)
    "trace_id": "uuid-v4",  # Correlation ID (same for entire conversation)
    "sequence_number": 42,  # Monotonically increasing within conversation
    "timestamp": "2026-02-03T10:23:45.123Z",  # ISO 8601
    "payload": {
        "transcript": "What's your email?",
        "confidence": 0.85,
        "asr_system": "deepgram"
    },
    "metadata": {
        "component": "stt",
        "agent_version": "v1.2.3",
        "tenant_id": "acme_plumbing"
    }
}

# ❌ INCORRECT: Unstructured log
logger.info(f"User said: {transcript} (confidence: {confidence})")  # Can't replay
```

### Event Types to Emit

**Telephony Events**:
- `call_started`
- `call_ended`
- `call_transferred`

**ASR Events**:
- `user_spoke` (partial + final transcripts)
- `asr_confidence_low` (trigger re-elicitation)
- `multi_asr_voted` (when using multi-ASR)

**LLM Events**:
- `llm_request_sent`
- `llm_first_token` (TTFT metric)
- `llm_completion`

**Objective Events**:
- `objective_started`
- `objective_eliciting`
- `objective_captured`
- `objective_confirming`
- `objective_completed`
- `objective_failed`

**Workflow Events**:
- `workflow_triggered`
- `workflow_completed`
- `workflow_failed`

## Correlation IDs (Trace IDs)

### Why Correlation IDs Matter

**Problem**: Distributed system (STT, LLM, TTS, workflows) - how to correlate events?

**Solution**: Propagate `trace_id` through all components

**Benefit**: Can query "all events for this conversation"

### Generating Trace IDs

```python
# ✅ CORRECT: Generate trace_id at call start
def start_call():
    trace_id = str(uuid.uuid4())  # Generate once
    
    # Store in call context
    call_context = {
        "trace_id": trace_id,
        "call_id": call_id,
        "tenant_id": tenant_id
    }
    
    # Emit first event
    emit_event("call_started", trace_id=trace_id, payload={
        "phone_number": caller_number,
        "tenant_id": tenant_id
    })
    
    return trace_id

# ❌ INCORRECT: No trace_id
def start_call():
    logger.info("Call started")  # Can't correlate with other events
```

### Propagating Trace IDs

**HTTP Headers** (W3C TraceContext standard):
```python
# ✅ CORRECT: Propagate via HTTP headers
def call_stt(audio: bytes, trace_id: str):
    headers = {
        "traceparent": f"00-{trace_id}-{span_id}-01",  # W3C standard
        "trace_id": trace_id  # Custom header (fallback)
    }
    return stt_api.transcribe(audio, headers=headers)
```

**Internal Function Calls**:
```python
# ✅ CORRECT: Pass trace_id explicitly
async def process_turn(audio, trace_id: str):
    transcript = await stt.transcribe(audio, trace_id=trace_id)
    response = await llm.generate(transcript, trace_id=trace_id)
    await tts.speak(response, trace_id=trace_id)

# ❌ INCORRECT: No trace_id propagation
async def process_turn(audio):
    transcript = await stt.transcribe(audio)  # Lost correlation
    response = await llm.generate(transcript)  # Can't correlate with STT
```

## Sequence Numbers for Ordering

### Why Sequence Numbers Matter

**Problem**: Timestamps subject to clock skew between services

**Solution**: Monotonically increasing sequence number within conversation

**Benefit**: Correct replay ordering even with clock skew

```python
# ✅ CORRECT: Use sequence numbers for ordering
class EventEmitter:
    def __init__(self, trace_id: str):
        self.trace_id = trace_id
        self.sequence = 0  # Start at 0
        
    def emit(self, event_type: str, payload: dict):
        self.sequence += 1  # Increment for each event
        
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "trace_id": self.trace_id,
            "sequence_number": self.sequence,  # Monotonic ordering
            "timestamp": datetime.utcnow().isoformat(),
            "payload": payload
        }
        
        event_store.append(event)

# Replay using sequence number (not timestamp)
events = event_store.get_by_trace_id(trace_id)
events.sort(key=lambda e: e["sequence_number"])  # Correct ordering

# ❌ INCORRECT: Relying on timestamps only
events.sort(key=lambda e: e["timestamp"])  # Clock skew breaks ordering
```

## Async Event Emission (<5% Latency Overhead)

### Why Async Matters

**Problem**: Synchronous event emission blocks critical path (STT, LLM, TTS)

**Target**: <5% latency overhead from observability

**Solution**: Async emission with in-memory buffer

```python
# ✅ CORRECT: Async event emission
class AsyncEventEmitter:
    def __init__(self):
        self.buffer = []
        self.lock = asyncio.Lock()
        
        # Background task flushes every 100ms or 100 events
        asyncio.create_task(self.flush_periodically())
        
    async def emit(self, event: dict):
        # Non-blocking append to buffer
        async with self.lock:
            self.buffer.append(event)
        
        # If buffer full, flush immediately
        if len(self.buffer) >= 100:
            await self.flush()
    
    async def flush(self):
        async with self.lock:
            if not self.buffer:
                return
            
            # Batch write to database
            events_to_write = self.buffer.copy()
            self.buffer.clear()
        
        # Write in background (doesn't block caller)
        await event_store.batch_insert(events_to_write)
    
    async def flush_periodically(self):
        while True:
            await asyncio.sleep(0.1)  # 100ms
            await self.flush()

# ❌ INCORRECT: Synchronous emission
def emit_event_sync(event):
    event_store.insert(event)  # Blocks for 10-50ms (breaks latency target)
```

## PII Sanitization

### Why PII Sanitization Matters

**Compliance**: GDPR, HIPAA, TCPA require PII not stored in plain text

**PII Types**:
- Names
- Phone numbers
- Email addresses
- Addresses
- Credit card numbers
- SSN, driver's license

**Solution**: Replace with tokens before storage

```python
# ✅ CORRECT: PII sanitization
import re

def sanitize_pii(text: str) -> str:
    # Email
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '<EMAIL>', text)
    
    # Phone (Australian format)
    text = re.sub(r'\b04\d{8}\b', '<PHONE>', text)
    text = re.sub(r'\b(02|03|07|08)\d{8}\b', '<PHONE>', text)
    
    # Credit card (basic pattern)
    text = re.sub(r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b', '<CARD>', text)
    
    # Names (use NER model for better accuracy)
    entities = ner_model.extract(text)
    for entity in entities:
        if entity.type == "PERSON":
            text = text.replace(entity.text, '<NAME>')
    
    return text

# Emit sanitized events
def emit_event(event_type, payload, trace_id):
    event = {
        "event_type": event_type,
        "trace_id": trace_id,
        "payload": sanitize_pii(json.dumps(payload)),  # Sanitize before storage
        # ...
    }
    event_emitter.emit(event)

# ❌ INCORRECT: Storing PII in plain text
def emit_event(event_type, payload, trace_id):
    event = {
        "payload": payload  # Contains PII: jane@example.com, 0412 345 678
    }
    event_store.insert(event)  # GDPR/HIPAA violation
```

### PII Mapping for Debugging

**Problem**: Need to debug with real data (authorized access only)

**Solution**: Store mapping in encrypted database

```python
# ✅ CORRECT: PII mapping for authorized debugging
def store_pii_mapping(original: str, token: str, trace_id: str):
    # Store encrypted mapping (authorized access only)
    encrypted_mapping = encrypt({
        "token": token,
        "original": original,
        "trace_id": trace_id,
        "created_at": datetime.utcnow()
    })
    
    pii_mapping_store.insert(encrypted_mapping)

# Authorized debugging (operator only)
def get_original_pii(token: str, trace_id: str, operator_id: str) -> str:
    # Check authorization
    if not is_authorized(operator_id):
        raise UnauthorizedError()
    
    # Retrieve and decrypt
    mapping = pii_mapping_store.get(token, trace_id)
    return decrypt(mapping["original"])
```

## Conversation Replay

### How Replay Works

1. **Retrieve all events** for `trace_id`
2. **Sort by sequence number** (not timestamp)
3. **Replay events** in order (dry-run mode, no side effects)
4. **Verify final state** matches production

```python
# ✅ CORRECT: Conversation replay
async def replay_conversation(trace_id: str, dry_run: bool = True):
    # Retrieve all events
    events = await event_store.get_by_trace_id(trace_id)
    
    # Sort by sequence number (not timestamp)
    events.sort(key=lambda e: e["sequence_number"])
    
    # Initialize replay state
    replay_state = ConversationState()
    
    # Replay each event
    for event in events:
        if event["event_type"] == "user_spoke":
            replay_state.add_user_turn(event["payload"]["transcript"])
            
        elif event["event_type"] == "objective_started":
            replay_state.start_objective(event["payload"]["objective_id"])
            
        elif event["event_type"] == "objective_completed":
            replay_state.complete_objective(event["payload"]["objective_id"], event["payload"]["data"])
        
        # ... handle other event types
    
    # Verify final state
    if not dry_run:
        assert replay_state == production_state, "Replay diverged from production"
    
    return replay_state
```

## Critical Rules (Non-Negotiable)

1. ✅ **All components MUST emit structured events with trace_id**
   - Not just logs (logs can't be replayed)
   - Structured schema (typed event_type, versioned)

2. ✅ **Event emission MUST be async with <5% latency overhead**
   - Never block critical path (STT, LLM, TTS)
   - In-memory buffer, background flush

3. ✅ **Events MUST include sequence numbers for ordering**
   - Not just timestamps (clock skew breaks ordering)
   - Monotonically increasing within conversation

4. ✅ **Events MUST be sanitized for PII before storage**
   - Compliance requirement (GDPR, HIPAA, TCPA)
   - Replace with tokens, store mapping encrypted

5. ✅ **Event store MUST be append-only**
   - Never modify or delete events (breaks replay)
   - Immutable log

## Common Mistakes to Avoid

### ❌ Mistake 1: Emitting events synchronously
**Problem**: Blocks critical path, breaks latency targets
**Solution**: Async emission with background flush

### ❌ Mistake 2: Not propagating trace_id
**Problem**: Can't correlate events across components
**Solution**: Pass trace_id explicitly, use W3C TraceContext headers

### ❌ Mistake 3: Using timestamps only for ordering
**Problem**: Clock skew causes incorrect ordering
**Solution**: Use sequence numbers (monotonic within conversation)

### ❌ Mistake 4: Storing PII in events without sanitization
**Problem**: GDPR/HIPAA/TCPA violations
**Solution**: Sanitize before storage, store mapping encrypted

### ❌ Mistake 5: Modifying or deleting events
**Problem**: Breaks replay capability
**Solution**: Append-only event store

## Production Metrics to Track

- **Event emission latency**: P95 <10ms (async overhead)
- **Event store write latency**: P95 <100ms (batch writes)
- **Replay success rate**: 100% (all conversations replayable)
- **PII sanitization coverage**: 100% (no PII leaked)
- **Trace ID coverage**: 100% (all events have trace_id)

## References

- Research: `research/09-event-spine.md`, `research/11-observability-metrics.md`
- Architecture Law: `docs/ARCHITECTURE_LAWS.md` R-ARCH-009 (lines 770-788)
- Production evidence: 4x faster debugging with event-sourced replay
