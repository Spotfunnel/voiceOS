"""
Multi-provider TTS with automatic fallback and circuit breakers.

Primary: Cartesia Sonic 3 ($0.000037/char)
Fallback: ElevenLabs (~$0.00015-$0.0003/char)

Architecture:
- Try primary provider first
- On circuit breaker open, automatically fall back to secondary
- Track provider usage and costs
- Non-blocking operations

Reference: production-failure-prevention.md - "Circuit Breakers for Downstream Services"
"""

import asyncio
from typing import Optional, AsyncIterator, List
import logging

from pipecat.frames.frames import TTSAudioFrame, TextFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor

from .cartesia_tts import CartesiaTTSService, CircuitBreakerOpen as CartesiaCircuitBreakerOpen
from .elevenlabs_tts import ElevenLabsTTSService, CircuitBreakerOpen as ElevenLabsCircuitBreakerOpen

logger = logging.getLogger(__name__)


class AllTTSProvidersFailed(Exception):
    """Raised when all TTS providers have failed"""
    pass


class MultiProviderTTS(FrameProcessor):
    """
    Multi-provider TTS with automatic fallback.
    
    Fallback strategy:
    1. Try Cartesia (primary, lowest cost)
    2. On failure/circuit open, try ElevenLabs (fallback)
    3. If both fail, raise AllTTSProvidersFailed
    
    Implements Pipecat FrameProcessor interface for pipeline integration.
    """
    
    def __init__(
        self,
        cartesia: Optional[CartesiaTTSService] = None,
        elevenlabs: Optional[ElevenLabsTTSService] = None,
    ):
        """
        Initialize multi-provider TTS.
        
        Args:
            cartesia: Cartesia TTS service (primary)
            elevenlabs: ElevenLabs TTS service (fallback)
        """
        super().__init__()
        
        # Initialize providers
        self.cartesia = cartesia or CartesiaTTSService.from_env()
        self.elevenlabs = elevenlabs or ElevenLabsTTSService.from_env()
        
        # Provider usage tracking
        self.provider_usage = {
            "cartesia": 0,
            "elevenlabs": 0,
        }
        
        # Cost tracking (approximate)
        self.cost_per_char = {
            "cartesia": 0.000037,
            "elevenlabs": 0.00020,  # Average
        }
        self.total_cost = 0.0
        
    async def process_frame(self, frame: Frame) -> AsyncIterator[Frame]:
        """
        Process frame through TTS pipeline with automatic fallback.
        
        Args:
            frame: Input frame (TextFrame for TTS)
            
        Yields:
            TTSAudioFrame objects with synthesized audio
        """
        # Pass through non-text frames
        if not isinstance(frame, TextFrame):
            yield frame
            return
        
        text = frame.text
        
        # Try Cartesia first (primary, lowest cost)
        try:
            logger.debug(f"Trying Cartesia TTS for text: {text[:50]}...")
            async for audio_frame in self.cartesia.synthesize(text):
                yield audio_frame
            
            # Track usage
            self.provider_usage["cartesia"] += 1
            self.total_cost += len(text) * self.cost_per_char["cartesia"]
            logger.debug(f"Cartesia TTS success. Total cost: ${self.total_cost:.6f}")
            return
            
        except CartesiaCircuitBreakerOpen:
            logger.warning("Cartesia TTS circuit breaker open, falling back to ElevenLabs")
        except Exception as e:
            logger.error(f"Cartesia TTS failed: {e}, falling back to ElevenLabs")
        
        # Try ElevenLabs fallback
        try:
            logger.debug(f"Trying ElevenLabs TTS for text: {text[:50]}...")
            async for audio_frame in self.elevenlabs.synthesize(text):
                yield audio_frame
            
            # Track usage
            self.provider_usage["elevenlabs"] += 1
            self.total_cost += len(text) * self.cost_per_char["elevenlabs"]
            logger.warning(f"ElevenLabs TTS fallback success. Total cost: ${self.total_cost:.6f}")
            return
            
        except ElevenLabsCircuitBreakerOpen:
            logger.error("ElevenLabs TTS circuit breaker open")
        except Exception as e:
            logger.error(f"ElevenLabs TTS failed: {e}")
        
        # Both providers failed
        raise AllTTSProvidersFailed(
            "All TTS providers failed. Cartesia circuit breaker: "
            f"{self.cartesia.is_circuit_open}, ElevenLabs circuit breaker: "
            f"{self.elevenlabs.is_circuit_open}"
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
            "cartesia_circuit_open": self.cartesia.is_circuit_open,
            "elevenlabs_circuit_open": self.elevenlabs.is_circuit_open,
        }
    
    def reset_circuit_breakers(self):
        """Reset all circuit breakers (for testing/manual intervention)"""
        self.cartesia.reset_circuit_breaker()
        self.elevenlabs.reset_circuit_breaker()
        logger.info("All TTS circuit breakers reset")
    
    @classmethod
    def from_env(cls):
        """
        Create MultiProviderTTS from environment variables.
        
        Environment variables:
            CARTESIA_API_KEY: Cartesia API key (required)
            ELEVENLABS_API_KEY: ElevenLabs API key (required)
        """
        cartesia = CartesiaTTSService.from_env()
        elevenlabs = ElevenLabsTTSService.from_env()
        
        return cls(
            cartesia=cartesia,
            elevenlabs=elevenlabs
        )
