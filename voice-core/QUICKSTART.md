# Voice Core - Quick Start Guide

Production-grade telephony integration and audio pipeline for Voice AI.

## Prerequisites

- Python 3.11+
- API keys for:
  - Daily.co OR Telnyx (telephony)
  - Deepgram (STT)
  - OpenAI (LLM)
  - Cartesia (TTS primary)
  - ElevenLabs (TTS fallback)

## Installation

```bash
cd voice-core
pip install -r requirements.txt
```

## Environment Variables

Create `.env` file:

```bash
# Telephony (choose one or both)
DAILY_ROOM_URL=https://example.daily.co/room
DAILY_ROOM_TOKEN=your_daily_token

TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_telnyx_connection_id
TELNYX_SAMPLE_RATE=16000  # HD audio (vs 8kHz)

# STT
DEEPGRAM_API_KEY=your_deepgram_key

# LLM
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1

# TTS
CARTESIA_API_KEY=your_cartesia_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Bot Runner
PORT=8000
HOST=0.0.0.0
```

## Start Bot Runner

```bash
python -m voice_core.src.bot_runner
```

Server runs at `http://localhost:8000`

## API Usage

### Start a Daily.co Call

```bash
curl -X POST http://localhost:8000/start_call \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "call_123",
    "transport": "daily",
    "room_url": "https://example.daily.co/room",
    "token": "your_token",
    "system_prompt": "You are a helpful AI assistant"
  }'
```

### Start a Telnyx Call

```bash
curl -X POST http://localhost:8000/start_call \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "call_456",
    "transport": "telnyx",
    "call_sid": "call_control_id_here",
    "system_prompt": "You are a helpful AI assistant"
  }'
```

### Stop a Call

```bash
curl -X POST http://localhost:8000/stop_call \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "call_123"
  }'
```

### Health Check

```bash
curl http://localhost:8000/health
```

### Stream Call Events (WebSocket)

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/call_events');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.event, data.data);
  // Events: call_started, call_ended, user_spoke, agent_spoke, objective_completed
};

ws.send('ping'); // Keep-alive
```

## Run Tests

```bash
# All tests
pytest tests/ -v

# Specific test files
pytest tests/test_transports.py -v
pytest tests/test_tts_integration.py -v
```

## Architecture

```
AudioRawFrame → STT (Deepgram) → TranscriptionFrame 
              → LLM (GPT-4o) → TextFrame 
              → TTS (Cartesia/ElevenLabs) → TTSAudioFrame 
              → Transport (Daily/Twilio)
```

## Key Features

✅ **Multi-provider TTS** - Cartesia primary ($0.000037/char), ElevenLabs fallback  
✅ **Circuit breakers** - Automatic failover on provider outages  
✅ **Audio encoding validation** - Prevents production failures (PCMU 16kHz HD for Telnyx PSTN)  
✅ **VAD tuning** - 250ms threshold for Australian accent  
✅ **Graceful shutdown** - Completes active calls before exit  
✅ **Event streaming** - Real-time call events via WebSocket  
✅ **HD Audio** - 16kHz sample rate for better voice quality (vs 8kHz)  

## Cost Optimization

- **Cartesia TTS:** $0.000037/char (primary, lowest cost)
- **ElevenLabs TTS:** ~$0.00020/char (fallback only)
- Automatic cost tracking via `get_provider_stats()`

## Troubleshooting

### Audio encoding errors
- **Telnyx PSTN supports PCMU 16kHz HD audio** - Validated at initialization
- Daily.co uses PCM 16kHz - No conversion needed

### Circuit breaker open
- Check provider status (Cartesia/ElevenLabs)
- Manual reset: `multi_tts.reset_circuit_breakers()`
- Automatic recovery after 60 seconds

### VAD false triggers
- Australian accent uses 250ms threshold (not 150ms)
- Adjust `min_volume` if needed (default 0.6)

## Documentation

- **Day 2 Summary:** `DAY2_COMPLETION_SUMMARY.md`
- **Research:** `../voice-ai-os/research/04.5-telephony-infrastructure.md`
- **Skills:** `../.cursor/skills/pipecat-voice-ai/SKILL.md`

## Next Steps

1. Integrate multi-ASR voter for critical data capture
2. Connect objective orchestration (Day 1 primitives)
3. Add production observability (latency, costs, quality metrics)

---

**Production-ready telephony integration with circuit breakers and automatic failover.**
