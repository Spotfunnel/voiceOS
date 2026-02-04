"""
Voice Pipeline - Core audio processing pipeline

Implements the frame-based audio pipeline: STT → LLM → TTS
using Pipecat framework with Deepgram, OpenAI GPT-4o, and ElevenLabs.
"""

import os
import asyncio
from typing import Optional
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_response import LLMResponseAggregator
from pipecat.frames.frames import EndFrame
try:
    from pipecat.services.deepgram import DeepgramSTTService
    _DEEPGRAM_IMPORT_ERROR = None
except Exception as e:
    DeepgramSTTService = None  # type: ignore[assignment]
    _DEEPGRAM_IMPORT_ERROR = e
try:
    from pipecat.services.openai import OpenAILLMService
    _OPENAI_IMPORT_ERROR = None
except Exception as e:
    OpenAILLMService = None  # type: ignore[assignment]
    _OPENAI_IMPORT_ERROR = e
from pipecat.services.elevenlabs import ElevenLabsTTSService
from voice_core.transports import DailyTransportWrapper

import structlog

logger = structlog.get_logger(__name__)


VOICE_CORE_SYSTEM_MESSAGE = "Voice Core v1: deterministic, immutable Layer 1 runtime."
VOICE_CORE_LLM_MODEL = os.getenv("VOICE_CORE_LLM_MODEL", "gpt-4o")
VOICE_CORE_TTS_VOICE_ID = os.getenv("VOICE_CORE_TTS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")


class VoicePipeline:
    """
    Voice Core pipeline builder and runner.
    
    Implements the immutable audio pipeline:
    - Deepgram STT (Speech-to-Text)
    - OpenAI GPT-4o (Language Model)
    - ElevenLabs TTS (Text-to-Speech)
    
    This is Layer 1 - immutable across all customers.
    Customer-specific behavior is handled by Layer 2 (Orchestration).
    """
    
    def __init__(
        self,
        daily_room_url: str,
        daily_token: str,
        deepgram_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        elevenlabs_api_key: Optional[str] = None,
    ):
        """
        Initialize voice pipeline with service credentials.
        
        Args:
            daily_room_url: Daily.co room URL for WebRTC connection
            daily_token: Daily.co authentication token
            deepgram_api_key: Deepgram API key (or from DEEPGRAM_API_KEY env)
            openai_api_key: OpenAI API key (or from OPENAI_API_KEY env)
            elevenlabs_api_key: ElevenLabs API key (or from ELEVENLABS_API_KEY env)
        """
        self.daily_room_url = daily_room_url
        self.daily_token = daily_token
        
        # Load API keys from environment if not provided
        self.deepgram_api_key = deepgram_api_key or os.getenv("DEEPGRAM_API_KEY")
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self.elevenlabs_api_key = elevenlabs_api_key or os.getenv("ELEVENLABS_API_KEY")
        
        if not self.deepgram_api_key:
            raise ValueError("Deepgram API key required (DEEPGRAM_API_KEY env or parameter)")
        if not self.openai_api_key:
            raise ValueError("OpenAI API key required (OPENAI_API_KEY env or parameter)")
        if not self.elevenlabs_api_key:
            raise ValueError("ElevenLabs API key required (ELEVENLABS_API_KEY env or parameter)")
        
        self.runner: Optional[PipelineRunner] = None
        self.task: Optional[PipelineTask] = None
        
    def build_pipeline(self) -> Pipeline:
        """
        Build the audio processing pipeline.
        
        Pipeline flow:
        1. Daily.co transport (audio input/output)
        2. Deepgram STT (speech → text)
        3. OpenAI LLM (generates responses)
        4. LLM Response Aggregator (collects full LLM responses)
        5. ElevenLabs TTS (text → speech)
        6. Daily.co transport output (audio output)
        
        Returns:
            Configured Pipeline instance
        """
        logger.info(
            "Building voice pipeline",
            model=VOICE_CORE_LLM_MODEL,
            voice_id=VOICE_CORE_TTS_VOICE_ID,
        )
        
        # Create transport (Daily.co WebRTC) with Australian accent optimization
        transport_wrapper = DailyTransportWrapper(
            room_url=self.daily_room_url,
            token=self.daily_token,
            bot_name="SpotFunnel AI",
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_enabled=True,
            end_of_turn_threshold_ms=300,  # Optimized for Australian accent
        )
        transport = transport_wrapper.transport
        
        if DeepgramSTTService is None:
            raise ImportError(
                "Deepgram dependency missing or incompatible. "
                "Install pipecat-ai[deepgram] and a compatible deepgram SDK."
            ) from _DEEPGRAM_IMPORT_ERROR

        # Create STT service (Deepgram)
        stt = DeepgramSTTService(
            api_key=self.deepgram_api_key,
            model="nova-2",  # Latest Deepgram model
            language="en-AU",  # Australian English
        )
        
        if OpenAILLMService is None:
            raise ImportError(
                "OpenAI dependency missing or incompatible. "
                "Install pipecat-ai[openai] and a compatible openai SDK."
            ) from _OPENAI_IMPORT_ERROR

        # Create LLM service (OpenAI GPT-4o)
        llm = OpenAILLMService(
            api_key=self.openai_api_key,
            model=VOICE_CORE_LLM_MODEL,
            system_message=VOICE_CORE_SYSTEM_MESSAGE,
        )
        
        # Create TTS service (ElevenLabs)
        tts = ElevenLabsTTSService(
            api_key=self.elevenlabs_api_key,
            voice_id=VOICE_CORE_TTS_VOICE_ID,
        )
        
        # LLM response aggregator (collects full LLM responses)
        llm_response_aggregator = LLMResponseAggregator()
        
        # Build pipeline: Transport → STT → LLM → Aggregator → TTS → Transport
        pipeline = Pipeline([
            transport.input(),  # Audio input from Daily.co
            stt,  # Speech-to-text
            llm,  # Language model
            llm_response_aggregator,  # Aggregate LLM responses
            tts,  # Text-to-speech
            transport.output(),  # Audio output to Daily.co
        ])
        
        logger.info("Pipeline built successfully")
        return pipeline
    
    async def start(self) -> None:
        """
        Start the voice pipeline.
        
        Args:
            None
        """
        logger.info("Starting voice pipeline")
        
        # Build pipeline
        pipeline = self.build_pipeline()
        
        # Create task and runner
        self.task = PipelineTask(pipeline)
        self.runner = PipelineRunner()
        
        # Run pipeline (non-blocking)
        await self.runner.run(self.task)
        
        logger.info("Voice pipeline started")
    
    async def stop(self) -> None:
        """Stop the voice pipeline gracefully."""
        logger.info("Stopping voice pipeline")
        
        if self.task:
            await self.task.queue_frames([EndFrame()])
        
        if self.runner:
            await self.runner.cancel()
        
        logger.info("Voice pipeline stopped")
    
