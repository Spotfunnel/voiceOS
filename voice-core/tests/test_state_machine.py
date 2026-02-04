"""
Unit tests for ObjectiveStateMachine.

Tests deterministic state transitions and event emission.
"""

import pytest
from src.state_machines.objective_state import (
    ObjectiveState,
    ObjectiveStateMachine,
    StateTransitionEvent
)


class TestObjectiveStateMachine:
    """Test suite for ObjectiveStateMachine"""
    
    def test_initial_state(self):
        """Test state machine starts in PENDING state"""
        sm = ObjectiveStateMachine("test_objective")
        assert sm.state == ObjectiveState.PENDING
        assert sm.captured_value is None
        assert sm.retry_count == 0
    
    def test_start_transition(self):
        """Test PENDING -> ELICITING transition"""
        sm = ObjectiveStateMachine("test_objective")
        new_state = sm.transition("start")
        assert new_state == ObjectiveState.ELICITING
        assert sm.state == ObjectiveState.ELICITING
    
    def test_capture_with_high_confidence(self):
        """Test ELICITING -> CAPTURED with high confidence"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        
        new_state = sm.transition(
            "user_spoke",
            value="test@example.com",
            confidence=0.8
        )
        
        assert new_state == ObjectiveState.CAPTURED
        assert sm.captured_value == "test@example.com"
        assert sm.confidence == 0.8
    
    def test_capture_with_low_confidence_retry(self):
        """Test ELICITING stays in ELICITING with low confidence"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        
        new_state = sm.transition(
            "user_spoke",
            value="unclear",
            confidence=0.3  # Below 0.4 threshold
        )
        
        # Should stay in ELICITING and increment retry count
        assert new_state == ObjectiveState.ELICITING
        assert sm.retry_count == 1
    
    def test_max_retries_failure(self):
        """Test FAILED state after max retries"""
        sm = ObjectiveStateMachine("test_objective", max_retries=3)
        sm.transition("start")
        
        # Fail 3 times
        for i in range(3):
            sm.transition("user_spoke", value="unclear", confidence=0.3)
        
        assert sm.state == ObjectiveState.FAILED
        assert sm.retry_count == 3
    
    def test_critical_data_always_confirms(self):
        """Test critical data ALWAYS goes to CONFIRMING"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="test@example.com", confidence=0.95)
        
        # Even with high confidence, critical data must confirm
        new_state = sm.transition(
            "validate",
            is_valid=True,
            is_critical=True,
            confidence=0.95
        )
        
        assert new_state == ObjectiveState.CONFIRMING
    
    def test_non_critical_high_confidence_skips_confirmation(self):
        """Test non-critical data with high confidence skips confirmation"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="John", confidence=0.9)
        
        # Non-critical with high confidence should skip confirmation
        new_state = sm.transition(
            "validate",
            is_valid=True,
            is_critical=False,
            confidence=0.9
        )
        
        assert new_state == ObjectiveState.CONFIRMED
    
    def test_validation_failure_re_elicits(self):
        """Test validation failure returns to ELICITING"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="invalid", confidence=0.8)
        
        new_state = sm.transition(
            "validate",
            is_valid=False
        )
        
        assert new_state == ObjectiveState.ELICITING
        assert sm.retry_count == 1
    
    def test_user_affirmed_confirmation(self):
        """Test CONFIRMING -> CONFIRMED on user affirmation"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="test@example.com", confidence=0.8)
        sm.transition("validate", is_valid=True, is_critical=True)
        
        new_state = sm.transition("user_affirmed")
        
        assert new_state == ObjectiveState.CONFIRMED
    
    def test_user_correction_flow(self):
        """Test CONFIRMING -> REPAIRING -> CONFIRMING flow"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="wrong@example.com", confidence=0.8)
        sm.transition("validate", is_valid=True, is_critical=True)
        
        # User corrects
        new_state = sm.transition(
            "user_corrected",
            new_value="correct@example.com"
        )
        
        assert new_state == ObjectiveState.REPAIRING
        assert sm.captured_value == "correct@example.com"
        
        # Repair valid
        new_state = sm.transition("repaired", is_valid=True)
        
        assert new_state == ObjectiveState.CONFIRMING
    
    def test_complete_transition(self):
        """Test CONFIRMED -> COMPLETED transition"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="test@example.com", confidence=0.8)
        sm.transition("validate", is_valid=True, is_critical=True)
        sm.transition("user_affirmed")
        
        new_state = sm.transition("complete")
        
        assert new_state == ObjectiveState.COMPLETED
        assert sm.is_terminal()
    
    def test_invalid_transition_raises_error(self):
        """Test invalid transition raises ValueError"""
        sm = ObjectiveStateMachine("test_objective")
        
        with pytest.raises(ValueError, match="Invalid transition"):
            sm.transition("invalid_event")
    
    def test_state_history_tracking(self):
        """Test state transitions are recorded in history"""
        sm = ObjectiveStateMachine("test_objective")
        
        sm.transition("start")
        sm.transition("user_spoke", value="test", confidence=0.8)
        
        assert len(sm.state_history) == 2
        assert sm.state_history[0].from_state == ObjectiveState.PENDING
        assert sm.state_history[0].to_state == ObjectiveState.ELICITING
        assert sm.state_history[1].from_state == ObjectiveState.ELICITING
        assert sm.state_history[1].to_state == ObjectiveState.CAPTURED
    
    def test_event_callback(self):
        """Test event callback is invoked on transitions"""
        events = []
        
        def callback(event: StateTransitionEvent):
            events.append(event)
        
        sm = ObjectiveStateMachine("test_objective", event_callback=callback)
        sm.transition("start")
        
        assert len(events) == 1
        assert events[0].from_state == ObjectiveState.PENDING
        assert events[0].to_state == ObjectiveState.ELICITING
        assert events[0].objective_type == "test_objective"
    
    def test_checkpoint_and_restore(self):
        """Test state machine can be checkpointed and restored"""
        sm = ObjectiveStateMachine("test_objective")
        sm.transition("start")
        sm.transition("user_spoke", value="test@example.com", confidence=0.8)
        
        # Get checkpoint
        checkpoint = sm.get_state_checkpoint()
        
        assert checkpoint["state"] == ObjectiveState.CAPTURED.value
        assert checkpoint["captured_value"] == "test@example.com"
        assert checkpoint["retry_count"] == 0
        
        # Restore from checkpoint
        restored_sm = ObjectiveStateMachine.from_checkpoint(checkpoint)
        
        assert restored_sm.state == ObjectiveState.CAPTURED
        assert restored_sm.captured_value == "test@example.com"
        assert restored_sm.retry_count == 0
        assert restored_sm.objective_type == "test_objective"


@pytest.mark.asyncio
class TestDeterministicBehavior:
    """Test deterministic behavior (same inputs → same state)"""
    
    def test_deterministic_happy_path(self):
        """Test same sequence produces same states"""
        # Run sequence twice
        for _ in range(2):
            sm = ObjectiveStateMachine("test_objective")
            
            sm.transition("start")
            sm.transition("user_spoke", value="test@example.com", confidence=0.8)
            sm.transition("validate", is_valid=True, is_critical=True)
            sm.transition("user_affirmed")
            sm.transition("complete")
            
            assert sm.state == ObjectiveState.COMPLETED
            assert sm.captured_value == "test@example.com"
    
    def test_deterministic_failure_path(self):
        """Test same failure sequence produces same states"""
        for _ in range(2):
            sm = ObjectiveStateMachine("test_objective", max_retries=2)
            
            sm.transition("start")
            sm.transition("user_spoke", value="fail1", confidence=0.3)
            sm.transition("user_spoke", value="fail2", confidence=0.3)
            
            assert sm.state == ObjectiveState.FAILED
            assert sm.retry_count == 2
