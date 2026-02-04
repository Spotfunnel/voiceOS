"""
Capture primitives for information extraction.

Immutable primitives that work identically across all customers:
- Email capture (with validation and confirmation)
- Phone capture (Australian format)
- Address capture
- Date/time capture
- Payment capture

All primitives use state machines for deterministic execution.
"""

from voice_core.primitives.base import (
    ObjectiveState,
    ObjectiveStateMachine,
    StateTransition,
)

__all__ = [
    "ObjectiveState",
    "ObjectiveStateMachine",
    "StateTransition",
]
