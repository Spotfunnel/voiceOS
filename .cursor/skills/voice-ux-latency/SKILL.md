# Voice UX Constraints & Latency Targets

Prevents 40% higher call abandonment from latency >1 second. Production data shows users hang up when response times exceed 800ms. This skill enforces sub-500ms latency targets and proper turn-taking for natural conversation flow.

## Why This Skill Matters

- **Call abandonment**: 40% higher when latency >1 second
- **User perception**: >800ms feels "slow" and "broken"
- **Natural conversation**: Human turn-taking expectations <500ms
- **Australian accent**: Requires different VAD tuning (rising intonation)

## Latency Targets (Non-Negotiable)

### End-to-End Turn Latency
**Target**: P50 <500ms, P95 <800ms

**Measurement**: User stops speaking → Agent starts speaking

**Component Breakdown**:
- STT (Speech-to-Text): 150ms target
- LLM TTFT (Time to First Token): 200-500ms target
- TTS TTFB (Time to First Byte): 100-150ms target
- Network overhead: 50-100ms

**Total Sequential**: Would be 6+ seconds (unacceptable)
**Solution**: Streaming + parallel execution

```python
# ✅ CORRECT: Streaming with parallel execution
async def process_turn(audio_stream):
    # STT streams partials immediately (<100ms for first words)
    stt_partials = stt.stream_transcribe(audio_stream)
    
    # LLM processes partials in parallel (not after STT completes)
    async for partial in stt_partials:
        if partial.is_final:
            # LLM generates tokens (streaming, not batch)
            llm_response = llm.stream(partial.text)
            
            # TTS speaks early tokens while later tokens generate
            async for token in llm_response:
                await tts.speak(token)  # Parallel, not sequential

# ❌ INCORRECT: Sequential processing
def process_turn_sequential(audio):
    transcript = stt.transcribe(audio)  # Wait 2-3s
    response = llm.generate(transcript)  # Wait 1-2s
    audio = tts.synthesize(response)  # Wait 1-2s
    # Total: 6+ seconds ❌
```

### Streaming Architecture Requirements

1. **STT streams partial transcripts immediately**
   - First words available <100ms
   - Don't wait for complete utterance

2. **LLM begins processing on partials**
   - Intent detection on partial transcripts
   - Generate early tokens while user still speaking

3. **TTS starts speaking early tokens**
   - Don't wait for complete LLM response
   - Stream audio as tokens generate

4. **Never use sequential pipeline**
   - Sequential adds latencies (STT + LLM + TTS = 6s)
   - Streaming overlaps work (target <500ms)

## Australian Accent VAD Tuning

### Rising Intonation Problem

**Issue**: Australian English uses rising intonation on statements (sounds like questions)

**Impact**: US VAD thresholds (150ms) cause premature interruptions

**Solution**: Tune for Australian accent (200-300ms)

```python
# ✅ CORRECT: Australian accent VAD configuration
vad_config = {
    "end_of_turn_threshold_ms": 250,  # 200-300ms for AU (vs 150ms US)
    "min_words_for_barge_in": 2,  # Prevent backchannel false positives
    "rising_intonation_aware": True,  # Don't treat statements as questions
    "model": "silero_v6.2"  # ML-based VAD (not naive silence timeout)
}

# ❌ INCORRECT: Using US VAD thresholds
vad_config = {
    "end_of_turn_threshold_ms": 150,  # Too short for AU accent
    "rising_intonation_aware": False  # Treats statements as questions
}
```

### Smart End-of-Utterance Detection

**Problem**: Naive silence timeout (1-1.5 seconds) wastes half the latency budget

**Solution**: ML-based VAD (Silero v6.2, Pipecat Smart Turn V3)

**Benefit**: Reduces detection from 1500ms to 150-200ms (saves 1-1.5 seconds per turn)

**Configuration by Use Case**:
- Standard conversation: 700ms
- Complex input (address, long response): 1500ms
- Fast back-and-forth: 500ms
- Australian accent: 200-300ms (not 150ms)

```python
# ✅ CORRECT: ML-based VAD with smart detection
from pipecat.vad.silero import SileroVADAnalyzer

vad = SileroVADAnalyzer(
    min_volume=0.6,
    end_of_turn_threshold_ms=250,  # Australian accent
    use_ml_detection=True  # Not naive silence timeout
)

# ❌ INCORRECT: Naive silence timeout
def is_turn_complete(silence_duration_ms):
    return silence_duration_ms > 1500  # Wastes 1.5 seconds
```

## Latency Monitoring

### Track Percentiles (Not Averages)

**Problem**: Averages hide tail latency (P95 spikes cause user abandonment)

**Solution**: Track P50, P95, P99 separately

```python
# ✅ CORRECT: Percentile tracking
latency_metrics = {
    "p50": calculate_percentile(latencies, 50),
    "p95": calculate_percentile(latencies, 95),
    "p99": calculate_percentile(latencies, 99)
}

# Alert if P95 > 800ms (users abandon)
if latency_metrics["p95"] > 800:
    alert("High latency detected - P95 exceeds 800ms")

# ❌ INCORRECT: Only tracking average
avg_latency = sum(latencies) / len(latencies)  # Hides spikes
```

### Component-Level Latency Breakdown

**Track each component separately**:
- STT latency
- LLM TTFT (time to first token)
- LLM completion latency
- TTS TTFB (time to first byte)
- Network overhead

**Why**: Identify bottlenecks (is it STT, LLM, or TTS causing slowness?)

```python
# ✅ CORRECT: Component-level tracking
async def track_turn_latency():
    start = time.time()
    
    stt_start = time.time()
    transcript = await stt.transcribe(audio)
    stt_latency = time.time() - stt_start
    
    llm_start = time.time()
    response = await llm.generate(transcript)
    llm_latency = time.time() - llm_start
    
    tts_start = time.time()
    audio = await tts.synthesize(response)
    tts_latency = time.time() - tts_start
    
    total_latency = time.time() - start
    
    # Log component breakdown
    emit_metric("latency.stt", stt_latency)
    emit_metric("latency.llm", llm_latency)
    emit_metric("latency.tts", tts_latency)
    emit_metric("latency.total", total_latency)
```

## Critical Rules (Non-Negotiable)

1. ✅ **P95 end-to-end turn latency MUST be <800ms** (P50 <500ms)
   - Alert if P95 exceeds 800ms
   - Users abandon calls when response >1 second

2. ❌ **Never use sequential processing for STT → LLM → TTS pipeline**
   - Sequential adds latencies (6+ seconds total)
   - Use streaming + parallel execution

3. ❌ **Never use fixed silence timeouts >300ms for end-of-utterance**
   - Naive 1-1.5s timeouts waste half the latency budget
   - Use ML-based VAD (Silero, Pipecat Smart Turn)

4. ✅ **Always track latency percentiles (P50, P95, P99)**
   - Never just averages (hides tail latency)
   - P95 spikes cause user abandonment

5. ✅ **Australian accent requires 200-300ms end-of-turn threshold**
   - Not 150ms US default (causes premature interruptions)
   - Rising intonation awareness enabled

## Barge-In Handling

### Minimum 2-Word Threshold

**Problem**: Single-word "um", "ah", "yeah" are backchannel (not interruptions)

**Solution**: Require 2+ words for barge-in

```python
# ✅ CORRECT: 2-word minimum for barge-in
def should_interrupt(transcript: str) -> bool:
    words = transcript.split()
    if len(words) < 2:
        return False  # Ignore backchannel
    return True

# ❌ INCORRECT: Interrupting on single word
def should_interrupt(transcript: str) -> bool:
    return len(transcript) > 0  # Interrupts on "um", "ah"
```

### Graceful Interruption

**When interrupted**:
1. Stop speaking immediately (don't finish sentence)
2. Save conversation state (don't lose context)
3. Resume from logical point (not restart)

```python
# ✅ CORRECT: Graceful interruption handling
async def handle_interruption():
    # Stop speaking immediately
    tts.stop()
    
    # Save state
    save_conversation_state({
        "last_objective": current_objective,
        "partial_capture": partial_value
    })
    
    # Listen to user
    new_input = await stt.listen()
    
    # Resume from logical point (not restart)
    if is_correction(new_input):
        await handle_correction()
    else:
        await resume_from_saved_state()
```

## Common Mistakes to Avoid

### ❌ Mistake 1: Using sequential processing
**Problem**: Adds latencies (STT + LLM + TTS = 6+ seconds)
**Solution**: Streaming + parallel execution (target <500ms)

### ❌ Mistake 2: Naive 1-1.5 second silence timeouts
**Problem**: Wastes half the latency budget
**Solution**: ML-based VAD (150-200ms detection)

### ❌ Mistake 3: Tracking only average latency
**Problem**: Hides P95 spikes that cause user abandonment
**Solution**: Track P50, P95, P99 separately

### ❌ Mistake 4: Using US VAD thresholds for Australian accent
**Problem**: Causes premature interruptions (rising intonation)
**Solution**: 200-300ms threshold for Australian accent

### ❌ Mistake 5: Not using streaming STT
**Problem**: Waiting for complete utterance adds 1-2 seconds
**Solution**: Stream partial transcripts immediately

## Production Metrics to Track

- **P50 latency**: <500ms (target), <700ms (acceptable), >700ms (alert)
- **P95 latency**: <800ms (target), <1000ms (acceptable), >1000ms (alert)
- **P99 latency**: <1200ms (target), <1500ms (acceptable), >1500ms (alert)
- **Streaming overhead**: <5% (async operations should add minimal latency)
- **Interruption accuracy**: >90% (correct barge-in vs backchannel detection)
- **VAD false positives**: <10% (premature end-of-turn detection)

## References

- Research: `research/02-audio-latency.md`, `research/01-turn-taking.md`
- Production evidence: 40% call abandonment when latency >1 second
- Australian accent: 200-300ms VAD threshold (vs 150ms US default)
- Streaming architecture: Reduces 6s sequential to <500ms parallel
