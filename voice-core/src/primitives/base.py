"""
Base Capture Primitive for Layer 1 objectives.

Provides abstract interface for all capture primitives with standard flow:
1. Elicit: Ask user for information
2. Capture: Extract value from user response
3. Validate: Check if value meets requirements
4. Confirm: Verify with user (ALWAYS for critical data)
5. Complete: Return validated value

Critical Rules (R-ARCH-006):
- Email, phone, address, payment, datetime MUST ALWAYS be confirmed
- Confirmation is not optional based on confidence
- State machine ensures deterministic behavior
"""

from abc import ABC, abstractmethod
from typing import Optional, Any, Dict
from dataclasses import dataclass
import logging

from ..state_machines.objective_state import ObjectiveStateMachine, ObjectiveState

logger = logging.getLogger(__name__)


@dataclass
class CaptureResult:
    """Result of capture primitive execution"""
    success: bool
    value: Optional[str]
    state: ObjectiveState
    retry_count: int
    confidence: Optional[float] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class BaseCaptureObjective(ABC):
    """
    Abstract base class for capture primitives.
    
    All capture primitives follow the same execution flow:
    1. ELICIT: Ask user for information
    2. CAPTURE: Extract value from user response
    3. VALIDATE: Check if value meets requirements
    4. CONFIRM: Verify with user (ALWAYS for critical data)
    5. COMPLETE: Return validated value
    
    Subclasses must implement:
    - get_elicitation_prompt(): Return prompt to ask user
    - extract_value(): Extract value from user transcription
    - validate_value(): Validate extracted value
    - get_confirmation_prompt(): Return confirmation prompt
    - normalize_value(): Normalize value for storage
    
    The state machine ensures deterministic transitions and handles:
    - Low confidence re-elicitation
    - Validation failures
    - User corrections during confirmation
    - Maximum retry limits
    """
    
    def __init__(
        self,
        objective_type: str,
        locale: str = "en-AU",
        is_critical: bool = True,
        max_retries: int = 3
    ):
        """
        Initialize capture primitive.
        
        Args:
            objective_type: Type identifier (e.g., "capture_email_au")
            locale: Locale for validation (default: "en-AU")
            is_critical: If True, ALWAYS confirm (default: True)
            max_retries: Maximum retry attempts (default: 3)
        """
        self.objective_type = objective_type
        self.locale = locale
        self.is_critical = is_critical
        self.max_retries = max_retries
        
        # State machine for deterministic execution
        self.state_machine = ObjectiveStateMachine(
            objective_type=objective_type,
            locale=locale,
            max_retries=max_retries
        )
        
    async def execute(self) -> CaptureResult:
        """
        Execute capture primitive with standard flow.
        
        This method orchestrates the capture flow using the state machine:
        1. Start state machine (PENDING → ELICITING)
        2. Elicit information from user
        3. Capture and extract value from response
        4. Validate extracted value
        5. Confirm with user (ALWAYS for critical data)
        6. Handle corrections if needed
        7. Complete and return result
        
        Returns:
            CaptureResult with success status and captured value
        """
        try:
            # Start state machine
            self.state_machine.transition("start")
            
            # Main execution loop
            while not self.state_machine.is_terminal():
                
                if self.state_machine.state == ObjectiveState.ELICITING:
                    # Elicit information from user
                    await self._elicit()
                    
                    # Simulate capture (in real implementation, this waits for user speech)
                    # For now, return to allow external orchestration
                    # The actual capture happens via process_transcription()
                    break
                    
                elif self.state_machine.state == ObjectiveState.CONFIRMING:
                    # Confirm with user
                    await self._confirm()
                    break
                    
                elif self.state_machine.state == ObjectiveState.CONFIRMED:
                    # Complete objective
                    self.state_machine.transition("complete")
                    
            # Return result
            return CaptureResult(
                success=(self.state_machine.state == ObjectiveState.COMPLETED),
                value=self.state_machine.captured_value,
                state=self.state_machine.state,
                retry_count=self.state_machine.retry_count,
                confidence=self.state_machine.confidence,
                metadata=self.state_machine.metadata
            )
            
        except Exception as e:
            logger.error(f"Error executing {self.objective_type}: {e}")
            return CaptureResult(
                success=False,
                value=None,
                state=ObjectiveState.FAILED,
                retry_count=self.state_machine.retry_count,
                metadata={"error": str(e)}
            )
    
    async def process_transcription(
        self,
        transcription: str,
        confidence: float = 0.8
    ) -> Optional[CaptureResult]:
        """
        Process user transcription and advance state machine.
        
        This method is called when user speaks during ELICITING or CONFIRMING states.
        
        Args:
            transcription: User speech transcription
            confidence: ASR confidence score (0.0-1.0)
            
        Returns:
            CaptureResult if objective completed, None if still in progress
        """
        try:
            if self.state_machine.state == ObjectiveState.ELICITING:
                # Extract value from transcription
                extracted_value = await self.extract_value(transcription)
                
                # Transition to CAPTURED state
                self.state_machine.transition(
                    "user_spoke",
                    value=extracted_value,
                    confidence=confidence
                )
                
                # If captured, validate
                if self.state_machine.state == ObjectiveState.CAPTURED:
                    is_valid = await self.validate_value(extracted_value)
                    
                    # Transition based on validation
                    self.state_machine.transition(
                        "validate",
                        is_valid=is_valid,
                        is_critical=self.is_critical,
                        confidence=confidence
                    )
                    
                    # If confirming, ask for confirmation
                    if self.state_machine.state == ObjectiveState.CONFIRMING:
                        await self._confirm()
                    elif self.state_machine.state == ObjectiveState.CONFIRMED:
                        # High confidence, non-critical - auto-confirmed
                        self.state_machine.transition("complete")
                        return self._build_result()
                    elif self.state_machine.state == ObjectiveState.ELICITING:
                        # Validation failed - re-elicit
                        await self._elicit()
                        
            elif self.state_machine.state == ObjectiveState.CONFIRMING:
                # Check if user affirmed or corrected
                is_affirmation = await self.is_affirmation(transcription)
                
                if is_affirmation:
                    # User confirmed
                    self.state_machine.transition("user_affirmed")
                    self.state_machine.transition("complete")
                    return self._build_result()
                else:
                    # User corrected - extract new value
                    corrected_value = await self.extract_correction(transcription)
                    
                    if corrected_value:
                        self.state_machine.transition(
                            "user_corrected",
                            new_value=corrected_value
                        )
                        
                        # Validate correction
                        is_valid = await self.validate_value(corrected_value)
                        self.state_machine.transition("repaired", is_valid=is_valid)
                        
                        # Re-confirm if valid
                        if self.state_machine.state == ObjectiveState.CONFIRMING:
                            await self._confirm()
                    else:
                        # Could not extract correction - re-elicit
                        self.state_machine.transition("user_corrected", new_value=None)
                        await self._elicit()
                        
            return None  # Still in progress
            
        except Exception as e:
            logger.error(f"Error processing transcription: {e}")
            return CaptureResult(
                success=False,
                value=None,
                state=ObjectiveState.FAILED,
                retry_count=self.state_machine.retry_count,
                metadata={"error": str(e)}
            )
    
    def _build_result(self) -> CaptureResult:
        """Build final capture result"""
        # Normalize value for storage
        normalized_value = None
        if self.state_machine.captured_value:
            normalized_value = self.normalize_value(self.state_machine.captured_value)
        
        return CaptureResult(
            success=(self.state_machine.state == ObjectiveState.COMPLETED),
            value=normalized_value,
            state=self.state_machine.state,
            retry_count=self.state_machine.retry_count,
            confidence=self.state_machine.confidence,
            metadata=self.state_machine.metadata
        )
    
    async def _elicit(self) -> None:
        """Elicit information from user"""
        prompt = self.get_elicitation_prompt()
        logger.info(f"[{self.objective_type}] ELICIT: {prompt}")
        # In real implementation, this would send prompt to TTS
        # For now, just log
    
    async def _confirm(self) -> None:
        """Confirm captured value with user"""
        prompt = self.get_confirmation_prompt(self.state_machine.captured_value)
        logger.info(f"[{self.objective_type}] CONFIRM: {prompt}")
        # In real implementation, this would send prompt to TTS
    
    # Abstract methods that subclasses must implement
    
    @abstractmethod
    def get_elicitation_prompt(self) -> str:
        """
        Get prompt to elicit information from user.
        
        Returns:
            Prompt text (e.g., "What's your email address?")
        """
        pass
    
    @abstractmethod
    async def extract_value(self, transcription: str) -> Optional[str]:
        """
        Extract value from user transcription.
        
        Args:
            transcription: User speech transcription
            
        Returns:
            Extracted value or None if extraction failed
        """
        pass
    
    @abstractmethod
    async def validate_value(self, value: str) -> bool:
        """
        Validate extracted value.
        
        Args:
            value: Extracted value to validate
            
        Returns:
            True if valid, False otherwise
        """
        pass
    
    @abstractmethod
    def get_confirmation_prompt(self, value: str) -> str:
        """
        Get confirmation prompt for captured value.
        
        Args:
            value: Captured value to confirm
            
        Returns:
            Confirmation prompt (e.g., "Got it, jane@gmail.com. Is that correct?")
        """
        pass
    
    @abstractmethod
    def normalize_value(self, value: str) -> str:
        """
        Normalize value for storage.
        
        Args:
            value: Captured value to normalize
            
        Returns:
            Normalized value (e.g., "+61412345678" for phone)
        """
        pass
    
    @abstractmethod
    async def is_affirmation(self, transcription: str) -> bool:
        """
        Check if transcription is affirmation (yes/correct/yep/etc).
        
        Args:
            transcription: User transcription
            
        Returns:
            True if affirmation, False otherwise
        """
        pass
    
    @abstractmethod
    async def extract_correction(self, transcription: str) -> Optional[str]:
        """
        Extract correction from user transcription.
        
        Args:
            transcription: User transcription with correction
            
        Returns:
            Corrected value or None if extraction failed
        """
        pass
