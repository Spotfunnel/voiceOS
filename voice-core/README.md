# Voice Core (Layer 1)

Immutable voice AI foundation using Pipecat framework.

## Architecture

Voice Core is **Layer 1** of the three-layer architecture:
- **Layer 1**: Voice Core (this package) - immutable across customers
- **Layer 2**: Orchestration - objective sequencing (separate package)
- **Layer 3**: Workflows - business automation (customer-provided)

### What Voice Core Provides

✅ **Telephony Integration**
- Daily.co transport (PSTN/WebRTC)
- Australian timezone (AEST/AEDT)
- VAD (Voice Activity Detection) optimized for Australian accent

✅ **Audio Pipeline**
- STT: Deepgram (optimized for Australian English)
- LLM: Gemini 2.5 Flash (primary), OpenAI GPT-4.1 (backup)
- TTS: ElevenLabs
- Streaming frame-based architecture (non-blocking)

✅ **Event Emission**
- Observer pattern for non-intrusive monitoring
- Events: `call_started`, `user_spoke`, `agent_spoke`, `call_ended`
- Logged to stdout (Postgres integration in Layer 2/3)

### What Voice Core Does NOT Do

❌ **No customer-specific logic** (Layer 2 responsibility)
❌ **No business logic** (Layer 3 responsibility)
❌ **No objective sequencing** (Layer 2 responsibility)

## Requirements

- Python 3.11+
- Daily.co account and API credentials
- Deepgram API key
- OpenAI API key
- ElevenLabs API key

## Setup

### 1. Install Dependencies

Using pip:
```bash
cd voice-core
pip install -r requirements.txt
```

Using Poetry:
```bash
cd voice-core
poetry install
```

### 2. Configure Environment Variables

The project ships with a [`voice-core/.env.example`](./.env.example) that already
points at the SpotFunnel demo room. Copy or rename it to `.env` when you're
ready to run an end-to-end call.

Create a `.env` file in the `voice-core` directory (you can start from `.env.example`):

```bash
# Daily.co Telephony
DAILY_ROOM_URL=https://your-domain.daily.co/room-name
DAILY_ROOM_TOKEN=your_daily_room_token

# Deepgram STT
DEEPGRAM_API_KEY=your_deepgram_api_key

# OpenAI LLM
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

The existing `spotfunnel.daily.co` room and API token are preserved in
`.env.example` so the friendly receptionist demo can launch immediately.

### Smart Turn V3 (Turn Detection)

Smart Turn V3 provides ML-based turn detection to reduce premature cutoffs.

Features:
- 12ms CPU inference (no GPU required)
- 8MB quantized model (smart-turn-v3.2-cpu)
- 23 languages including English (AU)
- Works in conjunction with Silero VAD

Configuration:
```bash
SMART_TURN_ENABLED=true
SMART_TURN_CPU_COUNT=1
```

How it works:
1. Silero VAD detects silence periods
2. Smart Turn analyzes full audio segment for turn completion
3. Combines acoustic features (prosody, intonation) with linguistic cues

### Knowledge Base (Tier 1: Pre-Loaded Static)

V1 supports Tier 1 knowledge bases so you can load FAQ and company info directly into the system prompt for zero-latency retrieval.

**Features:**
- Add FAQ/company info during tenant configuration
- Knowledge loaded at startup (0ms retrieval cost)
- Agent answers naturally from the preloaded knowledge
- Prompt caching reduces repetition cost by 50-90%

**Size Limit:** 10,000 tokens (~7,500 words, ~20-25 pages)

**Configuration:**
```json
{
  "static_knowledge": "COMPANY INFO:\\nHours: 9am-5pm Mon-Fri\\nSERVICES: Plumbing, electrical"
}
```

**Cost:** ~$0.003/call with provider prompt caching (90% of tokens cached)

**Upgrade Path:** For knowledge >10K tokens, migrate to Tier 3 (vector database) in V2.

**Research:** [`voice-ai-os/research/13-knowledge-bases.md`](../voice-ai-os/research/13-knowledge-bases.md)  
**Guide:** [`voice-ai-os/docs/KNOWLEDGE-BASE-GUIDE.md`](../voice-ai-os/docs/KNOWLEDGE-BASE-GUIDE.md)

### 3. Run Test Call

```bash
python -m src.main
```

Expected behavior:
1. Connects to Daily.co room
2. Agent says: "Hello, this is SpotFunnel"
3. Processes user speech through STT → LLM → TTS
4. Hangs up after 30 seconds or when user disconnects
5. Logs events to stdout

## Provider compatibility

- **Deepgram**: locked to `deepgram-sdk==5.3.2` so Pipecat's `DeepgramSTTService`
  can reach the `AsyncListenWebSocketClient` implementation that works with
  `nova-2` and the Australian mix.
- **OpenAI**: `openai==1.12.0` keeps the `NOT_GIVEN` payload constant that Pipecat
  expects when streaming GPT-4.1 audio responses.
- **Structlog**: `structlog==24.1.0` satisfies Pipecat's structured logging hooks.
- **Cartesia / ElevenLabs**: handled through the `pipecat-ai[elevens,...]` extras,
  but the Voice Core wrappers enforce the sonic-3 / eleven_turbo_v2 voices so
  the cost/latency assumptions in the demo hold.
- **Daily.co**: the release bundled with `pipecat-ai==0.0.85` is the version
  validated for `spotfunnel.daily.co`; avoid mixing in newer `daily` releases
  without a quick sanity check.

## Project Structure
```
voice-core/
├── src/
│   ├── transports/       # Telephony (Daily.co)
│   │   └── daily_transport.py
│   ├── pipeline/         # STT → LLM → TTS pipeline
│   │   └── audio_pipeline.py
│   ├── events/           # Event emission
│   │   └── event_emitter.py
│   ├── primitives/       # Capture primitives (future)
│   └── main.py           # Test harness
├── tests/                # Tests (future)
├── pyproject.toml        # Poetry configuration
├── requirements.txt      # Pip dependencies
└── README.md
```

## Architecture Compliance

This implementation follows:

- **R-ARCH-001**: Three-layer architecture (Voice Core only)
- **R-ARCH-002**: Voice Core immutable across customers
- **R-ARCH-009**: Event emission for observability
- **Frame-based architecture**: Pipecat frame processors
- **Non-blocking**: All operations async/await
- **Australian-first**: Deepgram en-AU, AEST/AEDT timezone

## Next Steps

1. **Day 2**: Implement capture primitives (email, phone, address)
2. **Day 3**: Multi-ASR voting for critical data
3. **Day 4**: State machine for objective execution
4. **Day 5**: Integration with Layer 2 (orchestration)

## References

- [Pipecat Documentation](https://docs.pipecat.ai)
- [Architecture Laws](../voice-ai-os/docs/ARCHITECTURE_LAWS.md)
- [Pipecat Voice AI Skill](../.cursor/skills/pipecat-voice-ai/SKILL.md)
