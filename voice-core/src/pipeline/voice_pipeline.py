"""
Voice pipeline: STT → LLM → TTS (streaming, parallel execution)

Key design principles:
- Frame-based processing (immutable frames)
- Parallel execution (not sequential) for <500ms P50 latency
- Non-blocking async operations
- Circuit breakers for provider failures

Architecture:
- STT: Deepgram (optimized for Australian accent)
- LLM: Multi-provider (Gemini 2.5 Flash primary, GPT-4.1 fallback)
- TTS: Multi-provider (Cartesia primary, ElevenLabs fallback)

Latency target: <500ms P50 end-to-end
"""

import os
from typing import Optional
import logging

from pipecat.pipeline.pipeline import Pipeline
from pipecat.frames.frames import Frame, AudioRawFrame, InputAudioRawFrame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
try:
    from pipecat.services.deepgram import DeepgramSTTService
except Exception:  # pragma: no cover - optional dependency
    DeepgramSTTService = None

from ..events.event_emitter import EventEmitter
from ..llm.multi_provider_llm import MultiProviderLLM
from ..processors.llm_tools_processor import LLMToolsProcessor
from ..processors.knowledge_filler_processor import KnowledgeFillerProcessor
from ..processors.multi_asr_processor import MultiASRProcessor
from ..tools.knowledge_tool import KNOWLEDGE_QUERY_TOOL, register_knowledge_tool
from ..tts.multi_provider_tts import MultiProviderTTS
from .frame_observer import PipelineFrameObserver

logger = logging.getLogger(__name__)


class STTWithFallback(FrameProcessor):
    """
    STT wrapper that falls back to multi-ASR if primary fails.
    """

    def __init__(self, primary, fallback):
        super().__init__()
        self.primary = primary
        self.fallback = fallback
        self.use_fallback = False
        self.logger = logging.getLogger(__name__)

    async def process_frame(self, frame: Frame, direction):
        if isinstance(frame, (AudioRawFrame, InputAudioRawFrame)):
            self.logger.info(
                "STT input audio frame: %s bytes (sample_rate=%s)",
                len(frame.audio),
                frame.sample_rate,
            )
        if not self.use_fallback:
            try:
                async for output in self.primary.process_frame(frame, direction):
                    if isinstance(output, TranscriptionFrame):
                        self.logger.info("STT transcription output: %r", output.text)
                    yield output
                return
            except Exception as exc:
                logger.warning("Primary STT failed, switching to fallback: %s", exc)
                self.use_fallback = True

        if self.fallback:
            async for output in self.fallback.process_frame(frame, direction):
                if isinstance(output, TranscriptionFrame):
                    self.logger.info("STT fallback transcription: %r", output.text)
                yield output
            return

        yield frame


class VoicePipeline:
    """
    Streaming voice pipeline: STT → LLM → TTS
    
    Frame flow:
    1. AudioRawFrame → STT → TranscriptionFrame
    2. TranscriptionFrame → LLM → TextFrame
    3. TextFrame → TTS (multi-provider) → TTSAudioRawFrame
    4. TTSAudioRawFrame → Transport output
    
    Parallel execution ensures <500ms P50 latency.
    """
    
    def __init__(
        self,
        event_emitter: Optional[EventEmitter] = None,
        system_prompt: str = "You are a helpful AI assistant for SpotFunnel.",
        use_multi_provider_tts: bool = True,
        use_multi_provider_llm: bool = True,
        tenant_id: Optional[str] = None,
    ):
        """
        Initialize voice pipeline.
        
        Args:
            event_emitter: Event emitter for pipeline events
            system_prompt: System prompt for LLM (immutable)
            use_multi_provider_tts: Use multi-provider TTS with fallback (default: True)
            use_multi_provider_llm: Use multi-provider LLM with fallback (default: True)
        """
        self.event_emitter = event_emitter
        self.system_prompt = system_prompt
        self.use_multi_provider_tts = use_multi_provider_tts
        self.use_multi_provider_llm = use_multi_provider_llm
        self.tenant_id = tenant_id
        
        # Initialize services
        self.stt = self._create_stt_service()
        self.llm = self._create_llm_service()
        self.tts = self._create_tts_service()
        self.knowledge_filler = KnowledgeFillerProcessor(tenant_id=self.tenant_id)
        self.tools_processor = None
        if self.tenant_id:
            self.tools_processor = LLMToolsProcessor(
                tools=[KNOWLEDGE_QUERY_TOOL],
                tool_choice="auto",
            )
            register_knowledge_tool(self.llm, tenant_id=self.tenant_id)
        
        # Frame observer for event emission
        self.frame_observer = PipelineFrameObserver(event_emitter=event_emitter)
        
    def _create_stt_service(self):
        """
        Create Deepgram STT service (optimized for Australian accent).
        
        Model: nova-3 (low latency, real-time optimized for Australian English)
        Sample rate: 16kHz (PCM) for Daily.co, 8kHz (mulaw) for Twilio
        """
        if DeepgramSTTService is None:
            raise RuntimeError("Deepgram STT dependency not available.")
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY must be set in environment")
        
        # Deepgram model optimized for Australian English
        primary = DeepgramSTTService(
            api_key=api_key,
            model="nova-3",  # Latest model optimized for low latency Australian English
            language="en-AU",  # Australian English
            sample_rate=16000,  # Will be auto-converted for Twilio mulaw 8kHz
            channels=1,
        )

        fallback = MultiASRProcessor.from_env(event_emitter=self.event_emitter)
        fallback.enable_multi_asr()

        return STTWithFallback(primary=primary, fallback=fallback)
    
    def _create_llm_service(self) -> MultiProviderLLM:
        """Create LLM service (Gemini primary, OpenAI backup)"""
        return MultiProviderLLM.from_env()
    
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
        3. TextFrame → TTS (multi-provider) → TTSAudioRawFrame
        4. TTSAudioRawFrame → transport_output
        
        Latency target: <500ms P50
        
        Args:
            transport_input: Transport input (audio from call)
            transport_output: Transport output (audio to call)
            
        Returns:
            Configured Pipeline instance
        """
        # Create pipeline with frame processors
        processors = [
            transport_input,              # Audio input (Daily.co or Twilio)
            self.stt,                    # Speech-to-text (Deepgram)
            self.frame_observer,         # Observe STT frames for event emission
        ]
        if self.tools_processor:
            processors.append(self.tools_processor)
        processors.extend(
            [
                self.llm,                    # Language model (multi-provider: Gemini/GPT-4.1)
                self.knowledge_filler,       # Filler when querying KBs
                self.frame_observer,         # Observe LLM output frames
                self.tts,                    # Text-to-speech (multi-provider)
                transport_output,            # Audio output (Daily.co or Twilio)
            ]
        )

        pipeline = Pipeline(processors)
        pipeline.cost_trackers = {
            "llm": self.llm,
            "tts": self.tts,
        }
        
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
    
    def get_llm_stats(self) -> dict:
        """
        Get LLM provider usage statistics.
        
        Returns:
            Dict with provider usage, costs, circuit breaker status
        """
        if self.use_multi_provider_llm and isinstance(self.llm, MultiProviderLLM):
            return self.llm.get_provider_stats()
        return {}
    
    def reset_circuit_breakers(self):
        """Reset all circuit breakers (for testing/manual intervention)"""
        if self.use_multi_provider_tts and isinstance(self.tts, MultiProviderTTS):
            self.tts.reset_circuit_breakers()
        if self.use_multi_provider_llm and isinstance(self.llm, MultiProviderLLM):
            self.llm.reset_circuit_breakers()
        logger.info("All circuit breakers reset")


def build_voice_pipeline(
    transport_input,
    transport_output,
    event_emitter: Optional[EventEmitter] = None,
    system_prompt: str = "You are a helpful AI assistant for SpotFunnel.",
    tenant_id: Optional[str] = None,
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
        use_multi_provider_tts=True,  # Always use multi-provider in production
        tenant_id=tenant_id,
    )
    return pipeline_builder.build_pipeline(transport_input, transport_output)
