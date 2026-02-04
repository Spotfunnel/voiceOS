"""
Cartesia Sonic 3 TTS service (primary)

Cost: $0.000037/char (research/12 - lowest cost TTS)
Latency: ~150ms TTFB (Time to First Byte)
Quality: High-quality streaming audio

Features:
- Streaming audio output (non-blocking)
- Word-level timestamps
- Australian English voice optimization
- Circuit breaker for failover
"""

import os
import asyncio
from typing import Optional, AsyncIterator
import logging

from pipecat.services.cartesia import CartesiaTTSService as PipecatCartesiaTTS
from pipecat.frames.frames import TTSAudioRawFrame, TextFrame

logger = logging.getLogger(__name__)


class CartesiaTTSService:
    """
    Wrapper around Pipecat's CartesiaTTS with circuit breaker support.
    
    Primary TTS provider for Voice Core.
    Cost: $0.000037/char (lowest cost option per research/12)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        voice_id: str = "a0e99841-438c-4a64-b679-ae501e7d6091",  # Default Australian English voice
        model: str = "sonic-3",
    ):
        """
        Initialize Cartesia TTS service.
        
        Args:
            api_key: Cartesia API key (defaults to CARTESIA_API_KEY env var)
            voice_id: Cartesia voice ID (defaults to Australian English)
            model: Cartesia model (defaults to sonic-3, the latest Sonic model)
        """
        self.api_key = api_key or os.getenv("CARTESIA_API_KEY")
        if not self.api_key:
            raise ValueError("CARTESIA_API_KEY must be set in environment or passed as argument")
        
        self.voice_id = voice_id
        self.model = model
        
        # Create Pipecat CartesiaTTS service lazily (avoid event loop errors in sync tests)
        self.service = _StubTTSService()
        self._default_process_frame = self.service.process_frame
        
        # Circuit breaker state
        self.failure_count = 0
        self.failure_threshold = 5  # Open circuit after 5 consecutive failures
        self.circuit_open = False
        self.last_failure_time: Optional[float] = None
        self.recovery_timeout = 60  # Try to close circuit after 60 seconds
        
    async def synthesize(self, text: str) -> AsyncIterator[TTSAudioRawFrame]:
        """
        Synthesize text to speech (streaming).
        
        Args:
            text: Text to synthesize
            
        Yields:
            TTSAudioRawFrame objects with audio data
            
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
                    logger.info("Cartesia TTS circuit breaker: attempting recovery")
                    self.circuit_open = False
                    self.failure_count = 0
                else:
                    raise CircuitBreakerOpen(
                        f"Cartesia TTS circuit breaker open. "
                        f"Retry in {self.recovery_timeout - elapsed:.1f}s"
                    )
            else:
                raise CircuitBreakerOpen("Cartesia TTS circuit breaker open")
        
        try:
            # Ensure underlying service is initialized inside an active event loop
            if self.service.process_frame is self._default_process_frame:
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()

                self.service = PipecatCartesiaTTS(
                    api_key=self.api_key,
                    voice_id=self.voice_id,
                    model=self.model,
                    loop=loop,
                )
                self._default_process_frame = self.service.process_frame

            # Call Pipecat service
            async for frame in self.service.process_frame(TextFrame(text=text)):
                if isinstance(frame, TTSAudioRawFrame):
                    yield frame
            
            # Reset failure count on success
            self.failure_count = 0
            
        except Exception as e:
            # Increment failure count
            self.failure_count += 1
            logger.error(f"Cartesia TTS error (failure {self.failure_count}/{self.failure_threshold}): {e}")
            
            # Open circuit if threshold reached
            if self.failure_count >= self.failure_threshold:
                self.circuit_open = True
                self.last_failure_time = asyncio.get_event_loop().time()
                logger.warning(
                    f"Cartesia TTS circuit breaker OPEN after {self.failure_count} failures. "
                    f"Will retry in {self.recovery_timeout}s"
                )
            
            raise
    
    def reset_circuit_breaker(self):
        """Reset circuit breaker (for testing/manual intervention)"""
        self.failure_count = 0
        self.circuit_open = False
        self.last_failure_time = None
        logger.info("Cartesia TTS circuit breaker reset")
    
    @property
    def is_circuit_open(self) -> bool:
        """Check if circuit breaker is open"""
        return self.circuit_open
    
    @classmethod
    def from_env(cls):
        """
        Create CartesiaTTSService from environment variables.
        
        Environment variables:
            CARTESIA_API_KEY: Cartesia API key (required)
            CARTESIA_VOICE_ID: Cartesia voice ID (optional)
            CARTESIA_MODEL: Cartesia model (optional, defaults to sonic-3)
        """
        voice_id = os.getenv("CARTESIA_VOICE_ID", "a0e99841-438c-4a64-b679-ae501e7d6091")
        model = os.getenv("CARTESIA_MODEL", "sonic-3")
        
        return cls(
            voice_id=voice_id,
            model=model
        )


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open (provider unavailable)"""
    pass


class _StubTTSService:
    async def process_frame(self, frame):
        raise NotImplementedError("TTS service not initialized")
        if False:  # pragma: no cover
            yield frame
