# Voice Minimal - Complete Pipeline Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        DAILY.CO ROOM                             │
│  (User joins via browser/phone, speaks into microphone)         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Audio Stream (WebRTC)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSPORT INPUT                               │
│         (DailyTransport receives audio frames)                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ InputAudioRawFrame (PCM 16-bit, 16kHz)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DEEPGRAM STT SERVICE                            │
│  Model: nova-2                                                   │
│  Language: en-AU (Australian English)                            │
│  Endpointing: 300ms silence = end of speech                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ TranscriptionFrame ("I need a plumber")
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GEMINI LLM SERVICE                              │
│  Model: gemini-2.0-flash-exp                                     │
│  System Prompt: Receptionist instructions                        │
│  Context: Full conversation history                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ TextFrame ("No worries! What's your name?")
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CARTESIA TTS SERVICE                            │
│  Model: sonic-english                                            │
│  Voice: Friendly Australian female                               │
│  Sample Rate: 16kHz PCM                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ AudioRawFrame (PCM 16-bit, 16kHz)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSPORT OUTPUT                              │
│         (DailyTransport sends audio back)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Audio Stream (WebRTC)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DAILY.CO ROOM                             │
│           (User hears response in their browser/phone)           │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Component Breakdown

### 1. Transport Input (DailyTransport.input())
**Purpose:** Receive audio from Daily.co WebRTC connection

**Input:** Raw audio from microphone
**Output:** `InputAudioRawFrame`
- Format: PCM 16-bit
- Sample Rate: 16000 Hz
- Channels: 1 (mono)

---

### 2. STT Service (DeepgramSTTService)
**Purpose:** Convert speech to text

**Configuration:**
```python
DeepgramSTTService(
    api_key=DEEPGRAM_API_KEY,
    model="nova-2",           # Latest Deepgram model
    language="en-AU",         # Australian English
    sample_rate=16000,
    interim_results=True,     # Stream partial transcriptions
    smart_format=True,        # Auto-capitalize, punctuate
    punctuate=True,
    endpointing=300,          # 300ms silence = end of utterance
)
```

**Input:** `InputAudioRawFrame` (audio bytes)
**Output:** `TranscriptionFrame` (text string)

**Example Flow:**
- User speaks: "Hi, I need help with plumbing"
- STT outputs: TranscriptionFrame(text="Hi, I need help with plumbing")

---

### 3. LLM Service (GoogleLLMService - Gemini)
**Purpose:** Generate intelligent responses

**Configuration:**
```python
GoogleLLMService(
    api_key=GOOGLE_API_KEY,
    model="gemini-2.0-flash-exp",
    system_instruction=RECEPTIONIST_PROMPT,
)
```

**System Prompt:**
```
You are a friendly Australian receptionist for SpotFunnel.

YOUR JOB:
1. Greet the caller warmly
2. Find out why they're calling
3. Capture their name, email, and phone number
4. Confirm you'll have someone contact them

CONVERSATION STYLE:
- Sound human and natural (not robotic)
- Keep responses SHORT (1-2 sentences max)
- Ask ONE question at a time
...
```

**Input:** `TranscriptionFrame` (user's speech as text)
**Output:** `TextFrame` (agent's response text)

**Example Flow:**
- Input: "Hi, I need help with plumbing"
- LLM processes with full conversation context
- Output: TextFrame(text="No worries! I can help with that. What's your name?")

**Context Management:**
- Maintains full conversation history internally
- Each new message adds to context
- No external state management needed

---

### 4. TTS Service (CartesiaTTSService)
**Purpose:** Convert text responses to natural speech

**Configuration:**
```python
CartesiaTTSService(
    api_key=CARTESIA_API_KEY,
    voice_id="a0e99841-438c-4a64-b679-ae501e7d6091",  # Friendly female
    sample_rate=16000,
)
```

**Input:** `TextFrame` (agent's response text)
**Output:** `AudioRawFrame` (synthesized speech)

**Example Flow:**
- Input: TextFrame(text="No worries! What's your name?")
- TTS synthesizes natural speech
- Output: AudioRawFrame(audio=<bytes>, sample_rate=16000)

---

### 5. Transport Output (DailyTransport.output())
**Purpose:** Send audio back to Daily.co

**Input:** `AudioRawFrame` (synthesized speech)
**Output:** WebRTC audio stream to user's browser/phone

---

## Key Differences from voice-core

| Feature | voice-minimal | voice-core (complex) |
|---------|---------------|---------------------|
| **Pipeline Length** | 5 components | 15+ components |
| **Fallback Logic** | None (fail fast) | Multi-provider fallbacks |
| **Circuit Breakers** | None | Yes (3 levels) |
| **State Management** | LLM internal only | External state machines |
| **Observers** | None | Frame observers, event emitters |
| **Cost Tracking** | None | Per-call cost breakdown |
| **Error Handling** | Python exceptions | Custom error handlers |
| **Debugging** | Simple logs | Distributed tracing |

## What Happens When Something Breaks

### voice-minimal (GOOD for debugging):
```
ERROR: Deepgram STT failed: Invalid API key
Traceback (most recent call last):
  File "minimal_pipeline.py", line 85, in _create_stt_service
    return DeepgramSTTService(api_key=self.deepgram_api_key, ...)
                              ^^^^^^^^^^^^
pipecat.services.deepgram.DeepgramError: 401 Unauthorized
```
**You know EXACTLY what broke: Invalid Deepgram API key**

### voice-core (BAD for debugging):
```
ERROR: STTWithFallback: Primary failed, trying fallback...
WARNING: MultiASRProcessor: Deepgram vote: None
INFO: CircuitBreaker: Opening circuit for provider 'deepgram'
ERROR: AllSTTProvidersFailed: No providers available
ERROR: PipelineErrorHandler: STT failure, playing fallback message
INFO: TelnyxFallback: Transferring call to support...
```
**You have NO IDEA what actually broke - lost in 5 layers of abstraction**

## Total Latency Breakdown (voice-minimal)

**Target: < 1000ms end-to-end**

```
User finishes speaking
       ↓
   [~50ms]    Endpointing (STT detects silence)
       ↓
   [~200ms]   Deepgram transcription
       ↓
   [~300ms]   Gemini LLM response generation
       ↓
   [~150ms]   Cartesia TTS synthesis (first chunk)
       ↓
   [~100ms]   Network + audio buffering
       ↓
User hears first word
─────────────────────
Total: ~800ms (P50)
```

**Critical Path:**
- STT → LLM → TTS → Output
- No parallel processing (intentionally simple)
- No pre-generation or caching
- No optimization tricks

**This is GOOD for debugging:**
- Easy to measure each stage
- Easy to identify bottlenecks
- Easy to test components individually

## Frame Types Reference

```python
# Audio frames (binary)
InputAudioRawFrame(audio=bytes, sample_rate=16000, num_channels=1)
AudioRawFrame(audio=bytes, sample_rate=16000, num_channels=1)

# Text frames
TranscriptionFrame(text="user spoke this", user_id="user")
TextFrame(text="agent responds this")

# Control frames
StartFrame()  # Pipeline initialization
EndFrame()    # Pipeline shutdown
```

## Testing Individual Components

### Test STT Only:
```python
from pipecat.services.deepgram import DeepgramSTTService
stt = DeepgramSTTService(api_key="...", model="nova-2", language="en-AU")
# Send audio → get TranscriptionFrame
```

### Test LLM Only:
```python
from minimal_pipeline import test_llm
test_llm()  # Sends "Hi, I need help with plumbing" → prints response
```

### Test TTS Only:
```python
from pipecat.services.cartesia import CartesiaTTSService
tts = CartesiaTTSService(api_key="...", voice_id="...")
# Send TextFrame → get AudioRawFrame
```

### Test Full Pipeline:
```python
python bot_runner.py  # Start server
curl -X POST http://localhost:8000/start_call ...  # Start call
# Join Daily.co room and talk
```

## Cost Per Component (Estimated)

**5-minute conversation:**
- STT (Deepgram): ~$0.020 (5 min × $0.004/min)
- LLM (Gemini): ~$0.010 (500 tokens × $0.00002/token)
- TTS (Cartesia): ~$0.018 (500 chars × $0.000037/char)

**Total: ~$0.05 per 5-minute call**

Much cheaper than voice-core's multi-provider approach (which runs parallel transcriptions, fallbacks, etc.)
