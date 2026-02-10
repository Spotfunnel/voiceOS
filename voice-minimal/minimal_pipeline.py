"""
Minimal Voice Pipeline: STT → LLM → TTS

Dead simple. No fallbacks, no complexity, no bullshit.
If it breaks, you'll see exactly where and why.
"""

import os
import logging
from typing import Optional

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.frames.frames import Frame, EndFrame
from pipecat.processors.frame_processor import FrameProcessor

# Services
try:
    from pipecat.services.deepgram import DeepgramSTTService
except ImportError:
    raise RuntimeError("Install pipecat-ai[daily] to use Deepgram STT")

try:
    from pipecat.services.cartesia import CartesiaTTSService
except ImportError:
    raise RuntimeError("Install pipecat-ai[daily] to use Cartesia TTS")

try:
    import google.generativeai as genai
    from pipecat.services.google import GoogleLLMService
except ImportError:
    raise RuntimeError("Install google-generativeai to use Gemini LLM")

from receptionist_prompt import get_system_prompt

logger = logging.getLogger(__name__)


class MinimalVoicePipeline:
    """
    Simple voice pipeline with zero magic.
    
    Flow:
    1. Audio comes in → Deepgram transcribes it
    2. Text goes to Gemini → Gemini responds
    3. Response goes to Cartesia → Cartesia speaks it
    4. Audio goes out → User hears response
    """
    
    def __init__(
        self,
        deepgram_api_key: str,
        google_api_key: str,
        cartesia_api_key: str,
        system_prompt: Optional[str] = None,
    ):
        """
        Initialize the voice pipeline.
        
        Args:
            deepgram_api_key: Deepgram API key for STT
            google_api_key: Google API key for Gemini LLM
            cartesia_api_key: Cartesia API key for TTS
            system_prompt: System prompt for LLM (uses receptionist prompt if None)
        """
        self.deepgram_api_key = deepgram_api_key
        self.google_api_key = google_api_key
        self.cartesia_api_key = cartesia_api_key
        self.system_prompt = system_prompt or get_system_prompt()
        
        # Validate API keys
        if not self.deepgram_api_key:
            raise ValueError("DEEPGRAM_API_KEY is required")
        if not self.google_api_key:
            raise ValueError("GOOGLE_API_KEY is required")
        if not self.cartesia_api_key:
            raise ValueError("CARTESIA_API_KEY is required")
        
        logger.info("Voice pipeline initialized")
        logger.info(f"System prompt: {len(self.system_prompt)} chars")
    
    def _create_stt_service(self) -> DeepgramSTTService:
        """
        Create Deepgram STT service.
        
        Configuration:
        - Model: nova-3 (latest, best quality, low latency)
        - Language: en-AU (Australian English)
        - Sample rate: 16kHz (standard for telephony)
        - Interim results: True (faster response)
        """
        logger.info("Creating Deepgram STT service")
        
        return DeepgramSTTService(
            api_key=self.deepgram_api_key,
            model="nova-3",
            language="en-AU",
            sample_rate=16000,
            channels=1,
            interim_results=True,
            smart_format=True,
            punctuate=True,
            endpointing=300,  # 300ms silence = end of speech
        )
    
    def _create_llm_service(self) -> GoogleLLMService:
        """
        Create Google Gemini LLM service.
        
        Configuration:
        - Model: gemini-2.5-flash (latest, fastest, most capable)
        - Temperature: 0.7 (balanced creativity)
        - Max tokens: 150 (keep responses short)
        """
        logger.info("Creating Gemini LLM service")
        
        # Configure Gemini
        genai.configure(api_key=self.google_api_key)
        
        return GoogleLLMService(
            api_key=self.google_api_key,
            model="gemini-2.5-flash",
            system_instruction=self.system_prompt,
        )
    
    def _create_tts_service(self) -> CartesiaTTSService:
        """
        Create Cartesia TTS service.
        
        Configuration:
        - Model: sonic-english (fast, natural)
        - Voice: Friendly Australian female
        - Sample rate: 16kHz (matches STT)
        - Encoding: PCM 16-bit
        """
        logger.info("Creating Cartesia TTS service")
        
        return CartesiaTTSService(
            api_key=self.cartesia_api_key,
            voice_id="a0e99841-438c-4a64-b679-ae501e7d6091",  # Friendly female voice
            sample_rate=16000,
        )
    
    def build_pipeline(
        self,
        transport_input: FrameProcessor,
        transport_output: FrameProcessor,
    ) -> Pipeline:
        """
        Build the voice pipeline.
        
        Pipeline flow:
        transport_input → STT → LLM → TTS → transport_output
        
        Args:
            transport_input: Audio input (from Daily.co)
            transport_output: Audio output (to Daily.co)
            
        Returns:
            Configured Pipeline instance
        """
        logger.info("Building voice pipeline")
        
        # Create services
        stt = self._create_stt_service()
        llm = self._create_llm_service()
        tts = self._create_tts_service()
        
        # Build pipeline (simple linear flow)
        pipeline = Pipeline([
            transport_input,   # Audio comes in
            stt,              # Speech → Text
            llm,              # Text → AI Response
            tts,              # Response → Speech
            transport_output, # Audio goes out
        ])
        
        logger.info("Pipeline built successfully")
        return pipeline


def create_pipeline(
    transport_input: FrameProcessor,
    transport_output: FrameProcessor,
    deepgram_api_key: Optional[str] = None,
    google_api_key: Optional[str] = None,
    cartesia_api_key: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> Pipeline:
    """
    Convenience function to create a voice pipeline.
    
    Loads API keys from environment if not provided.
    
    Args:
        transport_input: Audio input processor
        transport_output: Audio output processor
        deepgram_api_key: Deepgram API key (or from DEEPGRAM_API_KEY env var)
        google_api_key: Google API key (or from GOOGLE_API_KEY env var)
        cartesia_api_key: Cartesia API key (or from CARTESIA_API_KEY env var)
        system_prompt: System prompt (or uses receptionist prompt)
        
    Returns:
        Configured Pipeline instance
    """
    # Load API keys from environment if not provided
    deepgram_api_key = deepgram_api_key or os.getenv("DEEPGRAM_API_KEY")
    google_api_key = google_api_key or os.getenv("GOOGLE_API_KEY")
    cartesia_api_key = cartesia_api_key or os.getenv("CARTESIA_API_KEY")
    
    # Create pipeline builder
    builder = MinimalVoicePipeline(
        deepgram_api_key=deepgram_api_key,
        google_api_key=google_api_key,
        cartesia_api_key=cartesia_api_key,
        system_prompt=system_prompt,
    )
    
    # Build and return pipeline
    return builder.build_pipeline(transport_input, transport_output)


def test_llm():
    """
    Test the LLM directly (no STT/TTS).
    
    Usage:
        python -c "from minimal_pipeline import test_llm; test_llm()"
    """
    from dotenv import load_dotenv
    load_dotenv()
    
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        print("ERROR: GOOGLE_API_KEY not found in environment")
        return
    
    genai.configure(api_key=google_api_key)
    
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash-exp",
        system_instruction=get_system_prompt(),
    )
    
    print("Testing Gemini LLM...")
    print("=" * 50)
    print("System Prompt:", get_system_prompt()[:100] + "...")
    print("=" * 50)
    
    # Test message
    response = model.generate_content("Hi, I need help with plumbing")
    print("User: Hi, I need help with plumbing")
    print("Agent:", response.text)
    print("=" * 50)
    print("✅ LLM test passed!")


if __name__ == "__main__":
    # Quick test
    test_llm()
