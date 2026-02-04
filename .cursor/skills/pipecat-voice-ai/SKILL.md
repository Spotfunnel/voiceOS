# Pipecat Voice AI Development Skill

Build production-grade voice AI agents using Pipecat framework with frame-based architecture, multi-ASR voting, and Australian accent optimization.

## Core Principles

1. **Frame-Based Architecture**: All audio processing flows through immutable frame processors (STT → LLM → TTS)
2. **Pipeline Composition**: Build voice agents by composing frame processors into pipelines
3. **Non-Blocking**: All operations are async, never block the audio pipeline
4. **State Machines**: Use explicit FSMs for conversation flow, bounded LLM control

## Pipecat Frame Processing Pattern

### Frame Types
```python
# Audio frames (raw audio data)
AudioRawFrame(audio: bytes, sample_rate: int, num_channels: int)

# Transcription frames (from STT)
TranscriptionFrame(text: str, user_id: str, timestamp: str)

# LLM frames (text to be spoken)
TextFrame(text: str)

# TTS frames (synthesized audio)
TTSAudioFrame(audio: bytes, sample_rate: int)

# Control frames
StartFrame()  # Start processing
EndFrame()    # End processing
CancelFrame() # Cancel current operation
```

### Pipeline Construction
```python
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask

# Build pipeline: STT → LLM → TTS
pipeline = Pipeline([
    transport.input(),           # Audio input (Daily.co, Twilio, etc.)
    stt,                        # Speech-to-text (Deepgram, AssemblyAI)
    llm,                        # Language model (OpenAI, Anthropic)
    tts,                        # Text-to-speech (ElevenLabs, Cartesia)
    transport.output(),         # Audio output
])

# Run pipeline
task = PipelineTask(pipeline)
runner = PipelineRunner()
await runner.run(task)
```

## Multi-ASR Voting for Australian Accent

### Why Multi-ASR
- Single ASR systems show 15-20% lower accuracy on Australian English
- Multi-ASR with LLM ranking achieves 75-85% accuracy (vs 60-65% single)
- Critical for email/phone capture where accuracy matters

### Implementation Pattern
```python
class MultiASRProcessor(FrameProcessor):
    """Vote between 3 ASR systems using LLM ranking"""
    
    def __init__(self, asr_systems: List[ASRService], llm: LLMService):
        self.asr_systems = asr_systems  # [Deepgram, AssemblyAI, GPT-4o-audio]
        self.llm = llm
        
    async def process_frame(self, frame: Frame) -> AsyncIterator[Frame]:
        if isinstance(frame, AudioRawFrame):
            # Transcribe with all 3 ASR systems in parallel
            transcripts = await asyncio.gather(*[
                asr.transcribe(frame.audio) for asr in self.asr_systems
            ])
            
            # LLM ranks transcripts
            prompt = f"""Given these 3 transcripts of Australian speech:
            1. Deepgram: {transcripts[0]}
            2. AssemblyAI: {transcripts[1]}
            3. GPT-4o: {transcripts[2]}
            
            Which is most likely correct? Return ONLY the number (1, 2, or 3)."""
            
            choice = await self.llm.generate(prompt)
            best_transcript = transcripts[int(choice) - 1]
            
            yield TranscriptionFrame(text=best_transcript)
        else:
            yield frame
```

### Cost Optimization
- Use multi-ASR ONLY for critical data (email, phone, address)
- Use single ASR for non-critical data (name, service type)
- Budget 3x ASR cost (~$0.03/min vs $0.01/min single)

## State Machine for Objective Execution

### Why State Machines
- Deterministic: Same inputs → same state transitions
- Debuggable: Can inspect current state, replay transitions
- Bounded LLM: LLM generates responses WITHIN current state (cannot skip states)

### Objective State Machine Pattern
```python
from enum import Enum
from typing import Optional

class ObjectiveState(Enum):
    PENDING = "pending"
    ELICITING = "eliciting"
    CAPTURED = "captured"
    CONFIRMING = "confirming"
    REPAIRING = "repairing"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    FAILED = "failed"

class ObjectiveStateMachine:
    def __init__(self, objective_type: str):
        self.state = ObjectiveState.PENDING
        self.objective_type = objective_type
        self.captured_value: Optional[str] = None
        self.retry_count = 0
        
    def transition(self, event: str, **kwargs) -> ObjectiveState:
        """Deterministic state transitions"""
        
        if self.state == ObjectiveState.PENDING and event == "start":
            self.state = ObjectiveState.ELICITING
            
        elif self.state == ObjectiveState.ELICITING and event == "user_spoke":
            confidence = kwargs.get("confidence", 0)
            if confidence >= 0.4:
                self.captured_value = kwargs.get("value")
                self.state = ObjectiveState.CAPTURED
            else:
                self.retry_count += 1
                if self.retry_count >= 3:
                    self.state = ObjectiveState.FAILED
                # else stay in ELICITING
                
        elif self.state == ObjectiveState.CAPTURED and event == "validate":
            is_valid = kwargs.get("is_valid", False)
            is_critical = kwargs.get("is_critical", False)
            confidence = kwargs.get("confidence", 0)
            
            if is_critical or confidence < 0.7:
                self.state = ObjectiveState.CONFIRMING
            else:
                self.state = ObjectiveState.CONFIRMED
                
        elif self.state == ObjectiveState.CONFIRMING and event == "user_affirmed":
            self.state = ObjectiveState.CONFIRMED
            
        elif self.state == ObjectiveState.CONFIRMING and event == "user_corrected":
            self.captured_value = kwargs.get("new_value")
            self.state = ObjectiveState.REPAIRING
            
        elif self.state == ObjectiveState.REPAIRING and event == "repaired":
            self.state = ObjectiveState.CONFIRMING  # Re-confirm after repair
            
        elif self.state == ObjectiveState.CONFIRMED and event == "complete":
            self.state = ObjectiveState.COMPLETED
            
        return self.state
```

## Barge-In and Interruption Handling

### Smart Turn-Taking
```python
from pipecat.vad.silero import SileroVADAnalyzer

# Configure VAD for Australian accent (rising intonation)
vad = SileroVADAnalyzer(
    min_volume=0.6,
    end_of_turn_threshold_ms=300,  # 300ms (vs 150ms US default)
)

# Attach VAD to transport
transport = DailyTransport(
    audio_in_enabled=True,
    vad_analyzer=vad,
    vad_enabled=True,
)
```

### Resumable State on Interruption
```python
class ResumableObjectiveProcessor(FrameProcessor):
    def __init__(self):
        self.state_machine = ObjectiveStateMachine("capture_email")
        
    async def process_frame(self, frame: Frame):
        if isinstance(frame, TranscriptionFrame) and frame.text.lower() in ["wait", "hold on"]:
            # User interrupted - save current state
            self.saved_state = self.state_machine.state
            self.saved_value = self.state_machine.captured_value
            
            # Pause processing
            yield TextFrame("Sure, take your time.")
            
        elif isinstance(frame, TranscriptionFrame) and self.saved_state:
            # Resume from saved state (NOT restart)
            self.state_machine.state = self.saved_state
            self.state_machine.captured_value = self.saved_value
            
            yield TextFrame("Okay, where were we... right, your email.")
```

## Australian-Specific Patterns

### Phone Number Validation
```python
import re

def validate_australian_phone(phone: str) -> bool:
    """Validate Australian phone format"""
    # Remove all non-digits
    digits = re.sub(r'\D', '', phone)
    
    # Mobile: 04xx xxx xxx (10 digits starting with 04)
    # Landline: 0x xxxx xxxx (10 digits, area codes 02/03/07/08)
    pattern = r'^(04\d{8}|0[2378]\d{8})$'
    
    return bool(re.match(pattern, digits))

# Normalize to +61 format
def normalize_australian_phone(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('0'):
        return f"+61{digits[1:]}"  # Remove leading 0, add +61
    return f"+61{digits}"
```

### Date Parsing (DD/MM/YYYY)
```python
from datetime import datetime

def parse_australian_date(date_str: str) -> datetime:
    """Parse Australian date format (DD/MM/YYYY)"""
    
    # Try DD/MM/YYYY first
    try:
        return datetime.strptime(date_str, "%d/%m/%Y")
    except ValueError:
        pass
    
    # Try DD/MM/YY
    try:
        return datetime.strptime(date_str, "%d/%m/%y")
    except ValueError:
        pass
    
    # Ambiguous dates (5/6) - MUST clarify with user
    if len(date_str.split('/')) == 2:
        raise ValueError("Ambiguous date - clarify with user")
    
    raise ValueError(f"Invalid Australian date format: {date_str}")
```

## Observer Pattern for Event Emission

### Non-Intrusive Monitoring
```python
from pipecat.observers import BaseObserver, FramePushed

class EventEmissionObserver(BaseObserver):
    """Emit events for objective transitions without affecting pipeline"""
    
    def __init__(self, event_bus):
        super().__init__()
        self.event_bus = event_bus
        
    async def on_push_frame(self, data: FramePushed):
        frame = data.frame
        
        # Emit events for observability
        if isinstance(frame, TranscriptionFrame):
            await self.event_bus.emit("user_spoke", {
                "text": frame.text,
                "timestamp": datetime.now().isoformat()
            })
            
        elif isinstance(frame, TextFrame):
            await self.event_bus.emit("agent_spoke", {
                "text": frame.text,
                "timestamp": datetime.now().isoformat()
            })
```

## Testing Patterns

### Frame Injection for Testing
```python
import pytest
from pipecat.frames.frames import AudioRawFrame, TranscriptionFrame

@pytest.mark.asyncio
async def test_email_capture_primitive():
    # Create test pipeline
    processor = EmailCaptureProcessor()
    
    # Inject test frames
    test_frames = [
        TranscriptionFrame(text="jane at gmail dot com", user_id="test"),
        # Expected: validation passes, confirmation requested
    ]
    
    results = []
    for frame in test_frames:
        async for output_frame in processor.process_frame(frame):
            results.append(output_frame)
    
    # Assert state transitions
    assert processor.state_machine.state == ObjectiveState.CONFIRMING
    assert processor.state_machine.captured_value == "jane@gmail.com"
```

## Production Deployment Pattern

### Bot Runner (HTTP Service)
```python
from fastapi import FastAPI, WebSocket
from pipecat.transports.services.daily import DailyTransport

app = FastAPI()

@app.post("/start_call")
async def start_call(room_url: str, token: str):
    """Start voice bot for a Daily.co call"""
    
    # Create transport
    transport = DailyTransport(
        room_url=room_url,
        token=token,
        bot_name="SpotFunnel AI",
    )
    
    # Build pipeline (STT → LLM → TTS)
    pipeline = build_pipeline(transport)
    
    # Run pipeline
    task = PipelineTask(pipeline)
    await runner.run(task)
    
    return {"status": "started"}
```

## Key Takeaways

1. **Use frame-based architecture** - all processing flows through frames
2. **Multi-ASR for critical data** - Australian accent requires 3+ ASR systems
3. **State machines for determinism** - bounded LLM control within states
4. **Non-blocking always** - never block the audio pipeline
5. **Observer pattern for events** - non-intrusive monitoring
6. **Australian-specific validation** - phone (04xx), date (DD/MM/YYYY), address (Australia Post API)
7. **Resumable state** - handle interruptions gracefully (no restarts)

## References

- [Pipecat Docs](https://docs.pipecat.ai)
- [Pipecat GitHub](https://github.com/pipecat-ai/pipecat)
- [Pipecat Examples](https://github.com/pipecat-ai/pipecat-examples)
