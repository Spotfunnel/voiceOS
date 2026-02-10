"""Pipeline helpers for Voice Core."""

from .audio_pipeline import AudioPipeline, build_pipeline
# email_capture_pipeline removed - tied to objective_state which was deleted

__all__ = [
    "AudioPipeline",
    "build_pipeline",
]
