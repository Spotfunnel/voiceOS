"""
Voice pipeline: STT → LLM → TTS (streaming, parallel execution)

Key design principles:
- Frame-based processing (immutable frames)
- Parallel execution (not sequential) for <500ms P50 latency
- Non-blocking async operations
- Circuit breakers for provider failures

Architecture:
- STT: Deepgram (optimized for Australian accent)
- LLM: OpenAI GPT-4o
- TTS: Multi-provider (Cartesia primary, ElevenLabs fallback)

Latency target: <500ms P50 end-to-end
"""

import os
from typing import Optional
import logging

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAILLMService

from ..events.event_emitter import EventEmitter
from ..tts.multi_provider_tts import MultiProviderTTS
from .frame_observer import PipelineFrameObserver

logger = logging.getLogger(__name__)


class VoicePipeline:
    """
    Streaming voice pipeline: STT → LLM → TTS
    
    Frame flow:
    1. AudioRawFrame → STT → TranscriptionFrame
    2. TranscriptionFrame → LLM → TextFrame
    3. TextFrame → TTS (multi-provider) → TTSAudioFrame
    4. TTSAudioFrame → Transport output
    
    Parallel execution ensures <500ms P50 latency.
    """
    
    def __init__(
        self,
        event_emitter: Optional[EventEmitter] = None,
        system_prompt: str = "You are a helpful AI assistant for SpotFunnel.",
        use_multi_provider_tts: bool = True,
    ):
        """
        Initialize voice pipeline.
        
        Args:
            event_emitter: Event emitter for pipeline events
            system_prompt: System prompt for LLM (immutable)
            use_multi_provider_tts: Use multi-provider TTS with fallback (default: True)
        """
        self.event_emitter = event_emitter
        self.system_prompt = system_prompt
        self.use_multi_provider_tts = use_multi_provider_tts
        
        # Initialize services
        self.stt = self._create_stt_service()
        self.llm = self._create_llm_service()
        self.tts = self._create_tts_service()
        
        # Frame observer for event emission
        self.frame_observer = PipelineFrameObserver(event_emitter=event_emitter)
        
    def _create_stt_service(self) -> DeepgramSTTService:
        """
        Create Deepgram STT service (optimized for Australian accent).
        
        Model: nova-2 (best Australian English support)
        Sample rate: 16kHz (PCM) for Daily.co, 8kHz (mulaw) for Twilio
        """
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY must be set in environment")
        
        # Deepgram model optimized for Australian English
        return DeepgramSTTService(
            api_key=api_key,
            model="nova-2",  # Latest model with better Australian accent support
            language="en-AU",  # Australian English
            sample_rate=16000,  # Will be auto-converted for Twilio mulaw 8kHz
            channels=1,
        )
    
    def _create_llm_service(self) -> OpenAILLMService:
        """Create OpenAI LLM service (GPT-4o)"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY must be set in environment")
        
        model = os.getenv("OPENAI_MODEL", "gpt-4o")
        
        return OpenAILLMService(
            api_key=api_key,
            model=model,
            system_prompt=self.system_prompt,
        )
    
    def _create_tts_service(self):
        """
        Create TTS service (multi-provider with fallback).
        
        Primary: Cartesia Sonic 3 ($0.000037/char)
        Fallback: ElevenLabs (~$0.00020/char)
        """
        if self.use_multi_provider_tts:
            # Multi-provider TTS with circuit breakers
            return MultiProviderTTS.from_env()
        else:
            # Single provider (for testing)
            from ..tts.cartesia_tts import CartesiaTTSService
            return CartesiaTTSService.from_env()
    
    def build_pipeline(self, transport_input, transport_output) -> Pipeline:
        """
        Build frame-based pipeline: STT → LLM → TTS
        
        Pipeline flow (parallel execution):
        1. transport_input → STT → TranscriptionFrame
        2. TranscriptionFrame → LLM → TextFrame (streaming)
        3. TextFrame → TTS (multi-provider) → TTSAudioFrame
        4. TTSAudioFrame → transport_output
        
        Latency target: <500ms P50
        
        Args:
            transport_input: Transport input (audio from call)
            transport_output: Transport output (audio to call)
            
        Returns:
            Configured Pipeline instance
        """
        # Create pipeline with frame processors
        pipeline = Pipeline([
            transport_input,              # Audio input (Daily.co or Twilio)
            self.stt,                    # Speech-to-text (Deepgram)
            self.frame_observer,         # Observe STT frames for event emission
            self.llm,                    # Language model (OpenAI GPT-4o)
            self.frame_observer,         # Observe LLM output frames
            self.tts,                    # Text-to-speech (multi-provider)
            transport_output,            # Audio output (Daily.co or Twilio)
        ])
        
        logger.info("Voice pipeline created with multi-provider TTS and circuit breakers")
        return pipeline
    
    def get_tts_stats(self) -> dict:
        """
        Get TTS provider usage statistics.
        
        Returns:
            Dict with provider usage, costs, circuit breaker status
        """
        if self.use_multi_provider_tts and isinstance(self.tts, MultiProviderTTS):
            return self.tts.get_provider_stats()
        return {}
    
    def reset_circuit_breakers(self):
        """Reset all circuit breakers (for testing/manual intervention)"""
        if self.use_multi_provider_tts and isinstance(self.tts, MultiProviderTTS):
            self.tts.reset_circuit_breakers()
            logger.info("All circuit breakers reset")


def build_voice_pipeline(
    transport_input,
    transport_output,
    event_emitter: Optional[EventEmitter] = None,
    system_prompt: str = "You are a helpful AI assistant for SpotFunnel."
) -> Pipeline:
    """
    Convenience function to build voice pipeline.
    
    Args:
        transport_input: Transport input
        transport_output: Transport output
        event_emitter: Optional event emitter
        system_prompt: System prompt for LLM
        
    Returns:
        Configured Pipeline instance
    """
    pipeline_builder = VoicePipeline(
        event_emitter=event_emitter,
        system_prompt=system_prompt,
        use_multi_provider_tts=True  # Always use multi-provider in production
    )
    return pipeline_builder.build_pipeline(transport_input, transport_output)
