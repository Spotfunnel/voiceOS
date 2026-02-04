"""
Audio pipeline: STT → LLM → TTS

Streaming frame-based pipeline using Pipecat architecture.
- STT: Deepgram (primary for Australian accent)
- LLM: Multi-provider (Gemini 2.5 Flash primary, GPT-4.1 fallback)
- TTS: ElevenLabs or Cartesia

Architecture compliance:
- Frame-based processing (immutable frames)
- Non-blocking async operations
- Streaming (not batch processing)
"""

import os
from typing import Optional

from pipecat.pipeline.pipeline import Pipeline
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService

from ..events.event_emitter import EventEmitter
from ..llm.multi_provider_llm import MultiProviderLLM
from .frame_observer import PipelineFrameObserver


class AudioPipeline:
    """
    STT → LLM → TTS audio pipeline
    
    Frame-based architecture:
    - AudioRawFrame → STT → TranscriptionFrame
    - TranscriptionFrame → LLM → TextFrame
    - TextFrame → TTS → TTSAudioRawFrame
    """
    
    def __init__(
        self,
        event_emitter: Optional[EventEmitter] = None,
        system_prompt: str = "You are a helpful AI assistant for SpotFunnel."
    ):
        """
        Initialize audio pipeline.
        
        Args:
            event_emitter: Event emitter for pipeline events
            system_prompt: System prompt for LLM (immutable, not customer-configurable)
        """
        self.event_emitter = event_emitter
        self.system_prompt = system_prompt
        
        # Initialize services
        self.stt = self._create_stt_service()
        self.llm = self._create_llm_service()
        self.tts = self._create_tts_service()
        
        # Frame observer for event emission
        self.frame_observer = PipelineFrameObserver(event_emitter=event_emitter)
        
    def _create_stt_service(self) -> DeepgramSTTService:
        """Create Deepgram STT service (optimized for Australian accent)"""
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY must be set in environment")
        
        # Deepgram Nova-3 model optimized for low-latency Australian English
        return DeepgramSTTService(
            api_key=api_key,
            model="nova-3",
            language="en-AU",
            sample_rate=16000,
            channels=1,
        )
    
    def _create_llm_service(self) -> MultiProviderLLM:
        """
        Create multi-provider LLM service with fallback.
        
        Primary: Gemini 2.5 Flash (94.9% pass rate, ~700ms TTFT, $0.010-$0.015/min)
        Fallback: GPT-4.1 (94.9% pass rate, ~700ms TTFT, $0.015-$0.020/min)
        """
        return MultiProviderLLM.from_env()
    
    def _create_tts_service(self) -> ElevenLabsTTSService:
        """Create ElevenLabs TTS service"""
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
            raise ValueError("ELEVENLABS_API_KEY must be set in environment")
        
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        
        return ElevenLabsTTSService(
            api_key=api_key,
            voice_id=voice_id,
        )
    
    def build_pipeline(self, transport_input, transport_output) -> Pipeline:
        """
        Build frame-based pipeline: STT → LLM → TTS
        
        Pipeline flow:
        1. transport_input → STT → TranscriptionFrame
        2. TranscriptionFrame → LLM → TextFrame
        3. TextFrame → TTS → TTSAudioRawFrame
        4. TTSAudioRawFrame → transport_output
        
        Args:
            transport_input: Transport input (audio from call)
            transport_output: Transport output (audio to call)
            
        Returns:
            Configured Pipeline instance
        """
        # Create pipeline with frame processors
        pipeline = Pipeline([
            transport_input,           # Audio input (Daily.co)
            self.stt,                 # Speech-to-text (Deepgram)
            self.frame_observer,      # Observe frames for event emission
            self.llm,                 # Language model (multi-provider: Gemini/GPT-4.1)
            self.frame_observer,      # Observe LLM output frames
            self.tts,                 # Text-to-speech (ElevenLabs)
            transport_output,         # Audio output (Daily.co)
        ])
        
        return pipeline
    
    async def process_frame(self, frame):
        """
        Process a single frame (for testing/debugging).
        
        In production, frames flow through pipeline automatically.
        """
        # This is handled by PipelineRunner in production
        pass


def build_pipeline(
    transport_input,
    transport_output,
    event_emitter: Optional[EventEmitter] = None,
    system_prompt: str = "You are a helpful AI assistant for SpotFunnel."
) -> Pipeline:
    """
    Convenience function to build audio pipeline.
    
    Args:
        transport_input: Transport input
        transport_output: Transport output
        event_emitter: Optional event emitter
        system_prompt: System prompt for LLM
        
    Returns:
        Configured Pipeline instance
    """
    pipeline_builder = AudioPipeline(
        event_emitter=event_emitter,
        system_prompt=system_prompt
    )
    return pipeline_builder.build_pipeline(transport_input, transport_output)
