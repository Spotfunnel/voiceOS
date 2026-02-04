# Voice Core Setup Guide

## Quick Start

### 1. Prerequisites

- Python 3.10 or higher
- API keys for:
  - Deepgram (STT)
  - OpenAI (LLM)
  - ElevenLabs (TTS)
  - Daily.co (Telephony)

### 2. Clone and Navigate

```bash
cd voice-ai-os/voice-core
```

### 3. Set Up Virtual Environment

**Windows (PowerShell):**
```powershell
.\setup_venv.ps1
```

**Linux/Mac:**
```bash
chmod +x setup_venv.sh
./setup_venv.sh
```

**Manual Setup:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
DAILY_ROOM_URL=https://your-domain.daily.co/room-name
DAILY_TOKEN=your_daily_token
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### 5. Verify Installation

```bash
# Run tests
pytest

# Check linting
ruff check .

# Type checking
mypy voice_core
```

### 6. Run Example

```bash
python example.py
```

## Project Structure

```
voice-core/
├── voice_core/              # Main package
│   ├── __init__.py
│   ├── pipeline.py         # Core pipeline (STT → LLM → TTS)
│   ├── transports/         # Telephony transports
│   │   ├── __init__.py
│   │   └── daily_transport.py
│   ├── primitives/         # Capture primitives (future)
│   │   ├── __init__.py
│   │   └── base.py
│   └── state_machines/     # State machines (future)
│       └── __init__.py
├── tests/                  # Test suite
├── pyproject.toml          # Project configuration
├── README.md               # Documentation
├── SETUP.md               # This file
├── setup_venv.ps1         # Windows setup script
├── setup_venv.sh          # Linux/Mac setup script
└── .env.example           # Environment template
```

## Architecture

Voice Core is **Layer 1** of the three-layer architecture:

- **Layer 1 (Voice Core)**: Immutable audio pipeline
  - STT (Deepgram) → LLM (GPT-4o) → TTS (ElevenLabs)
  - Daily.co WebRTC transport
  - Frame-based processing (Pipecat)

- **Layer 2 (Orchestration)**: Objective sequencing (separate service)
- **Layer 3 (Workflows)**: Business logic (separate service)

## Development

### Running Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=voice_core --cov-report=html

# Specific test file
pytest tests/test_pipeline.py
```

### Code Quality

```bash
# Linting
ruff check .

# Formatting
black .

# Type checking
mypy voice_core
```

### Adding Dependencies

Edit `pyproject.toml` and reinstall:

```bash
pip install -e ".[dev]"
```

## Troubleshooting

### Import Errors

Ensure you've activated the virtual environment:
```bash
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

### Missing API Keys

Check that `.env` file exists and contains all required keys:
```bash
cat .env  # Linux/Mac
type .env # Windows
```

### Daily.co Connection Issues

Verify:
- Room URL is correct
- Token is valid and not expired
- Network connectivity to Daily.co

## Next Steps

1. **Layer 1 Complete**: Basic pipeline is ready
2. **Layer 2 Integration**: Connect to Orchestration service (future)
3. **Primitives**: Implement capture primitives (email, phone, etc.)
4. **Multi-ASR**: Add multi-ASR voting for Australian accent

## Support

- [Pipecat Documentation](https://docs.pipecat.ai)
- [Architecture Laws](../docs/ARCHITECTURE_LAWS.md)
- [Three-Layer Architecture Skill](../.cursor/skills/three-layer-architecture/SKILL.md)
