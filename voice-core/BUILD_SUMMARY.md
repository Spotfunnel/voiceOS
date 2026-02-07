# Voice Core Foundation - Build Summary

## Day 1 (Hours 1-5) - Completed ✅

### What Was Built

#### 1. Project Setup ✅
- Created `voice-core/` directory structure
- Initialized Python project with `pyproject.toml` (Poetry) and `requirements.txt` (pip)
- Python 3.11+ requirement enforced
- Added Pipecat dependency: `pipecat-ai[daily,deepgram,openai,elevenlabs]`
- Created directory structure:
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

#### 2. Telephony Integration ✅
- **File**: `src/transports/daily_transport.py`
- Integrated Daily.co transport using Pipecat's `DailyTransport`
- Configured for Australian timezone (AEST/AEDT) using `pytz`
- VAD (Voice Activity Detection) optimized for Australian accent:
  - `end_of_turn_threshold_ms=300` (vs 150ms US default)
  - `min_volume=0.6`
- Environment variables: `DAILY_ROOM_URL`, `DAILY_ROOM_TOKEN`
- Event emission: `call_started`, `call_ended`

#### 3. Audio Pipeline ✅
- **File**: `src/pipeline/audio_pipeline.py`
- Built STT → LLM → TTS pipeline:
  - **STT**: Deepgram (`nova-2` model, `en-AU` language)
  - **LLM**: Gemini 2.5 Flash (primary), OpenAI GPT-4.1 (backup)
  - **TTS**: ElevenLabs (configurable voice ID)
- Frame-based architecture (Pipecat pattern)
- Streaming (non-blocking async operations)
- Environment variables:
  - `DEEPGRAM_API_KEY`
  - `OPENAI_API_KEY`, `OPENAI_MODEL`
  - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

#### 4. Event Emission ✅
- **Files**: 
  - `src/events/event_emitter.py` - Core event emitter
  - `src/pipeline/frame_observer.py` - Frame processor for events
- Observer pattern implementation
- Events emitted:
  - `call_started` - When Daily.co call connects
  - `user_spoke` - When TranscriptionFrame detected
  - `agent_spoke` - When TextFrame from LLM detected
  - `call_ended` - When Daily.co call disconnects
- Events logged to stdout (structured JSON)
- Non-intrusive (does not affect conversation behavior)
- Failures do not crash conversation

#### 5. Test Harness ✅
- **File**: `src/main.py`
- Hardcoded test: "Hello, this is SpotFunnel" → hang up
- Verifies:
  1. Daily.co telephony connection
  2. STT → LLM → TTS pipeline
  3. Event emission
- 30-second timeout for testing
- Environment variable validation
- Event summary printed on completion

#### 6. Documentation ✅
- **File**: `README.md`
- Setup instructions
- Architecture overview
- Environment variable configuration
- Project structure
- Architecture compliance notes

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
├── BUILD_SUMMARY.md (this file)
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

- `pipecat-ai[daily,deepgram,openai,elevenlabs]==0.0.46`
- `python-dotenv==1.0.1`
- `aiohttp==3.9.1`
- `pytest==8.0.0` (dev)
- `pytest-asyncio==0.23.4` (dev)
- `pytest-mock==3.12.0` (dev)

## Environment Variables Required

```bash
# Daily.co Telephony
DAILY_ROOM_URL=https://your-domain.daily.co/room-name
DAILY_ROOM_TOKEN=your_daily_room_token

# Deepgram STT
DEEPGRAM_API_KEY=your_deepgram_api_key

# OpenAI LLM
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1  # Optional, defaults to gpt-4.1

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional
```

## Testing

Run test call:
```bash
cd voice-core
python -m src.main
```

Expected behavior:
1. Connects to Daily.co room
2. Agent says: "Hello, this is SpotFunnel" (via LLM system prompt)
3. Processes user speech through STT → LLM → TTS
4. Hangs up after 30 seconds or when user disconnects
5. Logs events to stdout

## Issues Encountered

1. **Observer Pattern**: Initially tried to use `BaseObserver` but switched to `FrameProcessor` for better integration with Pipecat pipeline
2. **Frame Observer Placement**: Placed observer twice in pipeline (after STT and after LLM aggregator) to catch both TranscriptionFrame and TextFrame
3. **Environment Variables**: Created `.env.example` but file was rejected (user can create manually)

## Next Steps

### Day 2-5 (Future)
1. **Capture Primitives**: Implement email, phone, address capture primitives
2. **Multi-ASR Voting**: Add multi-ASR voting for critical data (Deepgram + AssemblyAI + OpenAI audio STT)
3. **State Machine**: Integrate objective state machine for deterministic execution
4. **Layer 2 Integration**: Connect to orchestration layer (gRPC/HTTP)
5. **Postgres Event Storage**: Replace stdout logging with Postgres integration

## Notes

- Voice Core is **immutable** - no customer-specific logic
- All operations are **async/await** (non-blocking)
- Events are **fire-and-forget** (do not block conversation)
- Australian timezone and accent optimization included
- Frame-based architecture follows Pipecat best practices
