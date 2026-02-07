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
from pipecat.frames.frames import Frame
from pipecat.processors.frame_processor import FrameProcessor
try:
    from pipecat.services.deepgram import DeepgramSTTService
except Exception:  # pragma: no cover - optional provider dependency
    DeepgramSTTService = None
from pipecat.services.elevenlabs import ElevenLabsTTSService

from ..events.event_emitter import EventEmitter
from ..llm.multi_provider_llm import MultiProviderLLM
from ..processors.llm_tools_processor import LLMToolsProcessor
from ..processors.knowledge_filler_processor import KnowledgeFillerProcessor
from ..processors.multi_asr_processor import MultiASRProcessor
class STTWithFallback(FrameProcessor):
    """
    STT wrapper that falls back to multi-ASR if primary fails.
    """

    def __init__(self, primary, fallback):
        super().__init__()
        self.primary = primary
        self.fallback = fallback
        self.use_fallback = False

    async def process_frame(self, frame: Frame, direction):
        if not self.use_fallback:
            try:
                async for output in self.primary.process_frame(frame, direction):
                    yield output
                return
            except Exception:
                self.use_fallback = True

        if self.fallback:
            async for output in self.fallback.process_frame(frame, direction):
                yield output
            return

        yield frame
from ..tools.knowledge_tool import KNOWLEDGE_QUERY_TOOL, register_knowledge_tool
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
        system_prompt: str = "You are a helpful AI assistant for SpotFunnel.",
        tenant_id: Optional[str] = None,
    ):
        """
        Initialize audio pipeline.
        
        Args:
            event_emitter: Event emitter for pipeline events
            system_prompt: System prompt for LLM (immutable, not customer-configurable)
        """
        self.event_emitter = event_emitter
        self.system_prompt = system_prompt
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
        """Create Deepgram STT service (optimized for Australian accent)"""
        if DeepgramSTTService is None:
            raise RuntimeError("Deepgram STT dependency not available.")
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY must be set in environment")
        
        # Deepgram Nova-3 model optimized for low-latency Australian English
        primary = DeepgramSTTService(
            api_key=api_key,
            model="nova-3",
            language="en-AU",
            sample_rate=16000,
            channels=1,
        )
        fallback = MultiASRProcessor.from_env(event_emitter=self.event_emitter)
        fallback.enable_multi_asr()
        return STTWithFallback(primary=primary, fallback=fallback)
    
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
        processors = [
            transport_input,           # Audio input (Daily.co)
            self.stt,                 # Speech-to-text (Deepgram)
            self.frame_observer,      # Observe frames for event emission
        ]
        if self.tools_processor:
            processors.append(self.tools_processor)
        processors.extend(
            [
                self.llm,                 # Language model (multi-provider: Gemini/GPT-4.1)
                self.knowledge_filler,    # Filler when querying KBs
                self.frame_observer,      # Observe LLM output frames
                self.tts,                 # Text-to-speech (ElevenLabs)
                transport_output,         # Audio output (Daily.co)
            ]
        )
        pipeline = Pipeline(processors)
        pipeline.cost_trackers = {
            "llm": self.llm,
            "tts": self.tts,
        }
        
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
    system_prompt: str = "You are a helpful AI assistant for SpotFunnel.",
    tenant_id: Optional[str] = None,
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
        system_prompt=system_prompt,
        tenant_id=tenant_id,
    )
    return pipeline_builder.build_pipeline(transport_input, transport_output)
