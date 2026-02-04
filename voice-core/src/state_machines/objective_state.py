"""
Objective State Machine for deterministic capture primitive execution.

Implements the state machine pattern from research/07-state-machines.md:
- Deterministic state transitions (same inputs → same state)
- Event emission on state changes
- Bounded LLM control within states
- Resumable state after interruptions

Critical Rules:
- State transitions are deterministic
- Events emitted at every state transition
- State checkpointed after each transition (for Layer 2)
"""

from enum import Enum
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ObjectiveState(Enum):
    """
    Objective state machine states.
    
    Aligned with research/07-state-machines.md and pipecat-voice-ai/SKILL.md.
    """
    PENDING = "pending"           # Not yet started
    ELICITING = "eliciting"       # Asking user for information
    CAPTURED = "captured"         # User response captured
    VALIDATING = "validating"     # Validating captured value
    CONFIRMING = "confirming"     # Confirming with user (ALWAYS for critical data)
    REPAIRING = "repairing"       # User corrected value, re-validating
    CONFIRMED = "confirmed"       # User confirmed value
    COMPLETED = "completed"       # Objective successfully completed
    FAILED = "failed"             # Objective failed (max retries exceeded)


@dataclass
class StateTransitionEvent:
    """Event emitted on state transition"""
    from_state: ObjectiveState
    to_state: ObjectiveState
    event_type: str
    objective_type: str
    timestamp: datetime = field(default_factory=datetime.now)
    context: Dict[str, Any] = field(default_factory=dict)
    

class ObjectiveStateMachine:
    """
    Deterministic state machine for objective execution.
    
    Key Properties:
    - Deterministic: Same inputs → same state transitions
    - Observable: Emits events at every state transition
    - Resumable: Can save/restore state after interruption
    - Bounded: LLM operates WITHIN states, cannot skip states
    
    Usage:
        sm = ObjectiveStateMachine("capture_email_au")
        sm.transition("start")  # PENDING → ELICITING
        sm.transition("user_spoke", value="test@example.com", confidence=0.8)  # ELICITING → CAPTURED
        sm.transition("validate", is_valid=True, is_critical=True)  # CAPTURED → CONFIRMING
        sm.transition("user_affirmed")  # CONFIRMING → CONFIRMED
        sm.transition("complete")  # CONFIRMED → COMPLETED
    """
    
    def __init__(
        self,
        objective_type: str,
        locale: str = "en-AU",
        max_retries: int = 3,
        event_callback: Optional[Callable[[StateTransitionEvent], None]] = None
    ):
        """
        Initialize objective state machine.
        
        Args:
            objective_type: Type of objective (e.g., "capture_email_au", "capture_phone_au")
            locale: Locale for validation (default: "en-AU")
            max_retries: Maximum retry attempts before failure (default: 3)
            event_callback: Optional callback for state transition events
        """
        self.objective_type = objective_type
        self.locale = locale
        self.max_retries = max_retries
        self.event_callback = event_callback
        
        # State
        self.state = ObjectiveState.PENDING
        self.captured_value: Optional[str] = None
        self.retry_count = 0
        self.confidence: Optional[float] = None
        self.metadata: Dict[str, Any] = {}
        
        # State history for debugging
        self.state_history: List[StateTransitionEvent] = []
        
    def transition(self, event: str, **kwargs) -> ObjectiveState:
        """
        Execute deterministic state transition.
        
        Args:
            event: Event type triggering transition
            **kwargs: Event-specific parameters
            
        Returns:
            New state after transition
            
        Raises:
            ValueError: If transition is invalid for current state
        """
        old_state = self.state
        
        # Execute transition based on current state and event
        if self.state == ObjectiveState.PENDING and event == "start":
            self.state = ObjectiveState.ELICITING
            
        elif self.state == ObjectiveState.ELICITING and event == "user_spoke":
            confidence = kwargs.get("confidence", 0.0)
            value = kwargs.get("value")
            
            # Minimum confidence threshold to capture
            if confidence >= 0.4:
                self.captured_value = value
                self.confidence = confidence
                self.state = ObjectiveState.CAPTURED
            else:
                # Low confidence - re-elicit
                self.retry_count += 1
                if self.retry_count >= self.max_retries:
                    self.state = ObjectiveState.FAILED
                # else stay in ELICITING
                
        elif self.state == ObjectiveState.CAPTURED and event == "validate":
            is_valid = kwargs.get("is_valid", False)
            is_critical = kwargs.get("is_critical", False)
            confidence = kwargs.get("confidence", self.confidence or 0.0)
            
            if not is_valid:
                # Validation failed - re-elicit
                self.retry_count += 1
                if self.retry_count >= self.max_retries:
                    self.state = ObjectiveState.FAILED
                else:
                    self.state = ObjectiveState.ELICITING
            elif is_critical:
                # Critical data ALWAYS requires confirmation (R-ARCH-006)
                self.state = ObjectiveState.CONFIRMING
            elif confidence < 0.7:
                # Low confidence - confirm even if not critical
                self.state = ObjectiveState.CONFIRMING
            else:
                # High confidence, non-critical - skip confirmation
                self.state = ObjectiveState.CONFIRMED
                
        elif self.state == ObjectiveState.CONFIRMING and event == "user_affirmed":
            # User confirmed value is correct
            self.state = ObjectiveState.CONFIRMED
            
        elif self.state == ObjectiveState.CONFIRMING and event == "user_corrected":
            # User provided correction
            new_value = kwargs.get("new_value")
            if new_value:
                self.captured_value = new_value
                self.state = ObjectiveState.REPAIRING
            else:
                # No correction provided - re-elicit
                self.retry_count += 1
                if self.retry_count >= self.max_retries:
                    self.state = ObjectiveState.FAILED
                else:
                    self.state = ObjectiveState.ELICITING
                    
        elif self.state == ObjectiveState.REPAIRING and event == "repaired":
            is_valid = kwargs.get("is_valid", False)
            if is_valid:
                # Re-confirm after repair
                self.state = ObjectiveState.CONFIRMING
            else:
                # Repair validation failed - re-elicit
                self.retry_count += 1
                if self.retry_count >= self.max_retries:
                    self.state = ObjectiveState.FAILED
                else:
                    self.state = ObjectiveState.ELICITING
                    
        elif self.state == ObjectiveState.CONFIRMED and event == "complete":
            # Objective successfully completed
            self.state = ObjectiveState.COMPLETED
            
        else:
            raise ValueError(
                f"Invalid transition: {self.state} -> {event}. "
                f"Valid transitions for {self.state}: {self._get_valid_transitions()}"
            )
        
        # Emit event if state changed
        if old_state != self.state:
            self._emit_event(old_state, self.state, event, kwargs)
            
        return self.state
    
    def _emit_event(
        self,
        from_state: ObjectiveState,
        to_state: ObjectiveState,
        event_type: str,
        context: Dict[str, Any]
    ) -> None:
        """
        Emit state transition event.
        
        Args:
            from_state: Previous state
            to_state: New state
            event_type: Event that triggered transition
            context: Event context/parameters
        """
        event = StateTransitionEvent(
            from_state=from_state,
            to_state=to_state,
            event_type=event_type,
            objective_type=self.objective_type,
            timestamp=datetime.now(),
            context=context
        )
        
        # Add to history
        self.state_history.append(event)
        
        # Log transition
        logger.info(
            f"State transition: {from_state.value} -> {to_state.value} "
            f"(event={event_type}, objective={self.objective_type})"
        )
        
        # Callback for external observers (Layer 2)
        if self.event_callback:
            try:
                self.event_callback(event)
            except Exception as e:
                logger.error(f"Error in event callback: {e}")
    
    def _get_valid_transitions(self) -> List[str]:
        """Get list of valid event types for current state"""
        transitions = {
            ObjectiveState.PENDING: ["start"],
            ObjectiveState.ELICITING: ["user_spoke"],
            ObjectiveState.CAPTURED: ["validate"],
            ObjectiveState.CONFIRMING: ["user_affirmed", "user_corrected"],
            ObjectiveState.REPAIRING: ["repaired"],
            ObjectiveState.CONFIRMED: ["complete"],
            ObjectiveState.COMPLETED: [],  # Terminal state
            ObjectiveState.FAILED: []  # Terminal state
        }
        return transitions.get(self.state, [])
    
    def is_terminal(self) -> bool:
        """Check if state machine is in terminal state"""
        return self.state in [ObjectiveState.COMPLETED, ObjectiveState.FAILED]
    
    def get_state_checkpoint(self) -> Dict[str, Any]:
        """
        Get state checkpoint for persistence (Layer 2).
        
        Returns:
            Dict containing all state machine state for resumption
        """
        return {
            "objective_type": self.objective_type,
            "locale": self.locale,
            "state": self.state.value,
            "captured_value": self.captured_value,
            "retry_count": self.retry_count,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "max_retries": self.max_retries,
            "timestamp": datetime.now().isoformat()
        }
    
    @classmethod
    def from_checkpoint(
        cls,
        checkpoint: Dict[str, Any],
        event_callback: Optional[Callable[[StateTransitionEvent], None]] = None
    ) -> "ObjectiveStateMachine":
        """
        Restore state machine from checkpoint.
        
        Args:
            checkpoint: State checkpoint from get_state_checkpoint()
            event_callback: Optional callback for state transition events
            
        Returns:
            Restored state machine instance
        """
        sm = cls(
            objective_type=checkpoint["objective_type"],
            locale=checkpoint["locale"],
            max_retries=checkpoint.get("max_retries", 3),
            event_callback=event_callback
        )
        
        sm.state = ObjectiveState(checkpoint["state"])
        sm.captured_value = checkpoint.get("captured_value")
        sm.retry_count = checkpoint.get("retry_count", 0)
        sm.confidence = checkpoint.get("confidence")
        sm.metadata = checkpoint.get("metadata", {})
        
        return sm
