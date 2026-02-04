"""
Email Capture FrameProcessor for Pipeline Integration

Wraps CaptureEmailAU primitive as a Pipecat FrameProcessor
to integrate into the audio pipeline.
"""

import asyncio
from typing import Optional
import logging
import re

from pipecat.frames.frames import (
    Frame,
    AudioRawFrame,
    TranscriptionFrame,
    TextFrame,
    TTSAudioRawFrame,
)
from pipecat.processors.frame_processor import FrameProcessor

from .capture_email_au import CaptureEmailAU
from ..events.event_emitter import EventEmitter
from ..state_machines.objective_state import ObjectiveState

logger = logging.getLogger(__name__)


class EmailCaptureProcessor(FrameProcessor):
    """
    FrameProcessor wrapper for email capture primitive.
    
    Integrates CaptureEmailAU into the audio pipeline:
    - Processes TranscriptionFrame from STT
    - Emits TextFrame for TTS (elicitation, confirmation)
    - Emits events for observability
    - Completes when email is captured and confirmed
    """
    
    def __init__(
        self,
        event_emitter: Optional[EventEmitter] = None,
        trace_id: str = "demo-trace",
        locale: str = "en-AU"
    ):
        """
        Initialize email capture processor.
        
        Args:
            event_emitter: Event emitter for observability
            trace_id: Correlation ID for events
            locale: Locale for validation (default: "en-AU")
        """
        super().__init__()
        self.event_emitter = event_emitter
        self.trace_id = trace_id
        self.locale = locale
        
        # Create email capture primitive
        self.capture_primitive = CaptureEmailAU(locale=locale)
        
        # Track completion and state
        self.is_completed = False
        self.captured_email: Optional[str] = None
        self.has_elicited = False
        
        # Emit objective started event
        if self.event_emitter:
            asyncio.create_task(self.event_emitter.emit(
                "objective_started",
                data={
                    "objective_type": "capture_email_au",
                    "trace_id": trace_id,
                    "locale": locale
                },
                metadata={"component": "email_capture_processor"}
            ))
    
    async def process_frame(
        self,
        frame: Frame,
        direction: str = "down",
    ):
        """
        Process frames through email capture state machine.
        
        Args:
            frame: Input frame (AudioRawFrame, TranscriptionFrame, etc.)
            direction: Frame direction ("down" for input, "up" for output)
        """
        # Start state machine and elicit on first frame
        if not self.has_elicited and self.capture_primitive.state_machine.state == ObjectiveState.PENDING:
            self.capture_primitive.state_machine.transition("start")
            self.has_elicited = True
            
            # Emit elicitation prompt
            prompt = self.capture_primitive.get_elicitation_prompt()
            await self.push_frame(TextFrame(text=prompt), direction)
            
            logger.info(f"[EmailCapture] ELICIT: {prompt}")
            return
        
        # Process transcription (user spoke)
        if isinstance(frame, TranscriptionFrame) and not self.is_completed:
            transcript = frame.text.strip()
            # Try to get confidence from frame attributes
            confidence = getattr(frame, 'confidence', None)
            if confidence is None:
                # Try alternative attribute names
                confidence = getattr(frame, 'user', {}).get('confidence', 0.8) if hasattr(frame, 'user') else 0.8
            
            logger.info(f"[EmailCapture] User said: '{transcript}' (confidence: {confidence})")
            
            # Process transcription through primitive
            result = await self.capture_primitive.process_transcription(
                transcript,
                confidence=confidence
            )
            
            # Check state machine state
            state = self.capture_primitive.state_machine.state
            
            if state == ObjectiveState.CONFIRMING:
                # Emit confirmation prompt
                captured_value = self.capture_primitive.state_machine.captured_value
                prompt = self.capture_primitive.get_confirmation_prompt(captured_value)
                await self.push_frame(TextFrame(text=prompt), direction)
                
                logger.info(f"[EmailCapture] CONFIRM: {prompt}")
                
                # Emit captured event
                if self.event_emitter:
                    asyncio.create_task(self.event_emitter.emit(
                        "objective_captured",
                        data={
                            "objective_type": "capture_email_au",
                            "trace_id": self.trace_id,
                            "value": captured_value,
                            "confidence": confidence,
                            "state": state.value
                        },
                        metadata={"component": "email_capture_processor"}
                    ))
            
            elif state == ObjectiveState.ELICITING:
                # Re-elicit (validation failed or retry)
                prompt = self.capture_primitive.get_elicitation_prompt()
                await self.push_frame(TextFrame(text=prompt), direction)
                
                logger.info(f"[EmailCapture] RE-ELICIT: {prompt}")
            
            elif state == ObjectiveState.COMPLETED:
                # Objective completed!
                self.is_completed = True
                self.captured_email = self.capture_primitive.state_machine.captured_value
                
                # Normalize email
                normalized_email = self.capture_primitive.normalize_value(self.captured_email)
                
                logger.info(f"[EmailCapture] ✅ COMPLETED: {normalized_email}")
                
                # Emit completion event
                if self.event_emitter:
                    asyncio.create_task(self.event_emitter.emit(
                        "objective_completed",
                        data={
                            "objective_type": "capture_email_au",
                            "trace_id": self.trace_id,
                            "value": normalized_email,
                            "confidence": self.capture_primitive.state_machine.confidence,
                            "retry_count": self.capture_primitive.state_machine.retry_count
                        },
                        metadata={"component": "email_capture_processor"}
                    ))
                
                # Emit completion message
                await self.push_frame(TextFrame(text="Perfect, thank you!"), direction)
            
            elif state == ObjectiveState.FAILED:
                # Objective failed (max retries exceeded)
                logger.warning(f"[EmailCapture] ❌ FAILED after {self.capture_primitive.state_machine.retry_count} retries")
                self.is_completed = True  # Mark as completed to stop processing
                
                if self.event_emitter:
                    asyncio.create_task(self.event_emitter.emit(
                        "objective_failed",
                        data={
                            "objective_type": "capture_email_au",
                            "trace_id": self.trace_id,
                            "retry_count": self.capture_primitive.state_machine.retry_count
                        },
                        metadata={"component": "email_capture_processor"}
                    ))
                
                await self.push_frame(TextFrame(text="I'm sorry, I wasn't able to capture your email. Let's end the call."), direction)
        
        # Pass through other frames (audio, etc.)
        else:
            await self.push_frame(frame, direction)
    
    def get_captured_email(self) -> Optional[str]:
        """Get captured email if completed"""
        if self.is_completed and self.captured_email:
            return self.capture_primitive.normalize_value(self.captured_email)
        return None
