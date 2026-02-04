"""
Australian Email Capture Primitive (no network calls).

CRITICAL RULES (R-ARCH-006):
- ✅ ALWAYS confirm email regardless of confidence (overconfidence bias)
- ✅ NO network calls inside primitive (consume TranscriptionFrame only)
- ✅ Follow deterministic state machine (ELICITING → CAPTURED → CONFIRMING → CONFIRMED)
- ✅ Emit events for observability (objective_started, captured, confirmed, completed)

Production evidence:
- Single ASR on Australian accent: 60-65% accuracy
- Multi-ASR with LLM ranking: 75-85% accuracy
- 5-15% of high-confidence (0.8-0.9) captures are WRONG
"""

import re
from typing import AsyncGenerator, Optional
from email_validator import validate_email, EmailNotValidError

from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    TextFrame,
)
from pipecat.processors.frame_processor import FrameProcessor

from ..primitives.base import ObjectiveStateMachine, ObjectiveState
import structlog

logger = structlog.get_logger(__name__)


class CaptureEmailAU(FrameProcessor):
    """
    Capture email address with Australian accent handling.
    
    State machine flow:
        PENDING → ELICITING → CAPTURED → CONFIRMING → CONFIRMED → COMPLETED
        
    Critical rules:
        - ALWAYS confirm email (regardless of confidence)
        - NO network calls inside primitive (consume TranscriptionFrame only)
        - Max 3 retries for low confidence
        
    Usage:
        capture = CaptureEmailAU(
            trace_id="uuid-trace-id",
        )
        
        # Inject into pipeline
        pipeline = Pipeline([
            transport.input(),
            capture,
            transport.output(),
        ])
    """
    
    def __init__(
        self,
        trace_id: str,
        locale: str = "en-AU",
    ):
        """
        Initialize email capture primitive.
        
        Args:
            trace_id: Correlation ID for event emission
            locale: Locale code (en-AU for Australian)
        """
        super().__init__()
        self.trace_id = trace_id
        self.locale = locale
        
        # State machine (critical data = always confirm)
        self.state_machine = ObjectiveStateMachine(
            objective_type="capture_email",
            is_critical=True,  # Email is ALWAYS critical
        )
        
        # Captured data
        self.email: Optional[str] = None
        self.confidence: float = 0.0
        
        logger.info(
            "email_capture_initialized",
            trace_id=self.trace_id,
            locale=self.locale,
        )
    
    async def process_frame(
        self,
        frame: Frame,
        direction: str = "down",
    ) -> AsyncGenerator[Frame, None]:
        """
        Process frames through email capture state machine.
        
        Args:
            frame: Input frame (AudioRawFrame, TranscriptionFrame, etc.)
            direction: Frame direction ("down" for input, "up" for output)
            
        Yields:
            Output frames (TextFrame for TTS, events, etc.)
        """
        # Start state machine if not started
        if self.state_machine.state == ObjectiveState.PENDING:
            self.state_machine.transition("start")
            
            # Emit objective_started event
            logger.info(
                "objective_started",
                trace_id=self.trace_id,
                objective_type="capture_email",
                state=self.state_machine.state.value,
            )
            
            # Elicit email from user
            yield TextFrame(text="What's the best email address for you?")
            
        # Process transcription input (user spoke)
        elif isinstance(frame, TranscriptionFrame) and self.state_machine.state == ObjectiveState.ELICITING:
            transcript = frame.text
            confidence = getattr(frame, "confidence", 1.0)

            # Extract email from transcript
            email = self._extract_email(transcript)

            logger.info(
                "email_captured",
                trace_id=self.trace_id,
                email=email,
                confidence=confidence,
            )

            # Transition to CAPTURED
            self.state_machine.transition(
                "user_spoke",
                value=email,
                confidence=confidence,
            )

            if self.state_machine.state == ObjectiveState.CAPTURED:
                self.email = email
                self.confidence = confidence

                # Validate email
                is_valid = self._validate_email(email)

                # Transition to CONFIRMING (ALWAYS confirm email)
                self.state_machine.transition(
                    "validate",
                    is_valid=is_valid,
                    confidence=confidence,
                )

                if self.state_machine.state == ObjectiveState.CONFIRMING:
                    # ALWAYS confirm email (R-ARCH-006)
                    yield TextFrame(
                        text=f"Got it, {self._format_email_for_speech(email)}. Is that right?"
                    )

            elif self.state_machine.state == ObjectiveState.ELICITING:
                # Low confidence - re-elicit
                yield TextFrame(
                    text="Sorry, I didn't catch that. Can you say your email again?"
                )

            elif self.state_machine.state == ObjectiveState.FAILED:
                # Max retries exceeded
                logger.error(
                    "objective_failed",
                    trace_id=self.trace_id,
                    objective_type="capture_email",
                    reason="max_retries_exceeded",
                )
                yield TextFrame(
                    text="I'm having trouble hearing the email. Let me transfer you to a person."
                )
        
        # Process transcription (confirmation response)
        elif isinstance(frame, TranscriptionFrame) and self.state_machine.state == ObjectiveState.CONFIRMING:
            transcript = frame.text.lower()
            
            # Check if user affirmed or corrected
            if self._is_affirmation(transcript):
                # User affirmed
                self.state_machine.transition("user_affirmed")
                
                if self.state_machine.state == ObjectiveState.CONFIRMED:
                    # Complete objective
                    self.state_machine.transition("complete")
                    
                    logger.info(
                        "objective_completed",
                        trace_id=self.trace_id,
                        objective_type="capture_email",
                        email=self.email,
                        confidence=self.confidence,
                    )
                    
                    yield TextFrame(text="Perfect, thank you.")
                    
            elif self._is_negation(transcript):
                # User corrected - re-elicit
                self.state_machine.transition("user_corrected")
                self.state_machine.reset()
                self.state_machine.transition("start")
                
                logger.info(
                    "email_correction_requested",
                    trace_id=self.trace_id,
                )
                
                yield TextFrame(text="No worries, what's the correct email address?")
            
        # Pass through other frames
        else:
            yield frame
    
    def _extract_email(self, transcript: str) -> Optional[str]:
        """
        Extract email address from transcript.
        
        Handles Australian speech patterns:
        - "jane at gmail dot com" → "jane@gmail.com"
        - "john underscore smith at outlook dot com" → "john_smith@outlook.com"
        
        Args:
            transcript: User transcript
            
        Returns:
            Extracted email or None
        """
        # Normalize transcript
        text = transcript.lower().strip()
        
        # Replace speech patterns with symbols
        text = text.replace(" at ", "@")
        text = text.replace(" dot ", ".")
        text = text.replace(" underscore ", "_")
        text = text.replace(" dash ", "-")
        text = text.replace(" hyphen ", "-")
        text = text.replace("underscore", "_")
        
        # Remove spaces (common in speech: "j a n e" → "jane")
        text = text.replace(" ", "")
        
        # Extract email using regex
        email_pattern = r'[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        match = re.search(email_pattern, text)
        
        if match:
            return match.group(0)
        
        return None
    
    def _validate_email(self, email: Optional[str]) -> bool:
        """
        Validate email format.
        
        Args:
            email: Email address
            
        Returns:
            True if valid, False otherwise
        """
        if not email:
            return False
        
        try:
            # Use email-validator library
            validate_email(email, check_deliverability=False)
            return True
        except EmailNotValidError:
            return False
    
    def _format_email_for_speech(self, email: str) -> str:
        """
        Format email for natural speech confirmation.
        
        Examples:
        - "jane@gmail.com" → "jane at gmail dot com"
        - "john_smith@outlook.com" → "john underscore smith at outlook dot com"
        
        Args:
            email: Email address
            
        Returns:
            Formatted email for speech
        """
        # Replace symbols with words
        formatted = email.replace("@", " at ")
        formatted = formatted.replace(".", " dot ")
        formatted = formatted.replace("_", " underscore ")
        formatted = formatted.replace("-", " dash ")
        
        return formatted
    
    def _is_affirmation(self, transcript: str) -> bool:
        """
        Check if transcript is an affirmation.
        
        Australian patterns:
        - "yes", "yeah", "yep", "correct", "that's right", "spot on"
        
        Args:
            transcript: User transcript (lowercased)
            
        Returns:
            True if affirmation, False otherwise
        """
        affirmations = [
            "yes", "yeah", "yep", "yup", "correct", "right", "that's right",
            "spot on", "exactly", "perfect", "true", "affirmative",
        ]
        
        return any(word in transcript for word in affirmations)
    
    def _is_negation(self, transcript: str) -> bool:
        """
        Check if transcript is a negation.
        
        Australian patterns:
        - "no", "nah", "nope", "not right", "that's wrong", "incorrect"
        
        Args:
            transcript: User transcript (lowercased)
            
        Returns:
            True if negation, False otherwise
        """
        negations = [
            "no", "nah", "nope", "not right", "that's wrong", "incorrect",
            "wrong", "negative", "not correct",
        ]
        
        return any(word in transcript for word in negations)
