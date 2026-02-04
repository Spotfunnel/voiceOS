"""
ElevenLabs TTS service (fallback)

Cost: Higher than Cartesia (~$0.00015-$0.0003/char)
Latency: ~200ms TTFB
Quality: High-quality natural voices

Features:
- Streaming audio output
- Word-level timestamps
- Circuit breaker for failover
- Used as fallback when Cartesia fails
"""

import os
import asyncio
from typing import Optional, AsyncIterator
import logging

from pipecat.services.elevenlabs import ElevenLabsTTSService as PipecatElevenLabsTTS
from pipecat.frames.frames import TTSAudioFrame, TextFrame

logger = logging.getLogger(__name__)


class ElevenLabsTTSService:
    """
    Wrapper around Pipecat's ElevenLabsTTS with circuit breaker support.
    
    Fallback TTS provider for Voice Core.
    Cost: ~$0.00015-$0.0003/char (higher than Cartesia)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        voice_id: str = "21m00Tcm4TlvDq8ikWAM",  # Default: Rachel (clear, professional)
        model: str = "eleven_turbo_v2",
    ):
        """
        Initialize ElevenLabs TTS service.
        
        Args:
            api_key: ElevenLabs API key (defaults to ELEVENLABS_API_KEY env var)
            voice_id: ElevenLabs voice ID
            model: ElevenLabs model (defaults to eleven_turbo_v2 for low latency)
        """
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY must be set in environment or passed as argument")
        
        self.voice_id = voice_id
        self.model = model
        
        # Create Pipecat ElevenLabsTTS service
        self.service = PipecatElevenLabsTTS(
            api_key=self.api_key,
            voice_id=voice_id,
            model=model,
        )
        
        # Circuit breaker state
        self.failure_count = 0
        self.failure_threshold = 5  # Open circuit after 5 consecutive failures
        self.circuit_open = False
        self.last_failure_time: Optional[float] = None
        self.recovery_timeout = 60  # Try to close circuit after 60 seconds
        
    async def synthesize(self, text: str) -> AsyncIterator[TTSAudioFrame]:
        """
        Synthesize text to speech (streaming).
        
        Args:
            text: Text to synthesize
            
        Yields:
            TTSAudioFrame objects with audio data
            
        Raises:
            CircuitBreakerOpen: If circuit breaker is open (too many failures)
            Exception: On TTS service failure
        """
        # Check circuit breaker
        if self.circuit_open:
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = asyncio.get_event_loop().time() - self.last_failure_time
                if elapsed >= self.recovery_timeout:
                    logger.info("ElevenLabs TTS circuit breaker: attempting recovery")
                    self.circuit_open = False
                    self.failure_count = 0
                else:
                    raise CircuitBreakerOpen(
                        f"ElevenLabs TTS circuit breaker open. "
                        f"Retry in {self.recovery_timeout - elapsed:.1f}s"
                    )
            else:
                raise CircuitBreakerOpen("ElevenLabs TTS circuit breaker open")
        
        try:
            # Call Pipecat service
            async for frame in self.service.process_frame(TextFrame(text=text)):
                if isinstance(frame, TTSAudioFrame):
                    yield frame
            
            # Reset failure count on success
            self.failure_count = 0
            
        except Exception as e:
            # Increment failure count
            self.failure_count += 1
            logger.error(f"ElevenLabs TTS error (failure {self.failure_count}/{self.failure_threshold}): {e}")
            
            # Open circuit if threshold reached
            if self.failure_count >= self.failure_threshold:
                self.circuit_open = True
                self.last_failure_time = asyncio.get_event_loop().time()
                logger.warning(
                    f"ElevenLabs TTS circuit breaker OPEN after {self.failure_count} failures. "
                    f"Will retry in {self.recovery_timeout}s"
                )
            
            raise
    
    def reset_circuit_breaker(self):
        """Reset circuit breaker (for testing/manual intervention)"""
        self.failure_count = 0
        self.circuit_open = False
        self.last_failure_time = None
        logger.info("ElevenLabs TTS circuit breaker reset")
    
    @property
    def is_circuit_open(self) -> bool:
        """Check if circuit breaker is open"""
        return self.circuit_open
    
    @classmethod
    def from_env(cls):
        """
        Create ElevenLabsTTSService from environment variables.
        
        Environment variables:
            ELEVENLABS_API_KEY: ElevenLabs API key (required)
            ELEVENLABS_VOICE_ID: ElevenLabs voice ID (optional)
            ELEVENLABS_MODEL: ElevenLabs model (optional)
        """
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        model = os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2")
        
        return cls(
            voice_id=voice_id,
            model=model
        )


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open (provider unavailable)"""
    pass
