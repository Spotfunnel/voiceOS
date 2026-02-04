"""Integration tests for objective graph pipeline configuration."""

from pathlib import Path
import importlib.util
import sys
import types

from src.prompts import LAYER_1_CORE_PROMPT


def test_objective_graph_combines_layer1_and_layer2_prompts(monkeypatch):
    captured = {}

    class DummyProcessor:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    class DummyGraph:
        def __init__(self, *args, **kwargs):
            captured["system_prompt"] = kwargs.get("system_prompt")
            self.entry_node_id = "start"

        def build_processor_for_node(self, node_id):
            return DummyProcessor()

    class DummyMultiASR:
        @classmethod
        def from_env(cls, event_emitter=None):
            return DummyProcessor()

    class DummyTransport:
        def input(self):
            return DummyProcessor()

        def output(self):
            return DummyProcessor()

    root_path = Path(__file__).resolve().parents[1]
    module_path = root_path / "src" / "pipeline" / "objective_graph_pipeline.py"

    src_pkg = types.ModuleType("src")
    src_pkg.__path__ = [str(root_path / "src")]
    pipeline_pkg = types.ModuleType("src.pipeline")
    pipeline_pkg.__path__ = [str(root_path / "src" / "pipeline")]
    sys.modules["src"] = src_pkg
    sys.modules["src.pipeline"] = pipeline_pkg

    transports_pkg = types.ModuleType("src.transports")
    transports_pkg.__path__ = [str(root_path / "src" / "transports")]
    sys.modules["src.transports"] = transports_pkg
    dummy_daily = types.ModuleType("src.transports.daily_transport")
    dummy_daily.DailyTransportWrapper = object
    sys.modules["src.transports.daily_transport"] = dummy_daily

    spec = importlib.util.spec_from_file_location(
        "src.pipeline.objective_graph_pipeline",
        module_path,
    )
    objective_graph_pipeline = importlib.util.module_from_spec(spec)
    assert spec and spec.loader

    dummy_deepgram = types.ModuleType("pipecat.services.deepgram")
    dummy_deepgram.DeepgramSTTService = DummyProcessor
    sys.modules["pipecat.services.deepgram"] = dummy_deepgram

    spec.loader.exec_module(objective_graph_pipeline)

    monkeypatch.setattr(objective_graph_pipeline, "ObjectiveGraph", DummyGraph)
    monkeypatch.setattr(objective_graph_pipeline, "MultiASRProcessor", DummyMultiASR)
    monkeypatch.setattr(objective_graph_pipeline, "_create_stt_service", lambda: DummyProcessor())
    monkeypatch.setattr(objective_graph_pipeline, "MultiProviderTTS", DummyMultiASR)
    monkeypatch.setattr(objective_graph_pipeline, "PipelineFrameObserver", DummyProcessor)
    monkeypatch.setattr(objective_graph_pipeline, "Pipeline", DummyProcessor)

    tenant_config = {
        "tenant_id": "test-tenant",
        "system_prompt": "You work for Bob's Plumbing in Sydney.",
        "objective_graph": {"nodes": [{"id": "start", "type": "sequence", "primitives": []}]},
        "locale": "en-AU",
    }

    objective_graph_pipeline.build_objective_graph_pipeline(
        tenant_config=tenant_config,
        transport=DummyTransport(),
        event_emitter=None,
    )

    assert LAYER_1_CORE_PROMPT.strip() in captured["system_prompt"]
    assert "Bob's Plumbing" in captured["system_prompt"]
