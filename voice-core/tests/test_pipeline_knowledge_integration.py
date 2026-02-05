"""
Pipeline integration tests for knowledge prompt combination.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Ensure tests load modules from voice-core directory
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

import types

pipecat_pipeline = types.ModuleType("pipecat.pipeline.pipeline")

class DummyPipeline:
    def __init__(self, *args, **kwargs):
        pass

pipecat_pipeline.Pipeline = DummyPipeline
sys.modules["pipecat.pipeline.pipeline"] = pipecat_pipeline

pipecat_pkg = types.ModuleType("pipecat")
pipecat_pkg.__path__ = []
pipecat_services = types.ModuleType("pipecat.services")
pipecat_services.__path__ = []
pipecat_deepgram = types.ModuleType("pipecat.services.deepgram")
pipecat_elevenlabs = types.ModuleType("pipecat.services.elevenlabs")
pipecat_elevenlabs.ElevenLabsTTSService = MagicMock()
pipecat_services.elevenlabs = pipecat_elevenlabs
sys.modules["pipecat.services.elevenlabs"] = pipecat_elevenlabs
pipecat_deepgram.DeepgramSTTService = MagicMock()
pipecat_services.deepgram = pipecat_deepgram
pipecat_pkg.services = pipecat_services
sys.modules["pipecat"] = pipecat_pkg
sys.modules["pipecat.services"] = pipecat_services
sys.modules["pipecat.services.deepgram"] = pipecat_deepgram
pipecat_google = types.ModuleType("pipecat.services.google")
pipecat_google.GoogleLLMService = MagicMock()
pipecat_services.google = pipecat_google
sys.modules["pipecat.services.google"] = pipecat_google
pipecat_openai = types.ModuleType("pipecat.services.openai")
pipecat_openai.OpenAILLMService = MagicMock()
pipecat_services.openai = pipecat_openai
sys.modules["pipecat.services.openai"] = pipecat_openai
pipecat_cartesia = types.ModuleType("pipecat.services.cartesia")
pipecat_cartesia.CartesiaTTSService = MagicMock()
pipecat_services.cartesia = pipecat_cartesia
sys.modules["pipecat.services.cartesia"] = pipecat_cartesia
pipecat_audio = types.ModuleType("pipecat.audio")
pipecat_audio.__path__ = []
pipecat_audio_vad = types.ModuleType("pipecat.audio.vad")
pipecat_audio_vad.__path__ = []
pipecat_audio_vad_vad_analyzer = types.ModuleType("pipecat.audio.vad.vad_analyzer")

class VADParams:
    def __init__(self, *args, **kwargs):
        pass

pipecat_audio_vad_vad_analyzer.VADParams = VADParams

pipecat_audio_vad_silero = types.ModuleType("pipecat.audio.vad.silero")

class SileroVADAnalyzer:
    def __init__(self, *args, **kwargs):
        self.sample_rate = kwargs.get("sample_rate", 16000)
        self.end_of_turn_threshold_ms = 100
        self.min_volume = 0.0

pipecat_audio_vad_silero.SileroVADAnalyzer = SileroVADAnalyzer

pipecat_audio.vad = pipecat_audio_vad
pipecat_audio_vad.vad_analyzer = pipecat_audio_vad_vad_analyzer
pipecat_audio_vad.silero = pipecat_audio_vad_silero
sys.modules["pipecat.audio"] = pipecat_audio
sys.modules["pipecat.audio.vad"] = pipecat_audio_vad
sys.modules["pipecat.audio.vad.vad_analyzer"] = pipecat_audio_vad_vad_analyzer
sys.modules["pipecat.audio.vad.silero"] = pipecat_audio_vad_silero
pipecat_processors = types.ModuleType("pipecat.processors")
pipecat_processors.__path__ = []
pipecat_frame_processor = types.ModuleType("pipecat.processors.frame_processor")
pipecat_frame_processor.FrameProcessor = object
pipecat_frame_processor.FrameDirection = object
pipecat_processors.frame_processor = pipecat_frame_processor
sys.modules["pipecat.processors"] = pipecat_processors
sys.modules["pipecat.processors.frame_processor"] = pipecat_frame_processor
pipecat_transports = types.ModuleType("pipecat.transports")
pipecat_transports.__path__ = []
pipecat_transports_services = types.ModuleType("pipecat.transports.services")
pipecat_transports_services.__path__ = []
pipecat_transports_services_daily = types.ModuleType("pipecat.transports.services.daily")

class DailyParams:
    def __init__(self, *args, **kwargs):
        pass

class DailyTransport:
    def __init__(self, *args, **kwargs):
        pass

pipecat_transports_services_daily.DailyParams = DailyParams
pipecat_transports_services_daily.DailyTransport = DailyTransport
pipecat_transports.services = pipecat_transports_services
pipecat_transports_services.daily = pipecat_transports_services_daily
sys.modules["pipecat.transports"] = pipecat_transports
sys.modules["pipecat.transports.services"] = pipecat_transports_services
sys.modules["pipecat.transports.services.daily"] = pipecat_transports_services_daily
events_pkg = types.ModuleType("events")
events_pkg.__path__ = []
events_emitter_mod = types.ModuleType("events.event_emitter")

class EventEmitter:
    def add_observer(self, observer):
        pass

class VoiceCoreEvent:
    def __init__(self, event_type: str = ""):
        self.event_type = event_type
        self.data = {}

events_emitter_mod.EventEmitter = EventEmitter
events_emitter_mod.VoiceCoreEvent = VoiceCoreEvent
events_pkg.event_emitter = events_emitter_mod
sys.modules["events"] = events_pkg
sys.modules["events.event_emitter"] = events_emitter_mod
pipecat_frames = types.ModuleType("pipecat.frames")
pipecat_frames.__path__ = []
pipecat_frames.Frame = object
pipecat_frames.LLMMessagesFrame = object
pipecat_frames.TextFrame = object
pipecat_frames_frames = types.ModuleType("pipecat.frames.frames")
pipecat_frames_frames.Frame = object
pipecat_frames_frames.LLMMessagesFrame = object
pipecat_frames_frames.TextFrame = object
pipecat_frames_frames.TranscriptionFrame = object
pipecat_frames_frames.AudioRawFrame = object
pipecat_frames_frames.TTSAudioRawFrame = object
pipecat_frames_frames.EndFrame = object
pipecat_frames.frames = pipecat_frames_frames
sys.modules["pipecat.frames"] = pipecat_frames
sys.modules["pipecat.frames.frames"] = pipecat_frames_frames

from src.pipeline.objective_graph_pipeline import build_objective_graph_pipeline


class DummyGraph:
    def __init__(self, *args, **kwargs):
        self.entry_node_id = "entry"

    def build_processor_for_node(self, node_id):
        return MagicMock()


class DummyTTS:
    @classmethod
    def from_env(cls):
        return MagicMock()


class DummyMultiASR:
    @classmethod
    def from_env(cls, event_emitter=None):
        return MagicMock()


def test_pipeline_combines_static_knowledge(monkeypatch):
    """Pipeline should pass static knowledge through knowledge_combiner."""
    combined_args = {}

    def fake_combine(*, layer1_core_prompt, static_knowledge, layer2_system_prompt):
        combined_args["static"] = static_knowledge
        combined_args["layer2"] = layer2_system_prompt
        return "combined"

    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.combine_prompts", fake_combine)
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.ObjectiveGraph", DummyGraph)
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline._create_stt_service", lambda: MagicMock())
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.MultiProviderTTS", DummyTTS)
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.MultiASRProcessor", DummyMultiASR)

    tenant_config = {
        "tenant_id": "t1",
        "system_prompt": "Layer 2 prompt",
        "static_knowledge": "FAQ content",
        "objective_graph": {"nodes": []},
    }

    transport = MagicMock()
    build_objective_graph_pipeline(tenant_config, transport)

    assert combined_args.get("static") == "FAQ content"
    assert combined_args.get("layer2") == "Layer 2 prompt"


def test_pipeline_with_empty_static_knowledge(monkeypatch):
    """Static knowledge is optional; pipeline should handle missing value."""
    combined_args = {}

    def fake_combine(*, layer1_core_prompt, static_knowledge, layer2_system_prompt):
        combined_args["static"] = static_knowledge
        return "combined"

    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.combine_prompts", fake_combine)
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.ObjectiveGraph", DummyGraph)
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline._create_stt_service", lambda: MagicMock())
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.MultiProviderTTS", DummyTTS)
    monkeypatch.setattr("src.pipeline.objective_graph_pipeline.MultiASRProcessor", DummyMultiASR)

    tenant_config = {
        "tenant_id": "t2",
        "system_prompt": "Layer 2 prompt",
        "objective_graph": {"nodes": []},
    }

    transport = MagicMock()
    build_objective_graph_pipeline(tenant_config, transport)

    assert combined_args.get("static") is None
