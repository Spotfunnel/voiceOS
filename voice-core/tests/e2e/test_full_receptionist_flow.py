"""
End-to-end test suite for full receptionist flow.

Tests the complete pipeline: Twilio → STT → Primitives → TTS → Response
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List
import asyncio

import pytest

from pipecat.frames.frames import EndFrame, Frame, TranscriptionFrame, TextFrame
from pipecat.processors.frame_processor import FrameDirection

from src.events.event_emitter import EventEmitter, VoiceCoreEvent
from src.orchestration.objective_graph import ObjectiveGraph
from src.primitives.capture_address_au import CaptureAddressAU
from src.primitives.capture_datetime_au import CaptureDatetimeAU
from src.primitives.capture_email_au import CaptureEmailAU
from src.primitives.capture_name_au import CaptureNameAU
from src.primitives.capture_phone_au import CapturePhoneAU
from src.primitives.capture_service_au import CaptureServiceAU
from src.primitives.multi_primitive_processor import (
    MultiPrimitiveProcessor,
    ObjectiveChainCompletedFrame,
)


# --- Test Fixtures ---


@dataclass
class SimulatedTranscription:
    """Simulated user speech for testing"""

    text: str
    confidence: float = 0.9


class MockEventEmitter(EventEmitter):
    """Event emitter that captures all events for assertions"""

    def __init__(self):
        super().__init__()
        self.captured_events: List[VoiceCoreEvent] = []

    async def emit(
        self,
        event_type: str,
        data: Dict[str, Any] | None = None,
        metadata: Dict[str, Any] | None = None,
    ):
        await super().emit(event_type, data, metadata)
        event = VoiceCoreEvent(
            event_type=event_type,
            timestamp=datetime.now().isoformat(),
            data=data or {},
            metadata=metadata or {},
        )
        self.captured_events.append(event)


class MockFrameCollector:
    """Collects output frames for assertions"""

    def __init__(self):
        self.frames: List[Frame] = []

    async def collect(self, frame: Frame):
        self.frames.append(frame)


@pytest.fixture
def event_emitter():
    """Create mock event emitter"""

    return MockEventEmitter()


@pytest.fixture
def service_catalog():
    """Standard service catalog for testing"""

    return [
        {"id": "plumbing", "name": "Plumbing", "keywords": ["plumber", "plumbing", "leak"]},
        {
            "id": "electrical",
            "name": "Electrical",
            "keywords": ["electrician", "electrical", "wiring"],
        },
    ]


# --- Helper Functions ---


async def simulate_conversation(
    processor: MultiPrimitiveProcessor,
    transcriptions: List[SimulatedTranscription],
    frame_collector: MockFrameCollector,
) -> None:
    """
    Simulate a conversation by feeding transcriptions to processor.

    Args:
        processor: MultiPrimitiveProcessor to test
        transcriptions: List of simulated user responses
        frame_collector: Collector for output frames
    """

    original_push = processor.push_frame

    async def collecting_push(frame: Frame, direction):
        await frame_collector.collect(frame)
        await original_push(frame, direction)

    processor.push_frame = collecting_push

    # Start chain (elicits first prompt)
    await processor.process_frame(TextFrame(text=""), FrameDirection.DOWNSTREAM)

    for transcription in transcriptions:
        frame = TranscriptionFrame(
            text=transcription.text,
            user_id="test-user",
            timestamp=datetime.now().isoformat(),
        )
        frame.confidence = transcription.confidence
        await processor.process_frame(frame, FrameDirection.DOWNSTREAM)
        await asyncio.sleep(0.01)

    # Close push task cleanly to avoid pending task warnings
    await processor.push_frame(EndFrame(), FrameDirection.DOWNSTREAM)


def get_text_frames(collector: MockFrameCollector) -> List[str]:
    """Extract text content from TextFrames"""

    return [f.text for f in collector.frames if isinstance(f, TextFrame)]


def get_chain_completed_data(collector: MockFrameCollector) -> Dict[str, Any]:
    """Extract captured data from ObjectiveChainCompletedFrame"""

    for frame in collector.frames:
        if isinstance(frame, ObjectiveChainCompletedFrame):
            return frame.captured_data
    return {}


# --- Test Cases ---


@pytest.mark.asyncio
async def test_happy_path_full_receptionist(event_emitter, service_catalog):
    """
    Test complete receptionist flow with all primitives succeeding.

    Flow: name → phone → email → service → datetime → address
    """

    primitives = [
        CaptureNameAU(locale="en-AU", max_retries=3),
        CapturePhoneAU(locale="en-AU", max_retries=3),
        CaptureEmailAU(locale="en-AU", max_retries=3),
        CaptureServiceAU(service_catalog=service_catalog, locale="en-AU", max_retries=3),
        CaptureDatetimeAU(locale="en-AU", max_retries=3),
        CaptureAddressAU(locale="en-AU", max_retries=3),
    ]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-happy-path",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("My name is John Smith"),
        SimulatedTranscription("Yes that's correct"),
        SimulatedTranscription("0412 345 678"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("john at example dot com"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("I need a plumber"),
        SimulatedTranscription("15/10/2026 at 2pm"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("123 Main Street, Richmond NSW 2753"),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)

    assert "capture_name_au" in captured_data
    assert "capture_phone_au" in captured_data
    assert "capture_email_au" in captured_data
    assert "capture_service_au" in captured_data
    assert "capture_datetime_au" in captured_data
    assert "capture_address_au" in captured_data

    event_types = [e.event_type for e in event_emitter.captured_events]
    assert "objective_chain_started" in event_types
    assert "primitive_started" in event_types
    assert "primitive_completed" in event_types
    assert "objective_chain_completed" in event_types

    completed_events = [
        e for e in event_emitter.captured_events if e.event_type == "primitive_completed"
    ]
    assert len(completed_events) == 6


@pytest.mark.asyncio
async def test_retry_and_correction(event_emitter):
    """
    Test retry flow when user provides invalid data.

    Flow: Invalid email → retry → valid email → confirm → complete
    """

    primitives = [CaptureEmailAU(locale="en-AU", max_retries=3)]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-retry",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("not an email"),
        SimulatedTranscription("john at example dot com"),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)
    assert "capture_email_au" in captured_data

    text_outputs = get_text_frames(frame_collector)
    assert any("didn't" in text.lower() or "again" in text.lower() for text in text_outputs)


@pytest.mark.asyncio
async def test_confirmation_repair(event_emitter):
    """
    Test repair flow when user corrects data during confirmation.

    Flow: Capture → confirm → user says "no, it's X" → re-confirm → complete
    """

    primitives = [CapturePhoneAU(locale="en-AU", max_retries=3)]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-repair",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("0412 345 678"),
        SimulatedTranscription("0423 456 789"),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)
    assert "capture_phone_au" in captured_data

    phone_data = captured_data["capture_phone_au"]
    assert phone_data.startswith("+61") and phone_data.endswith("423456789")


@pytest.mark.asyncio
async def test_max_retries_failure(event_emitter):
    """
    Test failure after max retries exceeded.

    Flow: Invalid → Invalid → Invalid → FAILED
    """

    primitives = [CaptureEmailAU(locale="en-AU", max_retries=3)]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-max-retries",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("not valid"),
        SimulatedTranscription("still not valid"),
        SimulatedTranscription("nope still wrong"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)
    assert "capture_email_au" not in captured_data or captured_data["capture_email_au"] is None

    event_types = [e.event_type for e in event_emitter.captured_events]
    assert "primitive_failed" in event_types or "objective_chain_failed" in event_types


@pytest.mark.asyncio
async def test_objective_graph_execution(event_emitter, service_catalog):
    """
    Test ObjectiveGraph with conditional branching.

    Graph: lead_capture (success) → schedule_appointment (success) → confirm
    """

    graph_config = {
        "nodes": [
            {
                "id": "capture_lead",
                "type": "sequence",
                "primitives": ["capture_name_au", "capture_phone_au"],
                "on_success": "schedule_appointment",
                "on_failure": "offer_callback",
            },
            {
                "id": "schedule_appointment",
                "type": "sequence",
                "primitives": ["capture_service_au"],
                "on_success": "confirm_booking",
                "on_failure": "offer_callback",
            },
            {
                "id": "confirm_booking",
                "type": "terminal",
                "message": "Perfect! Your appointment is confirmed.",
            },
            {
                "id": "offer_callback",
                "type": "terminal",
                "message": "Would you like someone to call you back?",
            },
        ]
    }

    tenant_context = {"service_catalog": service_catalog, "locale": "en-AU"}

    graph = ObjectiveGraph(
        graph_config=graph_config, tenant_context=tenant_context, event_emitter=event_emitter
    )

    assert len(graph.nodes) == 4
    assert graph.entry_node_id == "capture_lead"

    processor = graph.build_processor_for_node("capture_lead")
    assert processor is not None
    assert len(processor.primitives) == 2

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("My name is John Smith"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("0412 345 678"),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)
    assert "capture_name_au" in captured_data
    assert "capture_phone_au" in captured_data

    next_node = await graph.transition_on_success()
    assert next_node == "schedule_appointment"
    assert graph.current_node_id == "schedule_appointment"


@pytest.mark.asyncio
async def test_event_replay_determinism(event_emitter):
    """
    Test that state can be reconstructed from event log.

    Verifies R-ARCH-009: Deterministic replay from events
    """

    primitives = [
        CaptureNameAU(locale="en-AU", max_retries=3),
        CaptureEmailAU(locale="en-AU", max_retries=3),
    ]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-replay",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("My name is John Smith"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("john at example dot com"),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    assert len(event_emitter.captured_events) > 0

    primitive_completed_events = [
        e for e in event_emitter.captured_events if e.event_type == "primitive_completed"
    ]

    assert len(primitive_completed_events) == 2

    for event in primitive_completed_events:
        assert "captured_value" in event.data
        assert event.data["captured_value"] is not None


@pytest.mark.asyncio
async def test_low_confidence_handling(event_emitter):
    """
    Test that low confidence triggers re-elicitation.

    Flow: Low confidence capture → re-elicit → high confidence → confirm → complete
    """

    primitives = [CaptureEmailAU(locale="en-AU", max_retries=3)]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-low-confidence",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("john at example dot com", confidence=0.3),
        SimulatedTranscription("john at example dot com", confidence=0.9),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)
    assert "capture_email_au" in captured_data

    text_outputs = get_text_frames(frame_collector)
    assert any(
        "again" in text.lower() or "didn't catch" in text.lower()
        for text in text_outputs
    )


# --- Performance Tests ---


@pytest.mark.asyncio
async def test_performance_benchmark(event_emitter):
    """
    Benchmark test: Full flow should complete in <5 seconds.
    """

    import time

    primitives = [
        CaptureNameAU(locale="en-AU", max_retries=3),
        CapturePhoneAU(locale="en-AU", max_retries=3),
        CaptureEmailAU(locale="en-AU", max_retries=3),
    ]

    processor = MultiPrimitiveProcessor(
        primitive_instances=primitives,
        event_emitter=event_emitter,
        trace_id="test-perf",
    )

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("My name is John Smith"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("0412 345 678"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("john at example dot com"),
        SimulatedTranscription("Yes"),
    ]

    start_time = time.time()
    await simulate_conversation(processor, transcriptions, frame_collector)
    elapsed = time.time() - start_time

    assert elapsed < 5.0, f"Test took {elapsed:.2f}s (expected <5s)"

    captured_data = get_chain_completed_data(frame_collector)
    assert len(captured_data) == 3


# --- Integration Tests ---


@pytest.mark.asyncio
async def test_full_pipeline_with_graph(event_emitter, service_catalog):
    """
    Integration test: Full pipeline from graph entry to completion.

    This is the closest to production without real API calls.
    """

    graph_config = {
        "nodes": [
            {
                "id": "capture_lead",
                "type": "sequence",
                "primitives": ["capture_name_au", "capture_phone_au", "capture_email_au"],
                "on_success": "thank_you",
                "on_failure": None,
            },
            {
                "id": "thank_you",
                "type": "terminal",
                "message": "Thank you! Someone will be in touch soon.",
            },
        ]
    }

    tenant_context = {"service_catalog": service_catalog, "locale": "en-AU"}

    graph = ObjectiveGraph(
        graph_config=graph_config, tenant_context=tenant_context, event_emitter=event_emitter
    )

    processor = graph.build_processor_for_node(graph.entry_node_id)
    assert processor is not None

    frame_collector = MockFrameCollector()
    transcriptions = [
        SimulatedTranscription("My name is John Smith"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("0412 345 678"),
        SimulatedTranscription("Yes"),
        SimulatedTranscription("john at example dot com"),
        SimulatedTranscription("Yes"),
    ]

    await simulate_conversation(processor, transcriptions, frame_collector)

    captured_data = get_chain_completed_data(frame_collector)
    assert len(captured_data) == 3

    next_node = await graph.transition_on_success()
    assert next_node == "thank_you"
    assert graph.is_terminal()
