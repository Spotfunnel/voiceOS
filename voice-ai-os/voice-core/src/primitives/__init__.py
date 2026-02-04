"""
Voice Core Primitives (Layer 1)

Immutable capture primitives for Australian locale.
These primitives MUST NOT be customer-configurable.
"""

from .base import ObjectiveState, ObjectiveStateMachine

__all__ = [
    'ObjectiveState',
    'ObjectiveStateMachine',
]
