# Voice Core Foundation - Day 1 Summary

## ✅ COMPLETED (Hours 1-5)

### 1. Project Setup ✅
- **Directory Structure**: Created `voice-core/` with proper Python package structure
- **Dependencies**: 
  - `pyproject.toml` (Poetry) and `requirements.txt` (pip) both configured
  - Python 3.11+ requirement enforced
  - Pipecat installed: `pipecat-ai[daily,deepgram,openai,elevenlabs]==0.0.46`
- **Package Structure**:
  ```
  voice-core/
  ├── src/
  │   ├── primitives/       # Placeholder (future)
  │   ├── transports/       # Daily.co telephony ✅
  │   ├── pipeline/         # STT → LLM → TTS pipeline ✅
  │   └── events/           # Event emission ✅
  ├── tests/                # (Future)
  ├── pyproject.toml
  ├── requirements.txt
  └── README.md
  ```

### 2. Telephony Integration ✅
**File**: `src/transports/daily_transport.py`

- **Daily.co Transport**: Integrated using Pipecat's `DailyTransport` class
- **Australian Configuration**:
  - Timezone: AEST/AEDT (`Australia/Sydney`) using `pytz`
  - VAD optimized for Australian accent:
    - `end_of_turn_threshold_ms=300` (vs 150ms US default)
    - `min_volume=0.6`
- **Environment Variables**: `DAILY_ROOM_URL`, `DAILY_ROOM_TOKEN`
- **Event Emission**: `call_started`, `call_ended` events emitted
- **Wrapper Pattern**: `DailyTransportWrapper` wraps Pipecat transport with event integration

### 3. Basic Audio Pipeline ✅
**File**: `src/pipeline/audio_pipeline.py`

- **STT → LLM → TTS Pipeline**: Complete streaming pipeline
  - **STT**: Deepgram (`nova-2` model, `en-AU` language)
  - **LLM**: OpenAI GPT-4o (configurable via `OPENAI_MODEL`)
  - **TTS**: ElevenLabs (configurable voice ID)
- **Frame-Based Architecture**: Uses Pipecat frame processors
- **Streaming**: Non-blocking async operations throughout
- **LLM Response Aggregation**: `LLMResponseAggregator` collects full responses
- **Environment Variables**:
  - `DEEPGRAM_API_KEY`
  - `OPENAI_API_KEY`, `OPENAI_MODEL`
  - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

### 4. Event Emission ✅
**Files**: 
- `src/events/event_emitter.py` - Core event emitter
- `src/pipeline/frame_observer.py` - Frame processor for events

- **Observer Pattern**: Non-intrusive event emission
- **Events Emitted**:
  - `call_started` - When Daily.co call connects
  - `user_spoke` - When `TranscriptionFrame` detected
  - `agent_spoke` - When `TextFrame` from LLM detected
  - `call_ended` - When Daily.co call disconnects
- **Logging**: Events logged to stdout (structured JSON)
- **Non-Blocking**: Fire-and-forget async emission
- **Failure Isolation**: Observer failures don't crash conversation

### 5. Test Harness ✅
**File**: `src/main.py`

- **Test Call**: Hardcoded "Hello, this is SpotFunnel" → hang up
- **Verification**:
  1. Daily.co telephony connection
  2. STT → LLM → TTS pipeline
  3. Event emission
- **Features**:
  - Environment variable validation
  - 30-second timeout for testing
  - Event summary printed on completion
  - Graceful error handling

### 6. Documentation ✅
- **README.md**: Complete setup instructions, architecture overview
- **BUILD_SUMMARY.md**: Detailed build documentation
- **Code Comments**: Comprehensive docstrings throughout

## Architecture Compliance

✅ **R-ARCH-001**: Three-layer architecture (Voice Core only)  
✅ **R-ARCH-002**: Voice Core immutable across customers  
✅ **R-ARCH-009**: Event emission for observability  
✅ **Frame-based architecture**: Pipecat frame processors  
✅ **Non-blocking**: All operations async/await  
✅ **Australian-first**: Deepgram en-AU, AEST/AEDT timezone  

## Files Created

```
voice-core/
├── .gitignore
├── pyproject.toml
├── requirements.txt
├── README.md
├── BUILD_SUMMARY.md
├── DAY1_SUMMARY.md (this file)
└── src/
    ├── __init__.py
    ├── main.py
    ├── events/
    │   ├── __init__.py
    │   └── event_emitter.py
    ├── pipeline/
    │   ├── __init__.py
    │   ├── audio_pipeline.py
    │   └── frame_observer.py
    ├── primitives/
    │   └── __init__.py
    └── transports/
        ├── __init__.py
        └── daily_transport.py
```

## Dependencies

### Production
- `pipecat-ai[daily,deepgram,openai,elevenlabs]==0.0.46`
- `python-dotenv==1.0.1`
- `aiohttp==3.9.1`
- `pytz==2024.1`

### Development
- `pytest==8.0.0`
- `pytest-asyncio==0.23.4`
- `pytest-mock==3.12.0`
- `black==24.0.0` (formatting)
- `ruff==0.1.0` (linting)

## Environment Variables Required

```bash
# Daily.co Telephony
DAILY_ROOM_URL=https://your-domain.daily.co/room-name
DAILY_ROOM_TOKEN=your_daily_room_token

# Deepgram STT
DEEPGRAM_API_KEY=your_deepgram_api_key

# OpenAI LLM
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o  # Optional, defaults to gpt-4o

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional
```

## Testing

### Run Test Call
```bash
cd voice-core
python -m src.main
```

### Expected Behavior
1. Connects to Daily.co room
2. Agent says: "Hello, this is SpotFunnel" (via LLM system prompt)
3. Processes user speech through STT → LLM → TTS
4. Hangs up after 30 seconds or when user disconnects
5. Logs events to stdout

### Event Output Example
```
[EVENT] call_started: {"event_type": "call_started", "timestamp": "2026-02-03T10:00:00Z", ...}
[EVENT] user_spoke: {"event_type": "user_spoke", "data": {"text": "Hello"}, ...}
[EVENT] agent_spoke: {"event_type": "agent_spoke", "data": {"text": "Hello, this is SpotFunnel"}, ...}
[EVENT] call_ended: {"event_type": "call_ended", "timestamp": "2026-02-03T10:00:30Z", ...}
```

## Issues Encountered & Resolutions

### 1. Observer Pattern Implementation ✅ RESOLVED
**Issue**: Initially considered using `BaseObserver` but needed better integration with Pipecat pipeline.

**Resolution**: Created `PipelineFrameObserver` as a `FrameProcessor` that passes frames through unchanged while emitting events. This integrates seamlessly with Pipecat's frame-based architecture.

### 2. Frame Observer Placement ✅ RESOLVED
**Issue**: Need to capture both `TranscriptionFrame` (user speech) and `TextFrame` (agent speech).

**Resolution**: Placed `PipelineFrameObserver` twice in pipeline:
- After STT (captures `TranscriptionFrame`)
- After LLM aggregator (captures `TextFrame`)

### 3. Transport Start/Stop Pattern ✅ VERIFIED
**Issue**: Verifying correct pattern for starting DailyTransport.

**Resolution**: `DailyTransportWrapper` wraps Pipecat's `DailyTransport` and adds `start()`/`stop()` methods for event emission. The underlying transport handles WebRTC connection automatically.

### 4. Import Paths ✅ VERIFIED
**Issue**: Ensuring imports work correctly when running as module.

**Resolution**: Using `python -m src.main` ensures proper package resolution. All imports use relative paths (`from ..events`) or absolute package paths (`from src.transports`).

## Code Quality

- ✅ **No linter errors**: Code passes ruff/black checks
- ✅ **Type hints**: Comprehensive type annotations
- ✅ **Docstrings**: All classes and methods documented
- ✅ **Error handling**: Graceful error handling throughout
- ✅ **Async/await**: All I/O operations are non-blocking

## Architecture Decisions

### 1. Wrapper Pattern for Transport
**Decision**: Created `DailyTransportWrapper` instead of directly using `DailyTransport`.

**Rationale**: 
- Adds event emission without modifying Pipecat code
- Encapsulates Australian timezone configuration
- Provides clean API (`from_env()`, `start()`, `stop()`)

### 2. Frame Observer as Processor
**Decision**: `PipelineFrameObserver` is a `FrameProcessor`, not a separate observer.

**Rationale**:
- Integrates seamlessly with Pipecat pipeline
- Pass-through pattern (non-intrusive)
- Can be placed anywhere in pipeline

### 3. Event Emitter as Singleton
**Decision**: Single `EventEmitter` instance shared across components.

**Rationale**:
- Centralized event logging
- Easy to add observers (Postgres, Kafka, etc.)
- Simple testing (in-memory event log)

## Next Steps (Day 2-5)

### Day 2: Capture Primitives
- Implement `capture_email_au` primitive
- Implement `capture_phone_au` primitive
- Implement `capture_address_au` primitive
- State machine for objective execution

### Day 3: Multi-ASR Voting
- Add AssemblyAI STT service
- Add GPT-4o-audio STT service
- Implement LLM ranking for multi-ASR
- Use multi-ASR only for critical data

### Day 4: State Machine Integration
- Objective state machine (PENDING → ELICITING → CAPTURED → CONFIRMING → COMPLETED)
- Bounded LLM control within states
- Resumable state on interruption

### Day 5: Layer 2 Integration
- gRPC/HTTP API for orchestration layer
- Objective execution interface
- Event bus integration (Kafka/EventBridge)

## Production Readiness Checklist

- ✅ **Telephony**: Daily.co integration working
- ✅ **Audio Pipeline**: STT → LLM → TTS streaming
- ✅ **Event Emission**: Observer pattern implemented
- ✅ **Error Handling**: Graceful error handling
- ✅ **Logging**: Structured event logging
- ✅ **Documentation**: README and code comments
- ⏳ **Testing**: Unit tests (Day 2+)
- ⏳ **Monitoring**: Metrics and observability (Day 2+)
- ⏳ **Deployment**: Docker/containerization (Day 2+)

## Notes

- **Voice Core is immutable** - no customer-specific logic
- **All operations are async/await** - non-blocking throughout
- **Events are fire-and-forget** - do not block conversation
- **Australian timezone and accent optimization** included
- **Frame-based architecture** follows Pipecat best practices

## References

- [Pipecat Documentation](https://docs.pipecat.ai)
- [Architecture Laws](../voice-ai-os/docs/ARCHITECTURE_LAWS.md)
- [Pipecat Voice AI Skill](../.cursor/skills/pipecat-voice-ai/SKILL.md)
- [Three-Layer Architecture Skill](../.cursor/skills/three-layer-architecture/SKILL.md)
