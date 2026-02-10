# Voice AI - Minimal (Telnyx Edition)

A **simple, working** voice AI receptionist using Telnyx for telephony.

## Architecture

```
USER CALLS +61240675354
    ↓
Telnyx (Phone network)
    ↓
Telnyx WebSocket (LINEAR16, 16kHz)
    ↓
Deepgram STT (nova-3, en-AU)
    ↓
Gemini 2.5 Flash LLM
    ↓
Cartesia TTS (sonic-3, Australian voice)
    ↓
Telnyx WebSocket (LINEAR16, 16kHz)
    ↓
USER HEARS RESPONSE
```

## Setup

1. **Install dependencies:**
   ```bash
   pip install telnyx websockets
   ```

2. **Configure environment:**
   Your `.env` already has:
   - TELNYX_API_KEY
   - TELNYX_PHONE_NUMBER: +61240675354
   - NGROK_URL: https://antrorse-fluently-beulah.ngrok-free.dev

3. **Start ngrok** (if not already running):
   ```bash
   ngrok http 8000
   ```

4. **Configure Telnyx webhook:**
   - Go to https://portal.telnyx.com/#/app/call-control/applications
   - Set webhook URL to: `https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook`
   - Assign your phone number (+61240675354) to this application

5. **Run the server:**
   ```bash
   python bot_runner_telnyx.py
   ```

## Test It

1. **Call your Telnyx number:**
   ```
   Call +61240675354 from any phone
   ```

2. **What happens:**
   - Telnyx sends webhook event to `/api/telnyx/webhook`
   - Server answers call
   - Server starts media stream WebSocket
   - Pipeline runs: STT → LLM → TTS
   - You hear "Hi! This is SpotFunnel. How can I help you today?"
   - Start talking!

## Debugging

**If call doesn't connect:**
```bash
# Check server logs
python bot_runner_telnyx.py

# You should see:
# "Incoming call from +61... to +61240675354"
# "Answered call call_..."
# "Started media stream for call_..."
# "WebSocket connected for call call_..."
```

**If audio doesn't work:**
- Check: LINEAR16 encoding, 16kHz sample rate
- Check: Telnyx media stream URL is correct
- Check: ngrok URL matches NGROK_URL in .env

**If LLM doesn't respond:**
- Run: `python test_pipeline.py` (should pass)
- Check: Gemini API key is valid

## Cost Per Call (5 minutes)

- Telnyx: ~$0.02 (incoming call)
- Deepgram STT: ~$0.02
- Gemini LLM: ~$0.01
- Cartesia TTS: ~$0.02
- **Total: ~$0.07 per call**

## What's Different from Daily.co Version

**Removed:**
- ❌ Daily.co transport
- ❌ Daily.co room/token management
- ❌ daily-python dependency

**Added:**
- ✅ Telnyx webhook handler
- ✅ Telnyx WebSocket audio streaming
- ✅ LINEAR16 audio format handling
- ✅ Call Control API integration

**Same:**
- ✅ STT → LLM → TTS pipeline
- ✅ Deepgram Nova-3
- ✅ Gemini 2.5 Flash
- ✅ Cartesia Sonic-3
- ✅ Australian English

## Next Steps

Once this works:
1. Test 10+ calls to ensure stability
2. Add call logging (duration, transcript, cost)
3. Add error handling (retry logic, fallbacks)
4. Add multi-tenant support (if needed)
