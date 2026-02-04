"""
Pipeline to execute a tenant objective graph.

Flow: STT -> MultiPrimitiveProcessor -> TTS
"""

import os
from typing import Optional, Dict, Any

from pipecat.pipeline.pipeline import Pipeline
from pipecat.services.deepgram import DeepgramSTTService

from ..events.event_emitter import EventEmitter
from ..orchestration.objective_graph import ObjectiveGraph
from ..processors.multi_asr_processor import MultiASRProcessor
from ..pipeline.frame_observer import PipelineFrameObserver
from ..tts.multi_provider_tts import MultiProviderTTS
from ..transports.daily_transport import DailyTransportWrapper


def _create_stt_service() -> DeepgramSTTService:
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
    graph = ObjectiveGraph(
        graph_config=tenant_config["objective_graph"],
        tenant_context=tenant_config,
        event_emitter=event_emitter,
    )

    processor = graph.build_processor_for_node(graph.entry_node_id)
    if processor is None:
        raise ValueError("Objective graph entry node must be a sequence node")

    multi_asr = MultiASRProcessor.from_env(event_emitter=event_emitter)
    stt = _create_stt_service()
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

    return pipeline
