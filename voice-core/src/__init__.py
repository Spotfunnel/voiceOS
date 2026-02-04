"""
Voice Core (Layer 1) - Immutable voice AI foundation

This layer provides:
- Telephony integration (Daily.co, Twilio)
- STT → LLM → TTS pipeline (streaming)
- Event emission for observability
- Capture primitives (Layer 1 only, no orchestration)

Architecture: Three-layer separation
- Layer 1: Voice Core (this package) - immutable across customers
- Layer 2: Orchestration - objective sequencing (separate package)
- Layer 3: Workflows - business automation (customer-provided)
"""

__version__ = "0.1.0"
