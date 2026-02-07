# Backend Setup Checklist

**Date:** 2026-02-07  
**Status:** Pre-Setup Verification

---

## Current Status Summary

Based on the Telnyx migration and previous work, here's what we need to verify before creating demo agents:

---

## 1. Python Dependencies ⚠️

### Check Installation

```powershell
cd "C:\Users\leoge\OneDrive\Documents\AI Activity\Cursor\VoiceAIProduction\voice-core"
python -c "import pipecat; print('Pipecat installed')"
```

### Install if needed

```powershell
cd voice-core
pip install -r requirements.txt
```

**Key dependencies:**
- `pipecat-ai` (includes TelnyxFrameSerializer)
- `fastapi`
- `uvicorn`
- `psycopg2-binary`
- `openai`
- `anthropic`
- `deepgram-sdk`
- `cartesia`
- `elevenlabs`
- `aiohttp`
- `pytz`

---

## 2. Database Setup ✅ (Likely Complete)

### Verify Database Connection

```powershell
cd voice-core
python -c "from src.database.db_service import get_db_service; db = get_db_service(); print('Database connected')"
```

### Check Migrations Applied

Migrations location: `voice-ai-os/infrastructure/database/migrations/`

**Expected migrations:**
- ✓ `001_initial_schema.sql`
- ✓ `002_add_user_authentication.sql`
- ✓ `003_add_dashboard_options.sql`
- ✓ `004_add_tenant_onboarding_settings.sql`
- ✓ `006_add_multi_knowledge_bases.sql`
- ✓ `007_add_kb_filler_text.sql`
- ✓ `008_add_call_history.sql`
- ✓ `009_add_sessions_table.sql`
- ✓ `010_add_call_logs.sql`
- ✓ `011_add_system_errors.sql`
- ✓ `012_session_improvements.sql`

**Required tables:**
- `users` - Admin/operator users
- `sessions` - Authentication sessions
- `tenant_onboarding_settings` - Agent configurations
- `call_logs` - Call history and metadata
- `system_errors` - Error tracking
- `dashboard_options` - Dashboard configuration

---

## 3. Environment Variables ✅ (Completed)

Location: `voice-core/.env`

**Already configured:**
- ✅ `TELNYX_API_KEY` - Telnyx API credentials
- ✅ `TELNYX_CONNECTION_ID` - Telnyx connection
- ✅ `TELNYX_SAMPLE_RATE=16000` - HD audio
- ✅ `NGROK_URL` - Development webhook URL
- ✅ `OPENAI_API_KEY` - LLM provider
- ✅ `GEMINI_API_KEY` - LLM fallback
- ✅ `ANTHROPIC_API_KEY` - Stress testing
- ✅ `DEEPGRAM_API_KEY` - STT
- ✅ `CARTESIA_API_KEY` - TTS primary
- ✅ `ELEVENLABS_API_KEY` - TTS fallback
- ✅ `DATABASE_URL` - PostgreSQL connection
- ✅ `RESEND_API_KEY` - Email service

**Verify all keys are valid:**

```powershell
cd voice-core
python -c "import os; from dotenv import load_dotenv; load_dotenv(); keys = ['TELNYX_API_KEY', 'OPENAI_API_KEY', 'DEEPGRAM_API_KEY', 'CARTESIA_API_KEY']; missing = [k for k in keys if not os.getenv(k)]; print('All keys present' if not missing else f'Missing: {missing}')"
```

---

## 4. Telnyx Integration ✅ (Completed)

**Files created:**
- ✅ `voice-core/src/transports/telnyx_transport.py`
- ✅ `voice-core/src/services/telnyx_fallback.py`
- ✅ `voice-core/src/api/telnyx_webhook.py`

**Files updated:**
- ✅ `voice-core/src/bot_runner.py` - Uses Telnyx instead of Twilio

**Ngrok running:**
- ✅ URL: `https://antrorse-fluently-beulah.ngrok-free.dev`
- ✅ Forwarding to: `http://localhost:8000`

---

## 5. Production Features Status

### Completed ✅

From the LAUNCH_READINESS_PLAN:

1. **Error Fallback Handler** ✅
   - `voice-core/src/pipeline/error_handlers.py`
   - `voice-core/src/services/telnyx_fallback.py`
   - Graceful error messages for LLM/TTS/STT failures

2. **Stress/Load Testing Scripts** ✅
   - `voice-core/tests/manual_stress_test.py`
   - `voice-core/tests/load_test_concurrent_calls.py`
   - `voice-core/tests/db_connection_test.py`

3. **Production Environment Setup** ✅
   - `voice-core/.env.production.example`
   - `voice-core/run_production.sh`
   - CORS middleware
   - Rate limiting middleware
   - Sentry error monitoring

4. **Session Management** ✅
   - `voice-core/src/services/session_cleanup.py`
   - `voice-core/src/api/auth.py` (refresh, list, revoke)
   - Migration `012_session_improvements.sql`

5. **Integration Testing Checklist** ✅
   - `INTEGRATION_TEST_CHECKLIST.md`

6. **Schema Documentation** ✅
   - `voice-ai-os/infrastructure/database/SCHEMA.md`

---

## 6. What's Still Needed ❓

### Admin User / Authentication

**Status:** Unknown - Need to verify

**Check:**
```sql
SELECT * FROM users WHERE role = 'admin';
```

**If no admin exists, create one:**
- Use admin panel UI (if frontend running)
- Or use `voice-core/tests/create_operator_users.py` script

### Frontend/Admin Panel

**Status:** Unknown - Need to check if running

**Location:** `apps/web/` (Next.js app)

**To start:**
```powershell
cd apps/web
npm install
npm run dev
```

**Should be available at:** `http://localhost:3000`

---

## 7. Pre-Agent Creation Checklist

Before creating demo agents, verify:

### Backend

- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Database tables exist (run migrations if needed)
- [ ] Backend server can start (`python -m uvicorn src.bot_runner:app --reload`)
- [ ] `/health` endpoint responds
- [ ] Ngrok is running and forwarding to backend

### Authentication

- [ ] Admin user exists in database
- [ ] Can login to admin panel (if frontend running)
- [ ] Session management works

### APIs

- [ ] OpenAI API key valid
- [ ] Deepgram API key valid
- [ ] Cartesia API key valid
- [ ] Telnyx API key valid

### Telnyx

- [ ] Telnyx account configured
- [ ] Phone number assigned to Call Control Application
- [ ] Webhook URL set to ngrok URL
- [ ] Connection ID configured

---

## 8. Quick Verification Commands

### Test Backend Imports

```powershell
cd voice-core
python -c "from src.transports.telnyx_transport import TelnyxTransportWrapper; print('Telnyx transport OK')"
python -c "from src.services.telnyx_fallback import TelnyxFallbackService; print('Telnyx fallback OK')"
python -c "from src.api.telnyx_webhook import router; print('Telnyx webhook OK')"
```

### Test Pipecat Telnyx Support

```powershell
python -c "from pipecat.serializers.telnyx import TelnyxFrameSerializer; print('Pipecat Telnyx support OK')"
```

### Test Database Connection

```powershell
cd voice-core
python check_tenants.py
```

### Start Backend

```powershell
cd voice-core
python -m uvicorn src.bot_runner:app --host 0.0.0.0 --port 8000 --reload
```

Then visit: `http://localhost:8000/docs` (should show FastAPI Swagger UI)

---

## 9. Creating Your First Agent

Once backend is ready:

### Option A: Via Admin Panel UI

1. Start frontend: `cd apps/web && npm run dev`
2. Login at `http://localhost:3000`
3. Navigate to "New Agent" wizard
4. Follow 6-step onboarding flow:
   - Step 1: Business info
   - Step 2: System prompt / personality
   - Step 3: Knowledge bases
   - Step 4: N8N workflows (optional)
   - Step 5: Dashboard configuration
   - Step 6: Phone number / Telnyx settings

### Option B: Via API

```powershell
curl -X POST http://localhost:8000/api/tenant/create `
  -H "Content-Type: application/json" `
  -d '{
    "business_name": "Test Business",
    "system_prompt": "You are a helpful assistant for Test Business.",
    "knowledge_bases": [],
    "telephony": {
      "phone_number": "+1234567890",
      "transfer_contact_phone": "+1987654321",
      "transfer_contact_name": "Support Team"
    }
  }'
```

### Option C: Via Database Script

Create `voice-core/create_demo_agent.py` to insert directly into database.

---

## 10. Testing Flow

After agent is created:

1. **Call your Telnyx number**
2. **Monitor logs** in backend terminal
3. **Verify webhook** receives call in ngrok dashboard (`http://127.0.0.1:4040`)
4. **Check call logs** in database or admin panel

---

## Summary

### Ready ✅
- Telnyx integration complete
- Environment variables configured
- Ngrok running
- Production features implemented

### Need to Verify ❓
- Python dependencies installed
- Database migrations applied
- Admin user exists
- Backend can start successfully

### Next Steps
1. Install dependencies: `pip install -r requirements.txt`
2. Verify database: `python check_tenants.py`
3. Start backend: `uvicorn src.bot_runner:app --reload`
4. Create admin user (if needed)
5. Create first agent/tenant

---

**Once these are verified, you'll be ready to create demo agents and test calls!** 🚀
