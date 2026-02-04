"""
Base classes for Voice Core primitives

State machine implementation for objective execution.
Enforces deterministic state transitions (no LLM hallucination).
"""

from enum import Enum
from typing import Optional, Any
from dataclasses import dataclass
from datetime import datetime


class ObjectiveState(Enum):
    """Objective state machine states (immutable across customers)"""
    PENDING = "pending"
    ELICITING = "eliciting"
    CAPTURED = "captured"
    CONFIRMING = "confirming"
    REPAIRING = "repairing"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class StateTransition:
    """Record of state transition for event emission"""
    from_state: ObjectiveState
    to_state: ObjectiveState
    event: str
    timestamp: datetime
    data: Optional[dict] = None


class ObjectiveStateMachine:
    """
    Deterministic state machine for objective execution.
    
    This enforces bounded LLM control - LLM generates responses
    WITHIN current state, but cannot skip state transitions.
    
    Production evidence (ARCHITECTURE_LAWS.md):
    - 68% of production agents execute ≤10 steps before requiring boundaries
    - Genie framework: Algorithmic runtime achieved 82.8% vs 21.8% with pure LLM control
    """
    
    def __init__(self, objective_type: str, is_critical: bool = False):
        self.objective_type = objective_type
        self.is_critical = is_critical  # Critical data ALWAYS confirmed (R-ARCH-006)
        self.state = ObjectiveState.PENDING
        self.captured_value: Optional[Any] = None
        self.retry_count = 0
        self.max_retries = 3
        self.transitions: list[StateTransition] = []
        
    def transition(self, event: str, **kwargs) -> ObjectiveState:
        """
        Execute deterministic state transition.
        
        Args:
            event: Transition event (e.g., 'start', 'user_spoke', 'validate')
            **kwargs: Event-specific parameters (confidence, value, is_valid, etc.)
            
        Returns:
            New state after transition
        """
        old_state = self.state
        
        # PENDING → ELICITING
        if self.state == ObjectiveState.PENDING and event == "start":
            self.state = ObjectiveState.ELICITING
            
        # ELICITING → CAPTURED (user spoke with acceptable confidence)
        elif self.state == ObjectiveState.ELICITING and event == "user_spoke":
            confidence = kwargs.get("confidence", 0)
            if confidence >= 0.4:  # Minimum confidence threshold
                self.captured_value = kwargs.get("value")
                self.state = ObjectiveState.CAPTURED
            else:
                # Low confidence - re-elicit
                self.retry_count += 1
                if self.retry_count >= self.max_retries:
                    self.state = ObjectiveState.FAILED
                # else stay in ELICITING
                
        # CAPTURED → CONFIRMING or CONFIRMED
        elif self.state == ObjectiveState.CAPTURED and event == "validate":
            is_valid = kwargs.get("is_valid", False)
            confidence = kwargs.get("confidence", 0)
            
            if not is_valid:
                # Validation failed - repair
                self.state = ObjectiveState.REPAIRING
            elif self.is_critical or confidence < 0.7:
                # Critical data OR low confidence - always confirm (R-ARCH-006)
                self.state = ObjectiveState.CONFIRMING
            else:
                # Non-critical high-confidence data - skip confirmation
                self.state = ObjectiveState.CONFIRMED
                
        # CONFIRMING → CONFIRMED (user affirmed)
        elif self.state == ObjectiveState.CONFIRMING and event == "user_affirmed":
            self.state = ObjectiveState.CONFIRMED
            
        # CONFIRMING → REPAIRING (user corrected)
        elif self.state == ObjectiveState.CONFIRMING and event == "user_corrected":
            self.captured_value = kwargs.get("new_value")
            self.state = ObjectiveState.REPAIRING
            
        # REPAIRING → CONFIRMING (re-confirm after repair)
        elif self.state == ObjectiveState.REPAIRING and event == "repaired":
            self.state = ObjectiveState.CONFIRMING
            
        # CONFIRMED → COMPLETED
        elif self.state == ObjectiveState.CONFIRMED and event == "complete":
            self.state = ObjectiveState.COMPLETED
            
        # Record transition for observability (R-ARCH-009)
        if old_state != self.state:
            transition = StateTransition(
                from_state=old_state,
                to_state=self.state,
                event=event,
                timestamp=datetime.now(),
                data=kwargs
            )
            self.transitions.append(transition)
            
        return self.state
    
    def can_transition(self, event: str) -> bool:
        """Check if transition is valid from current state"""
        # Simplified validation - actual implementation would have full FSM
        valid_transitions = {
            ObjectiveState.PENDING: ["start"],
            ObjectiveState.ELICITING: ["user_spoke"],
            ObjectiveState.CAPTURED: ["validate"],
            ObjectiveState.CONFIRMING: ["user_affirmed", "user_corrected"],
            ObjectiveState.REPAIRING: ["repaired"],
            ObjectiveState.CONFIRMED: ["complete"],
        }
        return event in valid_transitions.get(self.state, [])
    
    def reset(self):
        """Reset state machine for retry"""
        self.state = ObjectiveState.PENDING
        self.captured_value = None
        self.retry_count = 0
        self.transitions = []
