"""
Pipeline to execute a tenant objective graph.

Flow: STT -> MultiPrimitiveProcessor -> TTS
"""

import os
import logging
from typing import Optional, Dict, Any

from pipecat.pipeline.pipeline import Pipeline
from pipecat.frames.frames import Frame, AudioRawFrame, InputAudioRawFrame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameProcessor
try:
    from pipecat.services.deepgram import DeepgramSTTService
except Exception:  # pragma: no cover - optional dependency
    DeepgramSTTService = None

from ..events.event_emitter import EventEmitter, VoiceCoreEvent
from ..integrations.n8n_client import (
    trigger_workflows_for_tenant,
    workflow_registry,
)
from ..orchestration.objective_graph import ObjectiveGraph
from ..processors.multi_asr_processor import MultiASRProcessor
from ..pipeline.frame_observer import PipelineFrameObserver
from ..prompts import combine_prompts
from ..tts.multi_provider_tts import MultiProviderTTS
from ..tools.knowledge_tool import format_knowledge_bases_for_system_prompt
from ..services.call_history import get_recent_call_history
from ..services.phone_routing import normalize_phone_number
from ..transports.daily_transport import DailyTransportWrapper


class STTWithFallback(FrameProcessor):
    def __init__(self, primary, fallback):
        super().__init__()
        self.primary = primary
        self.fallback = fallback
        self.use_fallback = False
        self.logger = logging.getLogger(__name__)

    async def process_frame(self, frame: Frame, direction):
        if isinstance(frame, (AudioRawFrame, InputAudioRawFrame)):
            print(
                f"STT input audio frame: {len(frame.audio)} bytes (sample_rate={frame.sample_rate})"
            )
        if not self.use_fallback:
            try:
                async for output in self.primary.process_frame(frame, direction):
                    if isinstance(output, TranscriptionFrame):
                        print(f"STT transcription output: {output.text!r}")
                    yield output
                return
            except Exception:
                self.use_fallback = True
        if self.fallback:
            async for output in self.fallback.process_frame(frame, direction):
                if isinstance(output, TranscriptionFrame):
                    print(f"STT fallback transcription: {output.text!r}")
                yield output
            return
        yield frame


def _create_stt_service(event_emitter: Optional[EventEmitter]) -> FrameProcessor:
    if DeepgramSTTService is None:
        raise RuntimeError("Deepgram STT dependency not available.")
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        raise ValueError("DEEPGRAM_API_KEY must be set in environment")

    primary = DeepgramSTTService(
        api_key=api_key,
        model="nova-3",
        language="en-AU",
        sample_rate=16000,
        channels=1,
    )
    fallback = MultiASRProcessor.from_env(event_emitter=event_emitter)
    fallback.enable_multi_asr()
    return STTWithFallback(primary=primary, fallback=fallback)


def _register_n8n_event_listener(
    event_emitter: Optional[EventEmitter], tenant_config: Dict[str, Any]
) -> None:
    workflow_registry.load_from_config(tenant_config)

    if not event_emitter:
        return

    async def _handle(event: VoiceCoreEvent):
        if event.event_type != "objective_chain_completed":
            return

        captured_data = (event.data or {}).get("captured_data", {})
        tenant_id = tenant_config.get("tenant_id")
        if not tenant_id or not captured_data:
            return

        await trigger_workflows_for_tenant(tenant_id, captured_data)

    event_emitter.add_observer(_handle)


def build_objective_graph_pipeline(
    tenant_config: Dict[str, Any],
    transport: DailyTransportWrapper,
    event_emitter: Optional[EventEmitter] = None,
) -> Pipeline:
    """
    Build pipeline that executes the tenant's objective graph.

    Args:
        tenant_config: Tenant configuration with objective graph
        transport: Transport wrapper (Daily)
        event_emitter: Optional event emitter

    Returns:
        Configured Pipeline instance
    """
    _register_n8n_event_listener(event_emitter, tenant_config)

    combined_prompt = combine_prompts(
        static_knowledge=tenant_config.get("static_knowledge"),
        layer2_system_prompt=tenant_config.get("system_prompt"),
    )

    # Inject recent call history for this caller (if any)
    caller_phone = tenant_config.get("caller_phone")
    tenant_id = tenant_config.get("tenant_id")
    if tenant_id and caller_phone:
        normalized_phone = normalize_phone_number(caller_phone)
        history = tenant_config.get("caller_history")
        if history is None:
            history = get_recent_call_history(tenant_id, normalized_phone, limit=3)
        if history:
            history_lines = []
            for item in history:
                summary = item.get("summary") or ""
                outcome = item.get("outcome")
                if outcome:
                    history_lines.append(f"- {summary} (Outcome: {outcome})")
                else:
                    history_lines.append(f"- {summary}")
            combined_prompt = "\n\n".join(
                [
                    combined_prompt,
                    "---",
                    "CALL HISTORY (Same Caller)",
                    "---",
                    f"Caller: {normalized_phone}",
                    "Recent summaries:",
                    "\n".join(history_lines),
                    "Use this context to personalize the conversation. Do not mention internal notes unless the caller asks.",
                ]
            )

    # Append available KB titles so the agent knows what it can query
    if tenant_id:
        kb_list = format_knowledge_bases_for_system_prompt(tenant_id)
        combined_prompt = "\n\n".join(
            [
                combined_prompt,
                "---",
                "AVAILABLE KNOWLEDGE BASES",
                "---",
                kb_list,
            ]
        )

    graph = ObjectiveGraph(
        graph_config=tenant_config["objective_graph"],
        tenant_context=tenant_config,
        event_emitter=event_emitter,
        system_prompt=combined_prompt,
    )

    processor = graph.build_processor_for_node(graph.entry_node_id)
    if processor is None:
        raise ValueError("Objective graph entry node must be a sequence node")

    multi_asr = MultiASRProcessor.from_env(event_emitter=event_emitter)
    stt = _create_stt_service(event_emitter)
    tts = MultiProviderTTS.from_env()
    frame_observer = PipelineFrameObserver(event_emitter=event_emitter)

    if hasattr(processor, "multi_asr_processor"):
        processor.multi_asr_processor = multi_asr

    pipeline = Pipeline(
        [
            transport.input(),
            multi_asr,
            stt,
            frame_observer,
            processor,
            frame_observer,
            tts,
            transport.output(),
        ]
    )

    pipeline.cost_trackers = {
        "tts": tts,
    }

    return pipeline
