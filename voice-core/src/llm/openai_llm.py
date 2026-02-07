"""
OpenAI GPT-4.1 LLM service (fallback)

Cost: $0.015-$0.020/min (research/12 - most widely adopted)
Latency: ~700ms TTFT
Quality: 94.9% pass rate on 30-turn conversation benchmark

Features:
- Streaming responses (non-blocking)
- Function calling support
- Circuit breaker for failover
- Used as fallback when Gemini fails
"""

import os
import asyncio
from typing import Optional, AsyncIterator
import logging

try:
    from pipecat.services.openai import OpenAILLMService as PipecatOpenAILLM
except Exception:  # pragma: no cover - optional dependency
    PipecatOpenAILLM = None
from pipecat.frames.frames import Frame

logger = logging.getLogger(__name__)


class OpenAILLMService:
    """
    Wrapper around Pipecat's OpenAILLMService with circuit breaker support.
    
    Fallback LLM provider for Voice Core.
    Cost: $0.015-$0.020/min (most widely adopted production LLM)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4.1",
    ):
        """
        Initialize OpenAI LLM service.
        
        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: OpenAI model (defaults to gpt-4.1)
        """
        if PipecatOpenAILLM is None:
            raise RuntimeError("OpenAI LLM dependency not available.")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY must be set in environment or passed as argument")
        
        self.model = model
        
        # Create Pipecat OpenAILLM service lazily
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
        Process frame through OpenAI LLM (streaming).
        
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
                    logger.info("OpenAI LLM circuit breaker: attempting recovery")
                    self.circuit_open = False
                    self.failure_count = 0
                else:
                    raise CircuitBreakerOpen(
                        f"OpenAI LLM circuit breaker open. "
                        f"Retry in {self.recovery_timeout - elapsed:.1f}s"
                    )
            else:
                raise CircuitBreakerOpen("OpenAI LLM circuit breaker open")
        
        try:
            # Ensure underlying service is initialized inside an active event loop
            if isinstance(self.service, _StubLLMService):
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()

                self.service = PipecatOpenAILLM(
                    api_key=self.api_key,
                    model=self.model,
                    loop=loop,
                )
                self._default_process_frame = self.service.process_frame

            # Call Pipecat service (handle async generator or coroutine)
            result = self.service.process_frame(frame, direction)
            if hasattr(result, "__aiter__"):
                async for output_frame in result:
                    yield output_frame
            else:
                output = await result
                if output is None:
                    pass
                elif isinstance(output, list):
                    for output_frame in output:
                        yield output_frame
                else:
                    yield output
            
            # Reset failure count on success
            self.failure_count = 0
            
        except Exception as e:
            # Increment failure count
            self.failure_count += 1
            logger.error(f"OpenAI LLM error (failure {self.failure_count}/{self.failure_threshold}): {e}")
            
            # Open circuit if threshold reached
            if self.failure_count >= self.failure_threshold:
                self.circuit_open = True
                self.last_failure_time = asyncio.get_event_loop().time()
                logger.warning(
                    f"OpenAI LLM circuit breaker OPEN after {self.failure_count} failures. "
                    f"Will retry in {self.recovery_timeout}s"
                )
            
            raise
    
    def reset_circuit_breaker(self):
        """Reset circuit breaker (for testing/manual intervention)"""
        self.failure_count = 0
        self.circuit_open = False
        self.last_failure_time = None
        logger.info("OpenAI LLM circuit breaker reset")
    
    @property
    def is_circuit_open(self) -> bool:
        """Check if circuit breaker is open"""
        return self.circuit_open

    def _ensure_service(self):
        if isinstance(self.service, _StubLLMService):
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()

            self.service = PipecatOpenAILLM(
                api_key=self.api_key,
                model=self.model,
                loop=loop,
            )
            self._default_process_frame = self.service.process_frame

    def register_function(self, function_name: str, handler):
        """Register a function handler for OpenAI function calling."""
        self._ensure_service()
        self.service.register_function(function_name, handler)

    def register_direct_function(self, handler):
        """Register a direct function handler for OpenAI function calling."""
        self._ensure_service()
        self.service.register_direct_function(handler)
    
    @classmethod
    def from_env(cls):
        """
        Create OpenAILLMService from environment variables.
        
        Environment variables:
            OPENAI_API_KEY: OpenAI API key (required)
            OPENAI_MODEL: OpenAI model (optional, defaults to gpt-4.1)
        """
        model = os.getenv("OPENAI_MODEL", "gpt-4.1")
        
        return cls(model=model)


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open (provider unavailable)"""
    pass


class _StubLLMService:
    async def process_frame(self, frame, direction):
        raise NotImplementedError("LLM service not initialized")
        if False:  # pragma: no cover
            yield frame
