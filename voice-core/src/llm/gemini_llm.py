"""
Google Gemini 2.5 Flash LLM service (primary)

Cost: $0.010-$0.015/min (research/12 - production standard as of Feb 2026)
Latency: ~700ms TTFT (Time to First Token)
Quality: 94.9% pass rate on 30-turn conversation benchmark

Features:
- Streaming responses (non-blocking)
- Function calling support
- Multimodal inputs (text, images, audio)
- Circuit breaker for failover
"""

import os
import asyncio
from typing import Optional, AsyncIterator
import logging

from pipecat.services.google import GoogleLLMService as PipecatGoogleLLM
from pipecat.frames.frames import Frame, LLMMessagesFrame, TextFrame

logger = logging.getLogger(__name__)


class GeminiLLMService:
    """
    Wrapper around Pipecat's GoogleLLMService with circuit breaker support.
    
    Primary LLM provider for Voice Core.
    Cost: $0.010-$0.015/min (30-40% lower than GPT-4.1)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.5-flash",
    ):
        """
        Initialize Gemini LLM service.
        
        Args:
            api_key: Google API key (defaults to GOOGLE_API_KEY env var)
            model: Gemini model (defaults to gemini-2.5-flash)
        """
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY must be set in environment or passed as argument")
        
        self.model = model
        
        # Create Pipecat GoogleLLM service lazily (avoid event loop errors in sync tests)
        self.service = _StubLLMService()
        self._default_process_frame = self.service.process_frame
        
        # Circuit breaker state
        self.failure_count = 0
        self.failure_threshold = 5  # Open circuit after 5 consecutive failures
        self.circuit_open = False
        self.last_failure_time: Optional[float] = None
        self.recovery_timeout = 60  # Try to close circuit after 60 seconds
        
    async def process_frame(self, frame: Frame, direction) -> AsyncIterator[Frame]:
        """
        Process frame through Gemini LLM (streaming).
        
        Args:
            frame: Input frame (LLMMessagesFrame for LLM)
            direction: Frame direction
            
        Yields:
            Frame objects (TextFrame, LLMMessagesFrame, etc.)
            
        Raises:
            CircuitBreakerOpen: If circuit breaker is open (too many failures)
            Exception: On LLM service failure
        """
        # Check circuit breaker
        if self.circuit_open:
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = asyncio.get_event_loop().time() - self.last_failure_time
                if elapsed >= self.recovery_timeout:
                    logger.info("Gemini LLM circuit breaker: attempting recovery")
                    self.circuit_open = False
                    self.failure_count = 0
                else:
                    raise CircuitBreakerOpen(
                        f"Gemini LLM circuit breaker open. "
                        f"Retry in {self.recovery_timeout - elapsed:.1f}s"
                    )
            else:
                raise CircuitBreakerOpen("Gemini LLM circuit breaker open")
        
        try:
            # Ensure underlying service is initialized inside an active event loop
            if self.service.process_frame is self._default_process_frame:
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()

                self.service = PipecatGoogleLLM(
                    api_key=self.api_key,
                    model=self.model,
                    loop=loop,
                )
                self._default_process_frame = self.service.process_frame

            # Call Pipecat service
            async for output_frame in self.service.process_frame(frame, direction):
                yield output_frame
            
            # Reset failure count on success
            self.failure_count = 0
            
        except Exception as e:
            # Increment failure count
            self.failure_count += 1
            logger.error(f"Gemini LLM error (failure {self.failure_count}/{self.failure_threshold}): {e}")
            
            # Open circuit if threshold reached
            if self.failure_count >= self.failure_threshold:
                self.circuit_open = True
                self.last_failure_time = asyncio.get_event_loop().time()
                logger.warning(
                    f"Gemini LLM circuit breaker OPEN after {self.failure_count} failures. "
                    f"Will retry in {self.recovery_timeout}s"
                )
            
            raise
    
    def reset_circuit_breaker(self):
        """Reset circuit breaker (for testing/manual intervention)"""
        self.failure_count = 0
        self.circuit_open = False
        self.last_failure_time = None
        logger.info("Gemini LLM circuit breaker reset")
    
    @property
    def is_circuit_open(self) -> bool:
        """Check if circuit breaker is open"""
        return self.circuit_open
    
    @classmethod
    def from_env(cls):
        """
        Create GeminiLLMService from environment variables.
        
        Environment variables:
            GOOGLE_API_KEY: Google API key (required)
            GEMINI_MODEL: Gemini model (optional, defaults to gemini-2.5-flash)
        """
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        return cls(model=model)


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open (provider unavailable)"""
    pass


class _StubLLMService:
    async def process_frame(self, frame, direction):
        raise NotImplementedError("LLM service not initialized")
        if False:  # pragma: no cover
            yield frame
