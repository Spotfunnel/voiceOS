"""
Voice Core (Layer 1) - Immutable voice AI foundation

This package provides the foundational voice AI capabilities using Pipecat framework:
- Telephony integration (Daily.co, PSTN)
- Audio pipeline (STT → LLM → TTS)
- Capture primitives (email, phone, address)
- Turn-taking and barge-in handling
- Event emission for observability

Architecture: Three-layer separation
- Layer 1 (Voice Core): Immutable, shared across all customers
- Layer 2 (Orchestration): Customer-specific objective sequencing
- Layer 3 (Workflows): Business logic and CRM integration

All operations are async and non-blocking.
"""

__version__ = "0.1.0"

from voice_core.pipeline import VoicePipeline

__all__ = ["VoicePipeline"]
