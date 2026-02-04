"""
Multi-provider LLM with automatic fallback and circuit breakers.

Primary: Gemini 2.5 Flash ($0.010-$0.015/min, 94.9% pass rate)
Fallback: GPT-4.1 ($0.015-$0.020/min, 94.9% pass rate)

Architecture:
- Try primary provider first
- On circuit breaker open, automatically fall back to secondary
- Track provider usage and costs
- Non-blocking operations

Reference: research/12-model-stack-optimization.md - "Gemini 2.5 Flash production standard (Feb 2026)"
"""

import asyncio
from typing import Optional, AsyncIterator
import logging

from pipecat.frames.frames import Frame, LLMMessagesFrame, TextFrame
from pipecat.processors.frame_processor import FrameProcessor

from .gemini_llm import GeminiLLMService, CircuitBreakerOpen as GeminiCircuitBreakerOpen
from .openai_llm import OpenAILLMService, CircuitBreakerOpen as OpenAICircuitBreakerOpen

logger = logging.getLogger(__name__)


class AllLLMProvidersFailed(Exception):
    """Raised when all LLM providers have failed"""
    pass


class MultiProviderLLM(FrameProcessor):
    """
    Multi-provider LLM with automatic fallback.
    
    Fallback strategy:
    1. Try Gemini 2.5 Flash (primary, 30-40% lower cost)
    2. On failure/circuit open, try GPT-4.1 (fallback)
    3. If both fail, raise AllLLMProvidersFailed
    
    Implements Pipecat FrameProcessor interface for pipeline integration.
    """
    
    def __init__(
        self,
        gemini: Optional[GeminiLLMService] = None,
        openai: Optional[OpenAILLMService] = None,
    ):
        """
        Initialize multi-provider LLM.
        
        Args:
            gemini: Gemini LLM service (primary)
            openai: OpenAI LLM service (fallback)
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()

        super().__init__(loop=loop)
        
        # Initialize providers
        self.gemini = gemini or GeminiLLMService.from_env()
        self.openai = openai or OpenAILLMService.from_env()
        
        # Provider usage tracking
        self.provider_usage = {
            "gemini": 0,
            "openai": 0,
        }
        
        # Cost tracking (approximate, per minute)
        self.cost_per_min = {
            "gemini": 0.0125,  # Average of $0.010-$0.015
            "openai": 0.0175,  # Average of $0.015-$0.020
        }
        self.total_cost = 0.0
        self.call_start_time: Optional[float] = None
        
    async def process_frame(self, frame: Frame, direction) -> AsyncIterator[Frame]:
        """
        Process frame through LLM pipeline with automatic fallback.
        
        Args:
            frame: Input frame (LLMMessagesFrame for LLM, others pass through)
            direction: Frame direction
            
        Yields:
            Frame objects (TextFrame, LLMMessagesFrame, etc.)
        """
        # Pass through non-LLM frames
        if not isinstance(frame, (LLMMessagesFrame, TextFrame)):
            yield frame
            return
        
        # Track call start time for cost calculation
        if self.call_start_time is None:
            self.call_start_time = asyncio.get_event_loop().time()
        
        # Try Gemini first (primary, lower cost)
        try:
            logger.debug("Trying Gemini 2.5 Flash LLM...")
            async for output_frame in self.gemini.process_frame(frame, direction):
                yield output_frame
            
            # Track usage
            self.provider_usage["gemini"] += 1
            elapsed_min = (asyncio.get_event_loop().time() - self.call_start_time) / 60
            self.total_cost += elapsed_min * self.cost_per_min["gemini"]
            logger.debug(f"Gemini LLM success. Total cost: ${self.total_cost:.6f}")
            return
            
        except GeminiCircuitBreakerOpen:
            logger.warning("Gemini LLM circuit breaker open, falling back to OpenAI")
        except Exception as e:
            logger.error(f"Gemini LLM failed: {e}, falling back to OpenAI")
        
        # Try OpenAI fallback
        try:
            logger.debug("Trying OpenAI GPT-4.1 LLM...")
            async for output_frame in self.openai.process_frame(frame, direction):
                yield output_frame
            
            # Track usage
            self.provider_usage["openai"] += 1
            elapsed_min = (asyncio.get_event_loop().time() - self.call_start_time) / 60
            self.total_cost += elapsed_min * self.cost_per_min["openai"]
            logger.warning(f"OpenAI LLM fallback success. Total cost: ${self.total_cost:.6f}")
            return
            
        except OpenAICircuitBreakerOpen:
            logger.error("OpenAI LLM circuit breaker open")
        except Exception as e:
            logger.error(f"OpenAI LLM failed: {e}")
        
        # Both providers failed
        raise AllLLMProvidersFailed(
            "All LLM providers failed. Gemini circuit breaker: "
            f"{self.gemini.is_circuit_open}, OpenAI circuit breaker: "
            f"{self.openai.is_circuit_open}"
        )
    
    def get_provider_stats(self) -> dict:
        """
        Get provider usage statistics.
        
        Returns:
            Dict with provider usage counts and costs
        """
        return {
            "usage": self.provider_usage,
            "total_cost": self.total_cost,
            "gemini_circuit_open": self.gemini.is_circuit_open,
            "openai_circuit_open": self.openai.is_circuit_open,
        }
    
    def reset_circuit_breakers(self):
        """Reset all circuit breakers (for testing/manual intervention)"""
        self.gemini.reset_circuit_breaker()
        self.openai.reset_circuit_breaker()
        logger.info("All LLM circuit breakers reset")
    
    @classmethod
    def from_env(cls):
        """
        Create MultiProviderLLM from environment variables.
        
        Environment variables:
            GOOGLE_API_KEY: Google API key (required)
            OPENAI_API_KEY: OpenAI API key (required)
        """
        gemini = GeminiLLMService.from_env()
        openai = OpenAILLMService.from_env()
        
        return cls(
            gemini=gemini,
            openai=openai
        )
