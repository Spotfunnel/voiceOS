# Voice AI - Minimal Working Version

A **simple, working** voice AI receptionist that actually completes conversations.

## What This Does

- ✅ Listens to caller (Deepgram STT)
- ✅ Responds intelligently (Gemini LLM)
- ✅ Speaks back clearly (Cartesia TTS)
- ✅ Captures name, email, phone naturally in conversation
- ✅ No crashes, no complexity, no bullshit

## Architecture (3 Files)

```
voice-minimal/
├── minimal_pipeline.py      # STT → LLM → TTS (120 lines)
├── bot_runner.py            # FastAPI server (180 lines)
├── receptionist_prompt.py   # Just the prompt (40 lines)
└── .env                     # Your API keys
```

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run the server:**
   ```bash
   python bot_runner.py
   ```

## Test It (Daily.co)

1. Get a Daily.co room: https://dashboard.daily.co
2. Create a room and get a token
3. Call the API:
   ```bash
   curl -X POST http://localhost:8000/start_call \
     -H "Content-Type: application/json" \
     -d '{
       "call_id": "test-001",
       "room_url": "https://your-domain.daily.co/your-room",
       "token": "your-token"
     }'
   ```
4. Join the room in your browser and talk to it

## What's Missing (Intentionally)

- ❌ No fallbacks (if Gemini fails, it fails - you'll see the error)
- ❌ No circuit breakers (simplicity over resilience)
- ❌ No multi-ASR (one STT provider = easier to debug)
- ❌ No knowledge bases (add later if it works)
- ❌ No state machines (conversation captures data naturally)
- ❌ No admin panel (focus on the core first)

## Next Steps (After This Works)

1. **Test thoroughly** - Make 10 calls, ensure it completes conversations
2. **Add Telnyx** - Only after Daily.co works perfectly
3. **Add fallbacks** - Only after you've seen real failures
4. **Add complexity** - Only when you need it

## Debugging

If it breaks:
- Check logs: All errors print to console
- Check API keys: Make sure .env is loaded
- Check audio: Daily.co should show audio levels
- Test LLM directly: `python -c "from minimal_pipeline import test_llm; test_llm()"`

## Cost Per Call (Estimated)

- STT (Deepgram): $0.02 for 5 min
- LLM (Gemini): $0.01 for 500 tokens
- TTS (Cartesia): $0.02 for 500 chars
- **Total: ~$0.05 per 5-minute call**
