"""
Email capture pipeline: STT → EmailCapture → TTS

Designed for the Step 3 demo wiring: integrates CaptureEmailAU into the
frame-processing flow without requiring an LLM.
"""

import os
from typing import Optional

from pipecat.pipeline.pipeline import Pipeline
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.cartesia import CartesiaTTSService

from ..events.event_emitter import EventEmitter
from ..primitives.email_capture_processor import EmailCaptureProcessor
from .frame_observer import PipelineFrameObserver


class EmailCapturePipeline:
    """
    STT → Email Capture → TTS pipeline.

    Frame flow:
    1. AudioRawFrame → STT → TranscriptionFrame
    2. TranscriptionFrame → EmailCaptureProcessor → TextFrame
    3. TextFrame → TTS → TTSAudioRawFrame
    """

    def __init__(
        self,
        event_emitter: Optional[EventEmitter] = None,
        trace_id: str = "demo-trace",
        locale: str = "en-AU",
    ):
        self.event_emitter = event_emitter
        self.trace_id = trace_id
        self.locale = locale

        self.stt = self._create_stt_service()
        self.tts = self._create_tts_service()
        self.email_capture = EmailCaptureProcessor(
            event_emitter=event_emitter,
            trace_id=trace_id,
            locale=locale,
        )
        self.frame_observer_pre = PipelineFrameObserver(event_emitter=event_emitter)
        self.frame_observer_post = PipelineFrameObserver(event_emitter=event_emitter)

    def _create_stt_service(self) -> DeepgramSTTService:
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("DEEPGRAM_API_KEY must be set in environment")

        return DeepgramSTTService(
            api_key=api_key,
            model="nova-3",
            language="en-AU",
            sample_rate=16000,
            channels=1,
        )

    def _create_tts_service(self) -> CartesiaTTSService:
        api_key = os.getenv("CARTESIA_API_KEY")
        if not api_key:
            raise ValueError("CARTESIA_API_KEY must be set in environment")

        # Friendly female Australian receptionist voice
        # Using "79a125e8-cd45-4c13-8a67-188112f4dd22" - British Lady (warm, professional)
        voice_id = os.getenv("CARTESIA_VOICE_ID", "79a125e8-cd45-4c13-8a67-188112f4dd22")
        model = os.getenv("CARTESIA_MODEL", "sonic-3")
        
        return CartesiaTTSService(
            api_key=api_key,
            voice_id=voice_id,
            model=model,
        )

    def build_pipeline(self, transport_input, transport_output) -> Pipeline:
        return Pipeline(
            [
                transport_input,
                self.stt,
                self.frame_observer_pre,
                self.email_capture,
                self.frame_observer_post,
                self.tts,
                transport_output,
            ]
        )

    def get_captured_email(self):
        return self.email_capture.get_captured_email()


def build_email_capture_pipeline(
    transport_input,
    transport_output,
    event_emitter: Optional[EventEmitter] = None,
    trace_id: str = "demo-trace",
    locale: str = "en-AU",
) -> Pipeline:
    pipeline_builder = EmailCapturePipeline(
        event_emitter=event_emitter,
        trace_id=trace_id,
        locale=locale,
    )
    return pipeline_builder.build_pipeline(transport_input, transport_output)
