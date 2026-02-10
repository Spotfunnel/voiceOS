# Voice AI Project - Session Handoff

## CURRENT STATUS (Working but needs fixes)

### ✅ WHAT'S WORKING:
- Telnyx webhooks receiving calls
- Call answering (call picks up)
- Riley speaks greeting
- Audio flowing (8kHz PCMU)
- Pipeline: Deepgram → Gemini 2.5 Flash → Cartesia
- Database: PostgreSQL with prompts/knowledge_bases tables
- Layer 1 + Layer 2 prompt architecture implemented

### ❌ KNOWN ISSUES TO FIX:
1. **Audio feedback loop:** STT is hearing agent's own voice (transcribing Riley instead of user)
2. **Poor audio quality:** Using 8kHz PCMU (temporary fallback because Pipecat doesn't support G722/LINEAR16)
3. **Greeting loop:** Agent repeats greeting 3 times instead of once
4. **Cartesia websocket cleanup:** Close frame issue (minor, doesn't block calls)

### 🎯 IMMEDIATE GOALS:
1. Fix audio feedback (prevent STT from hearing agent)
2. Upgrade to 16kHz LINEAR16 encoding (either add to Pipecat or custom Telnyx handler)
3. Fix greeting to play once only
4. Test full conversation with clean audio

## TECHNICAL DETAILS

### Stack:
- **Telephony:** Telnyx Call Control API
- **STT:** Deepgram Nova-3 (16kHz capable, currently receiving 8kHz)
- **LLM:** Gemini 2.5 Flash
- **TTS:** Cartesia Sonic 3
- **Framework:** Pipecat (but Telnyx transport is incomplete)

### Configuration:
- **Telnyx Number:** +61240675354
- **Webhook:** https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook
- **Connection ID:** 2889961366351775467
- **Connection Name:** voiceOS
- **Database:** PostgreSQL (local Docker)
- **Current Encoding:** PCMU 8kHz (temporary)
- **Target Encoding:** LINEAR16 16kHz

### Key Files:
- `voice-core/src/bot_runner.py` - Main server, webhook handling, WS endpoint
- `voice-core/src/api/telnyx_webhook.py` - Webhook handler, answer/stream commands
- `voice-core/src/pipeline/voice_pipeline.py` - STT→LLM→TTS pipeline
- `voice-core/src/tts/cartesia_tts.py` - TTS integration
- `voice-core/src/services/prompt_service.py` - Layer 1+2 prompt management
- `voice-core/infrastructure/database/migrations/013_add_prompts_table.sql` - Latest schema

### Environment:
- **Port:** 8000
- **ngrok:** Running, forwarding to localhost:8000
- **Database:** spotfunnel-postgres container (healthy)
- **Connection:** postgresql://spotfunnel:dev@localhost:5432/spotfunnel

## ROOT CAUSE ANALYSIS

### Why Audio Feedback Happening:
- Telnyx may be sending `both_tracks` despite requesting `inbound_track`
- OR Pipecat's deserializer not filtering outbound audio properly
- STT receives agent's speech → LLM responds to itself → loop

### Why 8kHz Quality:
- Pipecat's TelnyxSerializer only supports PCMU/PCMA
- No G722 or LINEAR16 encoding implemented
- Fell back to PCMU as temporary fix to get audio flowing

### Why Greeting Loops:
- Greeting triggered multiple times during pipeline initialization
- May be related to multiple `StartFrame` events or pipeline restarts

## SOLUTIONS TO IMPLEMENT

### Option A: Fix Pipecat's Telnyx Integration (Recommended if staying with Pipecat)
1. Add LINEAR16 encoding to TelnyxSerializer
2. Fix audio track filtering (only inbound)
3. Add proper initialization sequence for greeting

### Option B: Custom Telnyx Handler (Cleaner long-term) ⭐ STARTED
**Status:** Implementation in progress in `bot_runner.py`

We've begun implementing a custom Telnyx WebSocket handler that:
1. Bypasses Pipecat's TelnyxTransport entirely
2. Handles Telnyx WebSocket protocol directly
3. Supports LINEAR16 16kHz natively
4. Gives full control over audio routing

**Current Implementation:**
- Custom `TelnyxAudioInputProcessor` and `TelnyxAudioOutputProcessor`
- Direct WebSocket message handling (JSON parsing)
- Audio decoding: L16, PCMU, PCMA support
- Resampling to 16kHz for pipeline
- Base64 encoding for outbound audio

**What's Left:**
- Test the new handler with a live call
- Verify LINEAR16 is accepted by Telnyx
- Ensure no audio feedback (inbound track only)
- Confirm greeting plays once

## PREVIOUS SESSION LEARNINGS

### ❌ What DOESN'T Work:
- Pipecat's Telnyx transport doesn't support G722/LINEAR16
- Pre-injecting all knowledge bases (too slow, kills latency)
- Trying to fix "complexity" by starting over (same Telnyx issues)

### ✅ What DOES Work:
- Dynamic knowledge injection (only load when mentioned)
- Layer 1 (universal) + Layer 2 (business) prompt architecture
- PCMU as temporary fallback (proves audio can flow)
- Direct API calls to Telnyx (for answer, speak, etc.)

### ⚠️ Learned the Hard Way:
- Pipecat is good for LLM/TTS, incomplete for Telnyx
- Starting from scratch doesn't solve Telnyx integration challenges
- 8kHz PCMU quality is terrible but proves the pipeline works
- Audio feedback is the #1 blocking issue right now

## LATEST CHANGES (This Session)

### Custom Telnyx Handler Implementation:
**File:** `voice-core/src/bot_runner.py` (lines ~880-1050)

**Key Changes:**
1. Removed `FastAPIWebsocketTransport` and `TelnyxFrameSerializer`
2. Added custom processors:
   - `TelnyxAudioInputProcessor` - receives audio from Telnyx WS
   - `TelnyxAudioOutputProcessor` - sends audio to Telnyx WS
3. Added audio loop coroutines:
   - `receive_inbound_audio()` - parses Telnyx messages, decodes audio
   - `send_outbound_audio()` - encodes pipeline audio, sends to Telnyx
4. Updated `telnyx_webhook.py` to request L16 16kHz:
   ```python
   payload = {
       "stream_url": stream_url,
       "stream_track": "inbound_track",
       "stream_codec": "L16",
       "stream_bidirectional_mode": "rtp",
       "stream_bidirectional_codec": "L16",
       "stream_bidirectional_sampling_rate": 16000,
   }
   ```

**Audio Flow:**
```
Telnyx → WS → receive_inbound_audio() → decode (L16/PCMU/PCMA) 
  → resample to 16kHz → InputAudioRawFrame → STT → LLM → TTS 
  → AudioRawFrame → TelnyxAudioOutputProcessor → audio_out_queue 
  → send_outbound_audio() → base64 encode → Telnyx WS
```

## NEXT SESSION PRIORITIES

### Priority 1: Test Custom Telnyx Handler (CRITICAL)
**Goal:** Verify new implementation works end-to-end

**Test Steps:**
1. Restart uvicorn (already running on port 8000)
2. Ensure ngrok is running and pointing to correct URL
3. Call +61240675354
4. Check logs for:
   - `Telnyx WS start: encoding=L16 sample_rate=16000`
   - No audio feedback (STT should not transcribe "Hello! How can I help you today?")
   - Clear audio quality
   - Single greeting

**Success Criteria:**
- ✅ Call answers within 2 seconds
- ✅ Greeting plays once clearly
- ✅ User can speak and be heard
- ✅ Agent responds intelligently (not echoing self)
- ✅ Audio quality is clear (16kHz)
- ✅ No loops or repetition

### Priority 2: Fix Any Issues Found
**If Telnyx rejects L16:**
- Fall back to PCMU in the handler (already has support)
- Document as tech debt to add G722 support

**If audio feedback persists:**
- Add explicit outbound frame filtering in `receive_inbound_audio()`
- Verify `stream_track="inbound_track"` is honored

**If greeting loops:**
- Add flag to prevent multiple greeting triggers
- Ensure `TextFrame("Hello...")` only queued once

### Priority 3: Clean Up & Document
**Goal:** Remove old Pipecat Telnyx code, document new architecture

**Tasks:**
1. Remove unused imports (FastAPIWebsocketTransport, TelnyxFrameSerializer)
2. Update architecture docs
3. Add comments to custom handler code
4. Create diagram of new audio flow

## TEST PROTOCOL

After fixes, test by calling +61240675354:

**Test Script:**
1. Call the number
2. Wait for greeting
3. Say: "Hi Riley, I'm interested in solar panels"
4. Listen for intelligent response (should mention solar, not echo)
5. Ask: "What brands do you work with?"
6. Verify knowledge base is queried (should mention Fronius, Sungrow)
7. Say goodbye and hang up

**Success Criteria:**
- ✅ Call answers within 2 seconds
- ✅ Greeting plays once clearly
- ✅ User can speak and be heard
- ✅ Agent responds intelligently (not echoing self)
- ✅ Audio quality is clear (16kHz)
- ✅ No loops or repetition
- ✅ Knowledge base queries work
- ✅ Natural conversation flow

## IMPORTANT CONTEXT

- User is in Bali, testing Australian numbers
- Target customer: Josh (solar installer) - this is the demo use case
- Agent persona: Riley (helpful Australian receptionist)
- Business goal: Sub-700ms response latency, under $0.25/call cost
- User preference: Fix properly once, not temporary workarounds

## ARCHITECTURE DIAGRAMS

### Current Call Flow:
```
User dials +61240675354
  ↓
Telnyx receives call
  ↓
Webhook POST → /api/telnyx/webhook (call.initiated)
  ↓
Webhook returns 200 OK immediately
  ↓
Async: POST /v2/calls/{id}/actions/answer
  - stream_url: wss://.../ws/media-stream/{call_control_id}
  - stream_track: inbound_track
  - stream_codec: L16
  - stream_bidirectional_codec: L16
  - stream_bidirectional_sampling_rate: 16000
  ↓
Telnyx connects to WebSocket
  ↓
/ws/media-stream/{call_control_id} accepts connection
  ↓
Custom handler starts:
  - receive_inbound_audio() coroutine
  - send_outbound_audio() coroutine
  - Pipeline runner (STT → LLM → TTS)
  ↓
Pipeline queues StartFrame + TextFrame("Hello! How can I help you today?")
  ↓
Conversation begins
```

### Audio Processing Pipeline:
```
Telnyx WS (L16 16kHz)
  ↓
receive_inbound_audio()
  - Parse JSON message
  - Base64 decode payload
  - Resample if needed (to 16kHz)
  ↓
InputAudioRawFrame(audio, sample_rate=16000)
  ↓
TelnyxAudioInputProcessor
  ↓
DeepgramSTTService (16kHz)
  ↓
TranscriptionFrame
  ↓
TranscriptionToTextProcessor
  ↓
TextFrame
  ↓
MultiProviderLLM (Gemini 2.5 Flash)
  ↓
TextFrame (response)
  ↓
MultiProviderTTS (Cartesia Sonic 3)
  ↓
AudioRawFrame (16kHz)
  ↓
TelnyxAudioOutputProcessor
  ↓
audio_out_queue
  ↓
send_outbound_audio()
  - Resample if needed (to 16kHz)
  - Base64 encode
  - JSON wrap: {"event": "media", "media": {"payload": "..."}}
  ↓
Telnyx WS → User hears audio
```

## CREDENTIALS & ACCESS

### Telnyx:
- API Key: `[See .env file]`
- Connection ID: `2889961366351775467`
- Phone Number: `+61240675354`
- Webhook URL: `https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook`

### Database:
- URL: `postgresql://spotfunnel:dev@localhost:5432/spotfunnel`
- Container: `spotfunnel-postgres`
- Status: Healthy

### API Keys:
All API keys are stored in `voice-core/.env` file (not committed to git)

## MONITORING & DEBUGGING

### Server Logs:
- **Location:** Terminal running uvicorn (PID 34108)
- **Key patterns to grep:**
  - `Telnyx WS` - WebSocket messages
  - `STT` - Transcription events
  - `LLM` - LLM responses
  - `TTS` - TTS generation
  - `ERROR` - Any errors

### Telnyx Dashboard:
- https://portal.telnyx.com/
- Check call logs for:
  - Call duration
  - Audio codec used
  - Webhook delivery status

### Database Queries:
```sql
-- Check prompts
SELECT * FROM prompts WHERE tenant_id = 'riley_solar_demo';

-- Check knowledge bases
SELECT * FROM knowledge_bases WHERE tenant_id = 'riley_solar_demo';

-- Check call logs (if implemented)
SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 10;
```

## KNOWN GOTCHAS

1. **ngrok URL changes:** If ngrok restarts, update Telnyx webhook URL
2. **Database migrations:** Run migrations before testing if schema changed
3. **Port conflicts:** Check port 8000 is free before starting uvicorn
4. **Cartesia credits:** User topped up recently, should be good
5. **Pipecat deprecation warnings:** Ignore them, they're about old module paths

## QUICK START CHECKLIST

Before testing:
- [ ] Database running (`docker ps | grep spotfunnel-postgres`)
- [ ] Uvicorn running on port 8000 (`netstat -ano | findstr :8000`)
- [ ] ngrok running and forwarding to 8000
- [ ] Telnyx webhook URL matches ngrok URL
- [ ] .env file has all API keys

To test:
- [ ] Call +61240675354
- [ ] Listen for greeting
- [ ] Speak to Riley
- [ ] Check logs for errors
- [ ] Verify no audio feedback

## FILES MODIFIED (This Session)

1. `voice-core/src/bot_runner.py`
   - Removed Pipecat Telnyx transport
   - Added custom WebSocket handler
   - Added audio input/output processors
   - Added receive/send coroutines

2. `voice-core/src/api/telnyx_webhook.py`
   - Updated answer payload to request L16 16kHz
   - Removed stream_start function (redundant)

3. `voice-core/docs/SESSION_HANDOFF.md` (this file)
   - Created comprehensive handoff document

## NEXT STEPS FOR NEW SESSION

1. **Immediate:** Test the custom Telnyx handler
   - Call +61240675354
   - Verify L16 16kHz works
   - Check for audio feedback
   - Confirm greeting plays once

2. **If successful:** Clean up and document
   - Remove old Pipecat imports
   - Add code comments
   - Update architecture docs

3. **If issues:** Debug and fix
   - Check Telnyx logs
   - Add more logging to handler
   - Fall back to PCMU if L16 rejected

4. **Then:** Optimize and enhance
   - Measure latency
   - Add error handling
   - Implement graceful degradation
   - Add monitoring/metrics

## CONTACT & SUPPORT

- **User:** Leo (in Bali, testing from Australia)
- **Timezone:** WITA (UTC+8)
- **Communication:** Via Cursor chat
- **Preferred style:** Direct, technical, no fluff

---

**Last Updated:** 2026-02-09 20:30 WITA
**Session ID:** 8a (custom Telnyx handler implementation)
**Status:** Ready for testing
