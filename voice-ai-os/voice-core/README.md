# Voice Core (Layer 1)

Immutable voice AI foundation for SpotFunnel Voice AI platform using Pipecat framework.

## Architecture

Voice Core is **Layer 1** of the three-layer architecture:

- **Layer 1 (Voice Core)**: Immutable, shared across all customers
  - Telephony integration (Daily.co, PSTN)
  - Audio pipeline (STT → LLM → TTS)
  - Capture primitives (email, phone, address)
  - Turn-taking and barge-in handling
  - Event emission for observability

- **Layer 2 (Orchestration)**: Customer-specific objective sequencing
- **Layer 3 (Workflows)**: Business logic and CRM integration

## Features

- ✅ Frame-based architecture (Pipecat pattern)
- ✅ Deepgram STT (Speech-to-Text) with Australian English support
- ✅ OpenAI GPT-4o (Language Model)
- ✅ ElevenLabs TTS (Text-to-Speech)
- ✅ Daily.co WebRTC transport
- ✅ Async, non-blocking operations
- ✅ State machine-based primitives
- ✅ Event emission for observability

## Requirements

- Python 3.10+
- API keys for:
  - Deepgram (STT)
  - OpenAI (LLM)
  - ElevenLabs (TTS)
  - Daily.co (Telephony)

## Installation

### 1. Install dependencies

```bash
# Using pip
pip install -e .

# Or using requirements.txt (legacy)
pip install -r requirements.txt
```

### 2. Set environment variables

Create a `.env` file:

```bash
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
DAILY_ROOM_URL=https://your-domain.daily.co/room-name
DAILY_TOKEN=your_daily_token
```

Or export them:

```bash
export DEEPGRAM_API_KEY=your_deepgram_api_key
export OPENAI_API_KEY=your_openai_api_key
export ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Usage

### Basic Pipeline

```python
import asyncio
from voice_core import VoicePipeline

async def main():
    # Initialize pipeline
    pipeline = VoicePipeline(
        daily_room_url="https://your-domain.daily.co/room-name",
        daily_token="your_daily_token",
    )
    
    # Start pipeline
    await pipeline.start(
        system_prompt="You are a helpful AI assistant.",
        model="gpt-4o",
        voice_id="21m00Tcm4TlvDq8ikWAM",  # ElevenLabs voice ID
    )
    
    # Pipeline runs until stopped
    # In production, this would be managed by Layer 2 (Orchestration)

if __name__ == "__main__":
    asyncio.run(main())
```

### With Custom Configuration

```python
from voice_core import VoicePipeline

pipeline = VoicePipeline(
    daily_room_url=os.getenv("DAILY_ROOM_URL"),
    daily_token=os.getenv("DAILY_TOKEN"),
    deepgram_api_key=os.getenv("DEEPGRAM_API_KEY"),
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY"),
)

await pipeline.start(
    system_prompt="You are a customer service agent for Acme Plumbing.",
    model="gpt-4o",
    voice_id="custom_voice_id",
)
```

## Project Structure

```
voice-core/
├── voice_core/              # Main package
│   ├── __init__.py          # Package exports
│   ├── pipeline.py          # Core pipeline implementation
│   ├── transports/          # Telephony transports
│   │   └── __init__.py
│   ├── primitives/          # Capture primitives
│   │   ├── __init__.py
│   │   └── base.py          # State machine base classes
│   └── state_machines/     # State machine implementations
│       └── __init__.py
├── tests/                   # Test suite
│   └── __init__.py
├── pyproject.toml           # Project configuration
└── README.md                # This file
```

## Pipeline Flow

```
Daily.co Transport (Audio Input)
    ↓
Deepgram STT (Speech → Text)
    ↓
LLM User Response Aggregator
    ↓
OpenAI GPT-4o (Generate Response)
    ↓
ElevenLabs TTS (Text → Speech)
    ↓
Daily.co Transport (Audio Output)
```

## Development

### Setup Development Environment

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run linter
ruff check .

# Run formatter
black .

# Run type checker
mypy voice_core

# Run tests
pytest
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=voice_core --cov-report=html

# Run specific test file
pytest tests/test_pipeline.py
```

## Architecture Principles

### Immutability (Layer 1)

Voice Core is **immutable** across all customers:
- Same code for all customers
- No customer-specific logic in primitives
- Primitives versioned (v1, v2, v3) for evolution

### Non-Blocking

All operations are async and non-blocking:
- Never block the audio pipeline
- Event emission is fire-and-forget
- Workflow integration is async (Layer 3)

### Frame-Based Architecture

Pipecat uses frame-based processing:
- `AudioRawFrame`: Raw audio data
- `TranscriptionFrame`: STT output
- `TextFrame`: LLM text output
- `TTSAudioFrame`: TTS audio output
- `StartFrame`/`EndFrame`: Control frames

## Integration with Layer 2 (Orchestration)

Voice Core is controlled by Layer 2 via:
- gRPC/HTTP control channel (future)
- Event emission for observability
- Primitive execution API (future)

Layer 2 decides:
- Which objectives to execute
- Objective sequencing
- Customer-specific configuration

## Event Emission

Voice Core emits events for observability:
- `objective_started`: Objective execution began
- `objective_completed`: Objective completed successfully
- `objective_failed`: Objective failed
- `user_spoke`: User speech detected
- `agent_spoke`: Agent response generated

Events are emitted asynchronously and do not block the pipeline.

## License

MIT

## References

- [Pipecat Documentation](https://docs.pipecat.ai)
- [Pipecat GitHub](https://github.com/pipecat-ai/pipecat)
- [Architecture Laws](../docs/ARCHITECTURE_LAWS.md)
- [Three-Layer Architecture](../docs/ARCHITECTURE_LAWS.md#three-layer-architecture)
