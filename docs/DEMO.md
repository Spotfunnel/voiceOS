# End-to-End Demo: Email Capture

**DAY 2 DELIVERABLE**: Complete working demo of voice AI system capturing email addresses.

## Overview

This demo demonstrates the complete flow:
1. **Answer Phone** → Connect to Daily.co room
2. **Capture Email** → Agent asks for email, user responds, agent confirms
3. **Save to Database** → Captured email saved to PostgreSQL
4. **Hang Up** → Call ends, events logged

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Daily.co Room (Incoming Call)                              │
└───────────────────┬─────────────────────────────────────────┘
                    │ WebRTC Audio Stream
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Voice Core (Layer 1)                                       │
│ - DailyTransportWrapper (WebRTC)                           │
│ - AudioPipeline (STT → Email Capture → TTS)                │
│ - EmailCaptureProcessor (FrameProcessor)                   │
│ - EventEmitter (Observability)                             │
└───────────────────┬─────────────────────────────────────────┘
                    │ Events + Captured Data
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL Database                                         │
│ - objectives table (captured email)                         │
│ - events table (event log)                                  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. API Keys

You need the following API keys:

- **Daily.co**: Room URL and token
- **Deepgram**: API key for STT (Australian accent)
- **OpenAI**: API key for LLM (GPT-4o)
- **ElevenLabs**: API key for TTS

### 2. Database Setup

PostgreSQL database with schema initialized. See `infrastructure/postgres/init.sql` for schema.

**Quick Setup (Docker)**:
```bash
cd infrastructure
docker-compose up -d postgres
```

**Environment Variables**:
```bash
DATABASE_URL=postgresql://spotfunnel:dev@localhost:5432/spotfunnel
# OR individual variables:
POSTGRES_USER=spotfunnel
POSTGRES_PASSWORD=dev
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=spotfunnel
```

### 3. Python Environment

```bash
cd voice-core
pip install -r requirements.txt
pip install psycopg2-binary  # For PostgreSQL
```

## Setup Instructions

### Step 1: Create Daily.co Room

1. Go to [Daily.co Dashboard](https://dashboard.daily.co/)
2. Create a new room
3. Copy the room URL and generate a token

### Step 2: Configure Environment

Create `.env` file in `voice-core/` directory:

```bash
# Daily.co
DAILY_ROOM_URL=https://your-domain.daily.co/your-room
DAILY_ROOM_TOKEN=your-room-token

# ASR (Deepgram)
DEEPGRAM_API_KEY=your-deepgram-api-key

# LLM (OpenAI)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1  # Optional, defaults to gpt-4.1

# TTS (ElevenLabs)
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional

# Database (Optional - demo works without DB)
DATABASE_URL=postgresql://spotfunnel:dev@localhost:5432/spotfunnel
```

### Step 3: Initialize Database Schema

If using database persistence:

```bash
# Using Docker Compose (recommended)
cd infrastructure
docker-compose up -d postgres

# Or manually
psql -U spotfunnel -d spotfunnel -f infrastructure/postgres/init.sql
```

## Running the Demo

### Option 1: Direct Python Script

```bash
cd voice-core
python scripts/demo_call.py
```

### Option 2: With Virtual Environment

```bash
cd voice-core
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install psycopg2-binary
python scripts/demo_call.py
```

## Expected Output

### Console Output

```
================================================================================
VOICE AI DEMO: Email Capture
================================================================================
Trace ID: 123e4567-e89b-12d3-a456-426614174000
Conversation ID: 123e4567-e89b-12d3-a456-426614174001
Tenant ID: demo-tenant

✓ Database service initialized
✓ Event persistence enabled

📞 Connecting to Daily.co room...
✓ Pipeline configured

Expected conversation flow:
  1. Agent: 'What's your email address?'
  2. User: 'jane at gmail dot com'
  3. Agent: 'Got it, jane at gmail dot com. Is that correct?'
  4. User: 'Yes'
  5. Agent: 'Perfect, thank you!'
  6. Email saved to database

Starting call... (Press Ctrl+C to stop)
--------------------------------------------------------------------------------
✓ Transport started
✓ Pipeline running...

[EVENT] call_started: {"event_type": "call_started", ...}
[EVENT] objective_started: {"event_type": "objective_started", ...}
[EmailCapture] ELICIT: What's your email address?
[EVENT] agent_spoke: {"event_type": "agent_spoke", ...}
[EmailCapture] User said: jane at gmail dot com (confidence: 0.85)
[EVENT] user_spoke: {"event_type": "user_spoke", ...}
[EVENT] objective_captured: {"event_type": "objective_captured", ...}
[EmailCapture] CONFIRM: Got it, jane at gmail dot com. Is that correct?
[EVENT] agent_spoke: {"event_type": "agent_spoke", ...}
[EmailCapture] User said: yes (confidence: 0.92)
[EVENT] user_spoke: {"event_type": "user_spoke", ...}
[EmailCapture] COMPLETED: jane@gmail.com
[EVENT] objective_completed: {"event_type": "objective_completed", ...}
[EVENT] call_ended: {"event_type": "call_ended", ...}

📴 Stopping transport...

💾 Saving captured email to database...
✓ Email saved to database (objective_id: 123e4567-e89b-12d3-a456-426614174002)

================================================================================
EVENT SUMMARY
================================================================================
1. call_started (2026-02-03T10:00:00Z)
   Data: {'room_url': 'https://...', 'trace_id': '...'}
2. objective_started (2026-02-03T10:00:01Z)
   Data: {'objective_type': 'capture_email_au', ...}
3. agent_spoke (2026-02-03T10:00:02Z)
4. user_spoke (2026-02-03T10:00:05Z)
5. objective_captured (2026-02-03T10:00:06Z)
   Data: {'value': 'jane@gmail.com', ...}
6. agent_spoke (2026-02-03T10:00:07Z)
7. user_spoke (2026-02-03T10:00:10Z)
8. objective_completed (2026-02-03T10:00:11Z)
   Data: {'value': 'jane@gmail.com', ...}
9. call_ended (2026-02-03T10:00:12Z)

Total events: 9

✅ SUCCESS: Email captured: jane@gmail.com

================================================================================
Demo completed!
================================================================================
```

### Database Verification

Check captured email in database:

```sql
-- View captured objectives
SELECT 
    objective_id,
    conversation_id,
    objective_type,
    state,
    captured_data,
    completed_at
FROM objectives
WHERE objective_type = 'capture_email_au'
ORDER BY completed_at DESC
LIMIT 10;

-- View events
SELECT 
    event_type,
    payload,
    timestamp
FROM events
WHERE trace_id = 'your-trace-id'
ORDER BY sequence_number;
```

## Integration Verification

### ✅ Checklist

- [x] **Can answer simulated call** → Daily.co transport connects
- [x] **Agent says: "What's your email address?"** → EmailCaptureProcessor elicits
- [x] **User responds: "jane at gmail dot com"** → STT transcribes, primitive extracts
- [x] **Agent confirms: "Got it, jane@gmail.com"** → Confirmation prompt emitted
- [x] **Email saved to database** → DatabaseService saves to PostgreSQL
- [x] **Events logged correctly** → EventEmitter logs all events

### Trace ID Propagation

Trace ID is propagated throughout the call:
- Generated at call start
- Included in all events
- Used for database correlation
- Visible in logs

## Troubleshooting

### Issue: Database Connection Failed

**Error**: `Failed to initialize database pool`

**Solution**:
1. Check PostgreSQL is running: `docker ps` or `pg_isready`
2. Verify DATABASE_URL or individual POSTGRES_* variables
3. Check database schema is initialized: `psql -U spotfunnel -d spotfunnel -c "\dt"`

**Note**: Demo works without database (events logged to stdout only)

### Issue: Daily.co Connection Failed

**Error**: `Failed to connect to Daily.co room`

**Solution**:
1. Verify DAILY_ROOM_URL and DAILY_ROOM_TOKEN are correct
2. Check room exists and token is valid
3. Ensure network can reach Daily.co (no firewall blocking)

### Issue: Email Not Captured

**Possible Causes**:
1. User speech not detected (check VAD settings)
2. STT transcription failed (check Deepgram API key)
3. Email extraction failed (check logs for transcription)

**Debug**:
- Check console logs for `[EmailCapture]` messages
- Verify STT is working: look for `user_spoke` events
- Check email extraction: look for `objective_captured` events

### Issue: Events Not Persisting

**Error**: Events logged but not in database

**Solution**:
1. Check database connection (see above)
2. Verify events table exists: `psql -c "\d events"`
3. Check event observer is registered (should see "✓ Event persistence enabled")

## Next Steps

After successful demo:

1. **Extend to Multiple Objectives**: Add phone capture, address capture
2. **Add Orchestration Layer**: Use Layer 2 (orchestration) for multi-objective flows
3. **Add Workflow Integration**: Connect to Layer 3 (workflows) for business logic
4. **Production Hardening**: Add error handling, retries, monitoring

## Files Created

- `scripts/demo_call.py` - Main demo script
- `src/primitives/email_capture_processor.py` - FrameProcessor wrapper
- `src/database/db_service.py` - Database service
- `orchestration/configs/demo-tenant.yaml` - Demo tenant config
- `docs/DEMO.md` - This documentation

## Architecture Compliance

This demo follows all architecture principles:

- ✅ **R-ARCH-006**: Email is CRITICAL data - ALWAYS confirmed
- ✅ **R-ARCH-009**: Events emitted for observability
- ✅ **D-ARCH-002**: Voice Core is Python (Pipecat)
- ✅ **Trace ID**: Propagated throughout call
- ✅ **Real Audio Pipeline**: No mocks, real STT/TTS
- ✅ **Database Persistence**: Real PostgreSQL writes
