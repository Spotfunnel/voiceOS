# Stress Test Current State - End of Day Summary

**Date**: 2026-02-07  
**Status**: Debugging in progress - Ready to fix tomorrow  
**Blocker**: StartFrame propagation issue preventing agent responses

## Current System State

### ✅ What's Working

1. **Telnyx Integration**
   - ✅ WebSocket connection established
   - ✅ Raw Telnyx messages received and logged
   - ✅ `LoggingTelnyxFrameSerializer` successfully parsing `InputAudioRawFrame` objects
   - ✅ Telnyx `start` event being sent by test harness
   - ✅ Media frames (audio) being sent to server

2. **Test Harness (Synthetic Caller)**
   - ✅ Anthropic API generating adversarial prompts
   - ✅ Direct Cartesia TTS API converting text to audio
   - ✅ Audio being encoded as u-law and sent via WebSocket
   - ✅ Fallback for empty Anthropic responses (`"Hello?"`)
   - ✅ Turn-taking fixed (agent responses appended as "user" messages)

3. **Pipeline Instrumentation**
   - ✅ Comprehensive logging added to all pipeline stages:
     - Transport/serializer logging
     - STT input/output logging
     - LLM input/output logging
     - TTS input/output logging
     - Frame observer logging
     - MultiASR logging

4. **Database & Backend**
   - ✅ Migrations run successfully
   - ✅ Test tenant created with phone number `+61478737917`
   - ✅ Call log contexts and event forwarding registered
   - ✅ FastAPI server running on port 8000

### ❌ What's Not Working

1. **Agent Not Responding**
   - ❌ No STT transcription output
   - ❌ No LLM processing
   - ❌ No TTS audio generation
   - ❌ Pipeline processors rejecting all audio frames

2. **Root Cause Identified**
   - **Error**: `MultiASRProcessor#0 Trying to process StartFrame#0 but StartFrame not received yet`
   - **Reason**: `FastAPIWebsocketInputTransport` consumes `StartFrame` for initialization but doesn't propagate it downstream
   - **Impact**: All processors have `__started = False`, causing `_check_started()` to reject frames

## Diagnosis Journey

### Phase 1: Initial Setup (Completed)
- ✅ Set up synthetic caller with Cartesia TTS
- ✅ Integrated with Telnyx webhook simulation
- ✅ Fixed `dotenv` loading for API keys

### Phase 2: API Communication (Completed)
- ✅ Fixed Anthropic empty responses (turn-taking issue)
- ✅ Added detailed request/response logging for Anthropic and Cartesia
- ✅ Implemented fallback for empty adversarial text

### Phase 3: Pipeline Observability (Completed)
- ✅ Added logging to `PipelineFrameObserver`
- ✅ Added logging to `MultiProviderLLM`
- ✅ Added logging to `STTWithFallback`
- ✅ Added logging to `MultiProviderTTS`
- ✅ Added logging to `MultiASRProcessor`
- ✅ Created `LoggingTelnyxFrameSerializer` for transport logging

### Phase 4: StartFrame Investigation (Current)
- ✅ Confirmed `InputAudioRawFrame` objects are being parsed
- ✅ Identified that processors never receive `StartFrame`
- ✅ Traced issue to `FastAPIWebsocketInputTransport` not propagating `StartFrame`
- ✅ Designed fix: Option 3 (inject `StartFrame` manually before audio processing)

## The Fix (Ready to Implement Tomorrow)

### File 1: `voice-core/src/processors/multi_asr_processor.py`

**Add** `await super().process_frame(frame, direction)` at the top of `process_frame()`:

```python
async def process_frame(self, frame: Frame, direction):
    await super().process_frame(frame, direction)  # ADD THIS LINE
    
    if isinstance(frame, AudioRawFrame):
        print(
            f"MultiASR received audio frame: {len(frame.audio)} bytes (sample_rate={frame.sample_rate})"
        )
        # ... rest of existing code
```

### File 2: `voice-core/src/bot_runner.py`

**Add** `StartFrame` injection after line 825 (after `PipelineTask` creation):

```python
task = PipelineTask(pipeline)
runner = PipelineRunner(handle_sigint=False)

# Inject StartFrame before audio processing begins
from pipecat.frames.frames import StartFrame
start_frame = StartFrame(
    allow_interruptions=True,
    audio_in_sample_rate=8000,   # Telnyx uses 8kHz mulaw
    audio_out_sample_rate=8000,
    enable_metrics=False,
    enable_usage_metrics=False,
    report_only_initial_ttfb=False,
)
await task.queue_frame(start_frame)

active_calls[call_id] = ActiveCall(
    task=task,
    pipeline=pipeline,
    runner=runner,
    transport="telnyx",
    call_sid=call_control_id,
)

try:
    await runner.run(task)
finally:
    active_calls.pop(call_id, None)
```

## Test Command (Tomorrow)

```bash
cd voice-core
python -m tests.telnyx_webhook_synthetic_stress_test
```

**Expected Results After Fix**:
- ✅ STT logs showing audio processing and transcriptions
- ✅ Gemini logs showing LLM input/output
- ✅ Cartesia logs showing TTS audio generation
- ✅ Agent responses delivered to synthetic caller
- ✅ Full conversation transcript logged

## Environment Configuration

### API Keys Configured (in `.env`)
- ✅ `ANTHROPIC_API_KEY` (row 32)
- ✅ `CARTESIA_API_KEY` (row 21)
- ✅ `TELNYX_API_KEY` (row 35)
- ✅ `DEEPGRAM_API_KEY`
- ✅ `GOOGLE_API_KEY` (Gemini)
- ✅ `OPENAI_API_KEY` (GPT-4.1 fallback)

### Test Configuration
- **Target Phone**: `+61478737917`
- **Concurrency**: `1` (for focused debugging)
- **Test Tenant**: Created with objective graph config
- **Ngrok**: Running on port 8000 (webhook URL needs updating for production)

## LLM Stack (Confirmed)
- **STT**: Deepgram Nova 3 (primary)
- **LLM**: Gemini 2.5 Flash (primary), GPT-4.1 (fallback)
- **TTS**: Cartesia Sonic 3 (primary), ElevenLabs (fallback)

## Pending Tasks (After Fix)

1. **Latency Optimization** (TODO in plan)
   - Target: <3s first response, <2s turn-taking
   - Currently: 10-30s (unacceptable for production)

2. **Scale Up Stress Tests**
   - Start with concurrency 2
   - Scale to 5, then 10
   - Monitor for rate limiting and errors

3. **Evaluator Integration**
   - Assess conversation quality
   - Identify failure patterns
   - Generate stress test report

4. **Production Readiness**
   - Update ngrok webhook to real domain
   - Run full automated stress test suite
   - Complete remaining items in `LAUNCH_READINESS_PLAN.md`

## Files Modified Today

### Core Pipeline Files
- `voice-core/src/bot_runner.py` - Added `LoggingTelnyxFrameSerializer`, event forwarding
- `voice-core/src/pipeline/frame_observer.py` - Added detailed frame logging
- `voice-core/src/pipeline/objective_graph_pipeline.py` - Added STT logging
- `voice-core/src/pipeline/voice_pipeline.py` - Added STT logging
- `voice-core/src/processors/multi_asr_processor.py` - Added audio frame logging
- `voice-core/src/llm/multi_provider_llm.py` - Added LLM input/output logging
- `voice-core/src/tts/multi_provider_tts.py` - Added TTS input logging
- `voice-core/src/tts/cartesia_tts.py` - Fixed stub check, `FrameDirection`, async generator handling
- `voice-core/src/tts/elevenlabs_tts.py` - Same fixes as Cartesia

### Test Files
- `voice-core/tests/telnyx_webhook_synthetic_stress_test.py` - Major refactor:
  - Added `load_dotenv(".env")` at top
  - Direct Cartesia TTS API via `_cartesia_tts_bytes()`
  - Increased listen timeout to 30s
  - Fallback for empty adversarial text
  - Fixed Anthropic turn-taking (agent responses as "user" messages)
  - Added `_send_telnyx_start()` function
  - Added media frame logging
  - Set concurrency to 1 for debugging

### API Files
- `voice-core/src/api/stress_test.py` - Added detailed Anthropic logging

## Documentation Files Created
- `STARTFRAME_FIX_PLAN.md` - Complete implementation plan for tomorrow
- `STRESS_TEST_CURRENT_STATE.md` - This file

## Git Status

**Branch**: `backup-before-ui-integration`

**Modified Files**: 235+ files (mostly documentation and config updates)

**Untracked Files**: Many new files including:
- Stress test scripts
- Authentication system
- Admin portal components
- Migration files
- Documentation

**Ready for Commit**: Yes, all work is saved locally

## Next Session Checklist

1. [ ] Read `STARTFRAME_FIX_PLAN.md`
2. [ ] Implement the two-file fix
3. [ ] Restart FastAPI server
4. [ ] Run single-call stress test
5. [ ] Verify agent responses in logs
6. [ ] Scale up to concurrency 5
7. [ ] Run full stress test suite
8. [ ] Generate stress test report

## Key Learnings

1. **Pipecat Architecture**: Processors require `StartFrame` to initialize before accepting any frames
2. **Transport Behavior**: `FastAPIWebsocketInputTransport` doesn't propagate `StartFrame` downstream
3. **Debugging Strategy**: Systematic logging at each pipeline stage revealed the exact blocker
4. **Test Harness Design**: Direct API calls (Cartesia, Anthropic) are more reliable than Pipecat wrappers for synthetic callers

## Contact Info for Tomorrow

- **Test Script**: `voice-core/tests/telnyx_webhook_synthetic_stress_test.py`
- **Server**: `uvicorn src.bot_runner:app --host 0.0.0.0 --port 8000`
- **Ngrok**: `ngrok http 8000` (already running)
- **Logs**: Server terminal shows all pipeline logging

---

**All work saved. Ready to resume tomorrow.** ✅
