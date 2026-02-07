"""
Frame observer processor for event emission

Processes frames and emits events without affecting conversation behavior.
Acts as a pass-through frame processor that emits events.
"""

import asyncio
from typing import Optional, AsyncIterator
import logging
from pipecat.frames.frames import Frame, TranscriptionFrame, TextFrame, AudioRawFrame, TTSAudioRawFrame
from pipecat.processors.frame_processor import FrameProcessor

from ..events.event_emitter import EventEmitter


class PipelineFrameObserver(FrameProcessor):
    """
    Frame processor that emits events when frames are processed.
    
    Architecture compliance:
    - Non-intrusive (passes frames through unchanged)
    - Emits events for observability (R-ARCH-009)
    - Failures do not crash conversation
    """
    
    def __init__(self, event_emitter: Optional[EventEmitter] = None):
        """
        Initialize frame observer processor.
        
        Args:
            event_emitter: Event emitter for frame events
        """
        super().__init__()
        self.event_emitter = event_emitter
        self.logger = logging.getLogger(__name__)
    
    async def process_frame(self, frame: Frame, direction):
        """
        Process frame and emit events, then pass frame through unchanged.
        
        Args:
            frame: Frame to process
            direction: Frame direction (Pipecat 0.0.46 requires this parameter)
        """
        # Emit events (non-blocking, fire-and-forget)
        if self.event_emitter:
            if isinstance(frame, TranscriptionFrame):
                self._emit_nonblocking(
                    "user_spoke",
                    data={
                        "text": frame.text,
                        "user_id": getattr(frame, "user_id", None),
                        "timestamp": getattr(frame, "timestamp", None),
                    }
                )
                self.logger.info("STT transcription: %r", frame.text)
            elif isinstance(frame, TextFrame):
                self._emit_nonblocking(
                    "agent_spoke",
                    data={
                        "text": frame.text,
                    }
                )
                self.logger.info("LLM response text: %r", frame.text)
            elif isinstance(frame, AudioRawFrame):
                self._emit_nonblocking(
                    "audio_frame_received",
                    data={
                        "bytes": len(frame.audio),
                        "sample_rate": frame.sample_rate,
                        "num_channels": frame.num_channels,
                    }
                )
                self.logger.info(
                    "Audio frame received: bytes=%s sample_rate=%s channels=%s",
                    len(frame.audio),
                    frame.sample_rate,
                    frame.num_channels,
                )
            elif isinstance(frame, TTSAudioRawFrame):
                self._emit_nonblocking(
                    "tts_audio_generated",
                    data={
                        "bytes": len(frame.audio),
                        "sample_rate": frame.sample_rate,
                        "num_channels": frame.num_channels,
                    }
                )
                self.logger.info(
                    "TTS audio generated: bytes=%s sample_rate=%s channels=%s",
                    len(frame.audio),
                    frame.sample_rate,
                    frame.num_channels,
                )
        
        # Pass frame through unchanged (non-intrusive)
        await self.push_frame(frame, direction)

    def _emit_nonblocking(self, event_name: str, data: dict):
        """Emit event without blocking the audio pipeline."""
        task = asyncio.create_task(self.event_emitter.emit(event_name, data=data))
        task.add_done_callback(self._handle_emit_result)

    @staticmethod
    def _handle_emit_result(task: asyncio.Task):
        try:
            task.result()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Frame observer error: {e}")
