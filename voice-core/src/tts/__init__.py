"""
Text-to-Speech (TTS) services with multi-provider fallback and circuit breakers.

Primary: Cartesia Sonic 3 ($0.000037/char - lowest cost)
Fallback: ElevenLabs

Architecture compliance:
- Circuit breakers prevent cascading failures
- Automatic fallback on provider outages
- Non-blocking operations
"""

from .cartesia_tts import CartesiaTTSService
from .elevenlabs_tts import ElevenLabsTTSService
from .multi_provider_tts import MultiProviderTTS

__all__ = [
    "CartesiaTTSService",
    "ElevenLabsTTSService",
    "MultiProviderTTS",
]
