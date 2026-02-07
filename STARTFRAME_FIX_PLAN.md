# StartFrame Propagation Fix - Implementation Plan

**Status**: Ready to implement (saved for tomorrow)  
**Date**: 2026-02-07  
**Priority**: CRITICAL - Blocking agent responses in stress tests

## Problem Summary

The agent is not responding during synthetic stress tests because the Pipecat pipeline processors are rejecting all audio frames with the error:

```
MultiASRProcessor#0 Trying to process StartFrame#0 but StartFrame not received yet
```

### Root Cause Analysis

1. **Transport doesn't propagate StartFrame**: `FastAPIWebsocketInputTransport` consumes the `StartFrame` for its own initialization but doesn't push it downstream into the pipeline.

2. **Processors require StartFrame**: All Pipecat `FrameProcessor` instances have an internal `__started` flag that is only set to `True` when they receive a `StartFrame`. Until this flag is set, the `_check_started()` method rejects all frames.

3. **MultiASRProcessor doesn't call super()**: The `MultiASRProcessor.process_frame()` method doesn't call `await super().process_frame(frame, direction)`, so even if a `StartFrame` were sent, it wouldn't be processed correctly.

### Evidence from Logs

- ✅ Raw Telnyx WebSocket messages are being received
- ✅ `LoggingTelnyxFrameSerializer` successfully parses `InputAudioRawFrame` objects
- ❌ No STT transcription output logs
- ❌ No LLM input/output logs
- ❌ No TTS audio generation logs
- ❌ Repeated "StartFrame not received yet" errors

## Solution: Option 3 - Inject StartFrame Before Audio Processing

### Implementation Steps

#### 1. Fix MultiASRProcessor to Accept StartFrame

**File**: `voice-core/src/processors/multi_asr_processor.py`

**Change**: Add `await super().process_frame(frame, direction)` at the top of `process_frame()` method.

**Why**: This ensures that system frames (like `StartFrame`) are properly handled by the base `FrameProcessor` class, which sets the internal `__started` flag.

**Code Location**: Line 81 in `process_frame()` method

```python
async def process_frame(self, frame: Frame, direction):
    # ADD THIS LINE FIRST:
    await super().process_frame(frame, direction)
    
    # Then existing logic:
    if isinstance(frame, AudioRawFrame):
        print(
            f"MultiASR received audio frame: {len(frame.audio)} bytes (sample_rate={frame.sample_rate})"
        )
        # ... rest of existing code
```

#### 2. Inject StartFrame in bot_runner.py

**File**: `voice-core/src/bot_runner.py`

**Change**: Manually inject a `StartFrame` into the pipeline task immediately after starting the runner, before any audio frames are processed.

**Location**: In the `telnyx_media_stream()` function, after line 825 where `PipelineTask` is created.

**Code to Add** (after line 825):

```python
task = PipelineTask(pipeline)
runner = PipelineRunner(handle_sigint=False)

# Inject StartFrame before audio processing begins (Option 3)
from pipecat.frames.frames import StartFrame
start_frame = StartFrame(
    allow_interruptions=True,
    audio_in_sample_rate=8000,   # Telnyx uses 8kHz mulaw
    audio_out_sample_rate=8000,  # Telnyx uses 8kHz mulaw
    enable_metrics=False,
    enable_usage_metrics=False,
    report_only_initial_ttfb=False,
)
# Queue StartFrame before runner starts
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

**Why This Works**:
- `PipelineTask` has a `_push_queue` that buffers frames before the pipeline starts processing
- By calling `task.queue_frame(start_frame)` before `runner.run(task)`, we ensure the `StartFrame` is the first frame processed
- This matches the internal behavior of `PipelineTask._process_push_queue()` which normally creates and queues its own `StartFrame`, but in our case the transport doesn't propagate it downstream

#### 3. Optional: Add StartFrame Guard (Recommended)

To prevent duplicate `StartFrame` issues if Pipecat's internal logic changes, add a guard in `MultiASRProcessor`:

```python
async def process_frame(self, frame: Frame, direction):
    await super().process_frame(frame, direction)
    
    # ADD THIS GUARD:
    if isinstance(frame, StartFrame):
        # Let StartFrame propagate downstream without buffering
        await self.push_frame(frame, direction)
        return
    
    if isinstance(frame, AudioRawFrame):
        # ... existing code
```

## Testing Plan

### Test Script

**File**: `voice-core/tests/telnyx_webhook_synthetic_stress_test.py`

**Command**:
```bash
cd voice-core
python -m tests.telnyx_webhook_synthetic_stress_test
```

**Configuration**: Already set to `num_concurrent=1` for focused debugging.

### Expected Results After Fix

1. **Server logs should show**:
   - ✅ `STT input audio frame: X bytes (sample_rate=8000)`
   - ✅ `STT transcription output: 'Hello?'` (or adversarial text)
   - ✅ `LLM received context frame: OpenAILLMContextFrame`
   - ✅ `Gemini output text: '...'` (agent response)
   - ✅ `TTS input text: '...'`
   - ✅ `TTS audio generated: X bytes`

2. **Test harness logs should show**:
   - ✅ Adversarial prompts being generated
   - ✅ Cartesia TTS converting prompts to audio
   - ✅ Media frames being sent to WebSocket
   - ✅ Agent responses being received and logged

3. **No more errors**:
   - ❌ No "StartFrame not received yet" errors
   - ❌ No "no close frame received or sent" warnings

### Success Criteria

- [ ] Single-call test completes without errors
- [ ] Agent responds to at least 3 out of 5 adversarial turns
- [ ] Full conversation transcript is logged
- [ ] Evaluator can assess conversation quality

## Files to Modify

1. `voice-core/src/processors/multi_asr_processor.py` - Add `super().process_frame()` call
2. `voice-core/src/bot_runner.py` - Inject `StartFrame` before `runner.run()`

## Rollback Plan

If the fix causes issues:

1. **Remove the `super().process_frame()` call** from `MultiASRProcessor`
2. **Remove the `StartFrame` injection** from `bot_runner.py`
3. **Revert to previous commit** if needed

## Next Steps After This Fix

Once agent responses are working:

1. ✅ Verify STT accuracy with adversarial speech
2. ✅ Test LLM context handling across multiple turns
3. ✅ Measure response latency (target: <3s first response, <2s turn-taking)
4. ✅ Scale up to concurrency level 5, then 10
5. ✅ Run full stress test suite with evaluator

## Related Context

- **Previous debugging**: Added extensive logging across pipeline (STT, LLM, TTS, frame observer, serializer)
- **Telnyx integration**: WebSocket transport is working, audio frames are being parsed correctly
- **Anthropic turn-taking fix**: Already implemented (agent responses appended as "user" messages)
- **Test harness improvements**: Synthetic caller audio streaming via direct Cartesia API

## References

- Pipecat `FrameProcessor._check_started()`: Line 764 in `frame_processor.py`
- Pipecat `PipelineTask._process_push_queue()`: Line 577 in `task.py`
- `FastAPIWebsocketInputTransport.start()`: Line 225 in `fastapi.py`
- Previous conversation transcript: `C:\Users\leoge\.cursor\projects\c-Users-leoge-OneDrive-Documents-AI-Activity-Cursor-VoiceAIProduction\agent-transcripts\761ccefd-b03f-4ba8-bcfd-d4f90b4b291d.txt`

---

**Ready to implement tomorrow** ✅
