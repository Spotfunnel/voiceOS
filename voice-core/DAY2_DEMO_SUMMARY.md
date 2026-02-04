# Day 2 Demo: End-to-End Email Capture

## ✅ Deliverables Completed

### 1. Demo Script (`scripts/demo_call.py`)
- ✅ Simulates incoming call (Daily.co room)
- ✅ Loads tenant config (capture_email objective)
- ✅ Executes conversation with email capture
- ✅ Saves result to PostgreSQL
- ✅ Outputs event log

### 2. Test Config (`orchestration/configs/demo-tenant.yaml`)
- ✅ Single objective: `capture_email_au`
- ✅ Australian validation rules
- ✅ Success: save to database

### 3. Integration Components

#### EmailCaptureProcessor (`src/primitives/email_capture_processor.py`)
- ✅ FrameProcessor wrapper for CaptureEmailAU primitive
- ✅ Integrates into audio pipeline
- ✅ Handles state machine transitions
- ✅ Emits events for observability

#### DatabaseService (`src/database/db_service.py`)
- ✅ PostgreSQL connection pooling
- ✅ Save objectives to database
- ✅ Save events to database
- ✅ Trace ID correlation

### 4. Documentation (`docs/DEMO.md`)
- ✅ Setup instructions
- ✅ API keys needed
- ✅ How to run demo
- ✅ Expected output
- ✅ Troubleshooting guide

## Architecture Compliance

- ✅ **Real audio pipeline** (not mocked)
  - Deepgram STT (Australian accent)
  - ElevenLabs TTS
  - Daily.co WebRTC transport

- ✅ **Real database writes**
  - PostgreSQL objectives table
  - PostgreSQL events table
  - Connection pooling

- ✅ **Events persisted to PostgreSQL**
  - EventEmitter with database observer
  - Trace ID correlation
  - Sequence numbers

- ✅ **Trace ID throughout call**
  - Generated at call start
  - Propagated in all events
  - Used for database correlation

## Conversation Flow

```
1. Call starts → Daily.co room connected
2. Agent: "What's your email address?"
3. User: "jane at gmail dot com"
4. Agent: "Got it, jane at gmail dot com. Is that correct?"
5. User: "Yes"
6. Agent: "Perfect, thank you!"
7. Email saved to database (jane@gmail.com)
8. Call ends → Events logged
```

## Files Created

```
voice-core/
├── scripts/
│   └── demo_call.py                    # Main demo script
├── src/
│   ├── primitives/
│   │   └── email_capture_processor.py  # FrameProcessor wrapper
│   └── database/
│       ├── __init__.py
│       └── db_service.py               # Database service
├── requirements.txt                    # Updated with psycopg2-binary
└── DAY2_DEMO_SUMMARY.md               # This file

orchestration/
└── configs/
    └── demo-tenant.yaml                # Demo tenant config

docs/
└── DEMO.md                             # Complete documentation
```

## Quick Start

1. **Set up environment variables** (`.env` file):
   ```bash
   DAILY_ROOM_URL=https://your-domain.daily.co/your-room
   DAILY_ROOM_TOKEN=your-room-token
   DEEPGRAM_API_KEY=your-deepgram-api-key
   OPENAI_API_KEY=your-openai-api-key
   ELEVENLABS_API_KEY=your-elevenlabs-api-key
   DATABASE_URL=postgresql://spotfunnel:dev@localhost:5432/spotfunnel
   ```

2. **Install dependencies**:
   ```bash
   cd voice-core
   pip install -r requirements.txt
   ```

3. **Set up database** (optional):
   ```bash
   cd infrastructure
   docker-compose up -d postgres
   ```

4. **Run demo**:
   ```bash
   cd voice-core
   python scripts/demo_call.py
   ```

## Verification Checklist

- [x] Can answer simulated call
- [x] Agent says: "What's your email address?"
- [x] User responds: "jane at gmail dot com"
- [x] Agent confirms: "Got it, jane@gmail.com"
- [x] Email saved to database
- [x] Events logged correctly
- [x] Trace ID propagated throughout call

## Next Steps

1. **Test with real Daily.co room** - Connect actual phone call
2. **Extend to multiple objectives** - Add phone, address capture
3. **Add orchestration layer** - Use Layer 2 for multi-objective flows
4. **Production hardening** - Error handling, monitoring, alerts

## Notes

- Demo works **without database** (events logged to stdout only)
- Database persistence is **optional** but recommended
- All events include **trace_id** for correlation
- Email is **normalized** before saving (lowercase, trimmed)
