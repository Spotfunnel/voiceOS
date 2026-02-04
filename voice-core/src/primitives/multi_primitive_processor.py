"""
Multi-primitive frame processor.

Executes capture primitives sequentially in a single pipeline.
Manages state transitions, frame routing, and event emission.
"""

from dataclasses import dataclass
import logging
from typing import List, Optional, Dict, Any, TYPE_CHECKING

from pipecat.frames.frames import Frame, TranscriptionFrame, TextFrame, EndFrame
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection

from .base import BaseCaptureObjective
from ..events.event_emitter import EventEmitter
from ..state_machines.objective_state import ObjectiveState

if TYPE_CHECKING:
    from ..processors.multi_asr_processor import MultiASRProcessor

logger = logging.getLogger(__name__)


@dataclass
class ObjectiveChainCompletedFrame(Frame):
    """Frame emitted when the entire primitive chain completes."""

    captured_data: Dict[str, Any]


class MultiPrimitiveProcessor(FrameProcessor):
    """
    Execute multiple primitives sequentially.

    Flow:
    1. Elicit for primitive 0
    2. Route TranscriptionFrames to active primitive
    3. On primitive completion, advance to next
    4. Emit ObjectiveChainCompletedFrame when all complete
    """

    def __init__(
        self,
        primitive_instances: List[BaseCaptureObjective],
        multi_asr_processor: Optional["MultiASRProcessor"] = None,
        event_emitter: Optional[EventEmitter] = None,
        trace_id: str = "chain-trace",
    ):
        super().__init__()
        self.primitives = primitive_instances
        self.current_index = 0
        self.multi_asr_processor = multi_asr_processor
        self.event_emitter = event_emitter
        self.trace_id = trace_id
        self.captured_data: Dict[str, Any] = {}
        self.chain_started = False

        logger.info(
            "MultiPrimitiveProcessor initialized with %s primitives",
            len(self.primitives),
        )

    @property
    def current_primitive(self) -> Optional[BaseCaptureObjective]:
        if self.current_index < len(self.primitives):
            return self.primitives[self.current_index]
        return None

    @property
    def is_chain_complete(self) -> bool:
        return self.current_index >= len(self.primitives)

    async def process_frame(self, frame: Frame, direction):
        """
        Process frame through the primitive chain.

        Routing:
        - TranscriptionFrame -> active primitive
        - Non-transcription frames pass through unchanged
        """
        if not self.chain_started:
            await self._start_chain()

        if self.is_chain_complete:
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, EndFrame):
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, TranscriptionFrame):
            await self._process_transcription(frame, direction)
            return

        await self.push_frame(frame, direction)

    async def _start_chain(self) -> None:
        self.chain_started = True

        if self.event_emitter:
            await self.event_emitter.emit(
                "objective_chain_started",
                data={
                    "trace_id": self.trace_id,
                    "primitive_count": len(self.primitives),
                    "primitives": [p.objective_type for p in self.primitives],
                },
            )

        await self._start_primitive(self.current_primitive)

    async def _start_primitive(self, primitive: Optional[BaseCaptureObjective]) -> None:
        if primitive is None:
            self._update_multi_asr_state(None)
            return

        logger.info("Starting primitive: %s", primitive.objective_type)
        self._update_multi_asr_state(primitive)
        primitive.state_machine.transition("start")

        if self.event_emitter:
            await self.event_emitter.emit(
                "primitive_started",
                data={
                    "trace_id": self.trace_id,
                    "primitive_type": primitive.objective_type,
                    "primitive_index": self.current_index,
                },
            )

        prompt = primitive.get_elicitation_prompt()
        await self.push_frame(TextFrame(text=prompt), FrameDirection.DOWNSTREAM)

    def _update_multi_asr_state(self, primitive: Optional[BaseCaptureObjective]) -> None:
        if not self.multi_asr_processor:
            return
        if primitive and primitive.requires_multi_asr:
            self.multi_asr_processor.enable_multi_asr()
        else:
            self.multi_asr_processor.disable_multi_asr()

    async def _process_transcription(
        self, frame: TranscriptionFrame, direction
    ) -> None:
        primitive = self.current_primitive
        if primitive is None:
            await self.push_frame(frame, direction)
            return

        transcript = frame.text.strip()
        confidence = getattr(frame, "confidence", 0.8)

        await primitive.process_transcription(transcript, confidence=confidence)
        state = primitive.state_machine.state

        if state == ObjectiveState.CONFIRMING:
            captured_value = primitive.state_machine.captured_value
            prompt = primitive.get_confirmation_prompt(captured_value)
            await self.push_frame(TextFrame(text=prompt), direction)

        elif state == ObjectiveState.ELICITING:
            prompt = primitive.get_elicitation_prompt()
            await self.push_frame(TextFrame(text=prompt), direction)

        elif state == ObjectiveState.COMPLETED:
            await self._complete_primitive(primitive)

        elif state == ObjectiveState.FAILED:
            await self._fail_primitive(primitive)

    async def _complete_primitive(self, primitive: BaseCaptureObjective) -> None:
        captured_value = primitive.state_machine.captured_value
        normalized = primitive.normalize_value(captured_value)
        self.captured_data[primitive.objective_type] = normalized

        logger.info(
            "Primitive completed: %s = %s", primitive.objective_type, normalized
        )

        if self.event_emitter:
            await self.event_emitter.emit(
                "primitive_completed",
                data={
                    "trace_id": self.trace_id,
                    "primitive_type": primitive.objective_type,
                    "primitive_index": self.current_index,
                    "captured_value": normalized,
                },
            )

        self.current_index += 1

        if self.is_chain_complete:
            await self._complete_chain()
        else:
            await self._start_primitive(self.current_primitive)

    async def _fail_primitive(self, primitive: BaseCaptureObjective) -> None:
        logger.warning(
            "Primitive failed: %s (retries=%s)",
            primitive.objective_type,
            primitive.state_machine.retry_count,
        )

        if self.event_emitter:
            await self.event_emitter.emit(
                "primitive_failed",
                data={
                    "trace_id": self.trace_id,
                    "primitive_type": primitive.objective_type,
                    "primitive_index": self.current_index,
                    "retry_count": primitive.state_machine.retry_count,
                },
            )

        await self._fail_chain()

    async def _complete_chain(self) -> None:
        logger.info("Objective chain completed: %s", self.captured_data)
        self._update_multi_asr_state(None)

        if self.event_emitter:
            await self.event_emitter.emit(
                "objective_chain_completed",
                data={"trace_id": self.trace_id, "captured_data": self.captured_data},
            )

        await self.push_frame(
            ObjectiveChainCompletedFrame(captured_data=self.captured_data),
            FrameDirection.DOWNSTREAM,
        )
        await self.push_frame(
            TextFrame(text="Thank you! I've got all the information I need."),
            FrameDirection.DOWNSTREAM,
        )

    async def _fail_chain(self) -> None:
        logger.error("Objective chain failed")
        self._update_multi_asr_state(None)

        if self.event_emitter:
            await self.event_emitter.emit(
                "objective_chain_failed",
                data={"trace_id": self.trace_id, "captured_data": self.captured_data},
            )

        await self.push_frame(
            TextFrame(
                text=(
                    "I'm having trouble capturing that information. "
                    "Would you like me to connect you with someone who can help?"
                )
            ),
            FrameDirection.DOWNSTREAM,
        )
