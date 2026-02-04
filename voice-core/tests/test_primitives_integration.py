"""
Integration tests for capture primitives.

Tests full execution flow from elicitation to completion.
"""

import pytest
from src.primitives.capture_email_au import CaptureEmailAU
from src.primitives.capture_phone_au import CapturePhoneAU
from src.state_machines.objective_state import ObjectiveState


@pytest.mark.asyncio
class TestEmailCaptureIntegration:
    """Integration tests for email capture primitive"""
    
    async def test_happy_path_with_confirmation(self):
        """Test successful email capture with confirmation"""
        primitive = CaptureEmailAU()
        
        # Start execution
        result = await primitive.execute()
        assert primitive.state_machine.state == ObjectiveState.ELICITING
        
        # User provides email
        result = await primitive.process_transcription(
            "jane at gmail dot com",
            confidence=0.85
        )
        
        # Should be in CONFIRMING state (email is critical)
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING
        assert primitive.state_machine.captured_value == "jane@gmail.com"
        
        # User confirms
        result = await primitive.process_transcription("yes that's correct")
        
        # Should be COMPLETED
        assert result is not None
        assert result.success
        assert result.state == ObjectiveState.COMPLETED
        assert result.value == "jane@gmail.com"
    
    async def test_correction_flow(self):
        """Test user correcting email during confirmation"""
        primitive = CaptureEmailAU()
        
        # Start and capture initial email
        await primitive.execute()
        await primitive.process_transcription(
            "wrong at gmail dot com",  # Use valid domain
            confidence=0.85
        )
        
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING
        
        # User corrects
        await primitive.process_transcription(
            "no it's correct at gmail dot com"
        )
        
        # Should be back in CONFIRMING with new value
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING
        assert primitive.state_machine.captured_value == "correct@gmail.com"
    
    async def test_validation_failure_retry(self):
        """Test re-elicitation on validation failure"""
        primitive = CaptureEmailAU()
        
        await primitive.execute()
        
        # User provides invalid email (no TLD)
        result = await primitive.process_transcription(
            "user at domain",
            confidence=0.85
        )
        
        # Should return to ELICITING
        assert primitive.state_machine.state == ObjectiveState.ELICITING
        assert primitive.state_machine.retry_count == 1


@pytest.mark.asyncio
class TestPhoneCaptureIntegration:
    """Integration tests for phone capture primitive"""
    
    async def test_happy_path_mobile(self):
        """Test successful mobile phone capture"""
        primitive = CapturePhoneAU()
        
        # Start execution
        await primitive.execute()
        assert primitive.state_machine.state == ObjectiveState.ELICITING
        
        # User provides mobile
        await primitive.process_transcription(
            "zero four one two three four five six seven eight",
            confidence=0.85
        )
        
        # Should be in CONFIRMING state (phone is critical)
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING
        
        # User confirms
        result = await primitive.process_transcription("yes")
        
        # Should be COMPLETED with normalized phone
        assert result is not None
        assert result.success
        assert result.state == ObjectiveState.COMPLETED
        assert result.value == "+61412345678"  # Normalized to +61
    
    async def test_happy_path_landline(self):
        """Test successful landline phone capture"""
        primitive = CapturePhoneAU()
        
        await primitive.execute()
        
        # User provides landline
        await primitive.process_transcription(
            "zero two nine eight seven six five four three two",
            confidence=0.85
        )
        
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING
        
        # Confirm
        result = await primitive.process_transcription("correct")
        
        assert result.success
        assert result.value == "+61298765432"  # Normalized
    
    async def test_phone_normalization_variations(self):
        """Test various phone formats normalize correctly"""
        test_cases = [
            ("0412345678", "+61412345678"),
            ("04 1234 5678", "+61412345678"),
            ("0412 345 678", "+61412345678"),
            ("+61 412 345 678", "+61412345678"),
        ]
        
        for input_transcription, expected_normalized in test_cases:
            primitive = CapturePhoneAU()
            await primitive.execute()
            await primitive.process_transcription(input_transcription, confidence=0.85)
            result = await primitive.process_transcription("yes")
            
            assert result.value == expected_normalized


@pytest.mark.asyncio
class TestCriticalDataConfirmation:
    """Test that critical data ALWAYS requires confirmation"""
    
    async def test_email_always_confirms_even_high_confidence(self):
        """Test email confirms even with 99% confidence"""
        primitive = CaptureEmailAU()
        
        await primitive.execute()
        await primitive.process_transcription(
            "jane at gmail dot com",
            confidence=0.99  # Very high confidence
        )
        
        # Should STILL require confirmation (email is critical)
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING
    
    async def test_phone_always_confirms_even_high_confidence(self):
        """Test phone confirms even with 99% confidence"""
        primitive = CapturePhoneAU()
        
        await primitive.execute()
        await primitive.process_transcription(
            "zero four one two three four five six seven eight",
            confidence=0.99  # Very high confidence
        )
        
        # Should STILL require confirmation (phone is critical)
        assert primitive.state_machine.state == ObjectiveState.CONFIRMING


@pytest.mark.asyncio
class TestMaxRetries:
    """Test max retry behavior"""
    
    async def test_email_fails_after_max_retries(self):
        """Test email capture fails after 3 retries"""
        primitive = CaptureEmailAU(max_retries=3)
        
        await primitive.execute()
        
        # Fail 3 times with low confidence
        for _ in range(3):
            await primitive.process_transcription(
                "unclear speech",
                confidence=0.2  # Below threshold
            )
        
        # Should be FAILED
        assert primitive.state_machine.state == ObjectiveState.FAILED
        assert primitive.state_machine.retry_count == 3
    
    async def test_phone_fails_after_validation_failures(self):
        """Test phone capture fails after validation failures"""
        primitive = CapturePhoneAU(max_retries=3)
        
        await primitive.execute()
        
        # Provide invalid phones 3 times
        invalid_phones = [
            "123",  # Too short
            "01234567890",  # Wrong area code
            "abcdefghij"  # Not numbers
        ]
        
        for invalid_phone in invalid_phones:
            await primitive.process_transcription(
                invalid_phone,
                confidence=0.8
            )
        
        # Should be FAILED
        assert primitive.state_machine.state == ObjectiveState.FAILED


@pytest.mark.asyncio
class TestStateCheckpointing:
    """Test state machine can be checkpointed and restored"""
    
    async def test_email_checkpoint_during_confirmation(self):
        """Test email capture can be checkpointed mid-flow"""
        primitive = CaptureEmailAU()
        
        await primitive.execute()
        await primitive.process_transcription(
            "jane at gmail dot com",
            confidence=0.85
        )
        
        # Get checkpoint at CONFIRMING state
        checkpoint = primitive.state_machine.get_state_checkpoint()
        
        assert checkpoint["state"] == ObjectiveState.CONFIRMING.value
        assert checkpoint["captured_value"] == "jane@gmail.com"
        
        # Restore from checkpoint
        from src.state_machines.objective_state import ObjectiveStateMachine
        restored_sm = ObjectiveStateMachine.from_checkpoint(checkpoint)
        
        assert restored_sm.state == ObjectiveState.CONFIRMING
        assert restored_sm.captured_value == "jane@gmail.com"
