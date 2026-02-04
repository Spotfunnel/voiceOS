"""
Smart Turn V3 configuration for turn detection.

Smart Turn works in conjunction with Silero VAD:
1. Silero VAD detects silence periods
2. Smart Turn analyzes audio to determine if turn is complete
3. Combines acoustic features with linguistic cues

Research: voice-ai-os/research/01-turn-taking.md
Upstream: https://github.com/pipecat-ai/smart-turn
"""

import os
import inspect
from typing import Optional, Type


def _load_smart_turn_class() -> Type[object]:
    from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import (
        LocalSmartTurnAnalyzerV3,
    )

    return LocalSmartTurnAnalyzerV3


class SmartTurnConfig:
    """Configuration for Smart Turn V3 turn detection."""

    DEFAULT_MODEL_PATH: Optional[str] = None
    DEFAULT_CPU_COUNT: int = 1
    SMART_TURN_ENABLED: bool = True

    @classmethod
    def from_env(cls) -> dict:
        """
        Load Smart Turn configuration from environment.

        Environment Variables:
            SMART_TURN_ENABLED: Enable Smart Turn (default: true)
            SMART_TURN_MODEL_PATH: Path to custom ONNX model (optional)
            SMART_TURN_CPU_COUNT: Number of CPUs for inference (default: 1)

        Returns:
            Dict with Smart Turn configuration
        """
        return {
            "enabled": os.getenv("SMART_TURN_ENABLED", "true").lower() == "true",
            "model_path": os.getenv("SMART_TURN_MODEL_PATH", cls.DEFAULT_MODEL_PATH),
            "cpu_count": int(os.getenv("SMART_TURN_CPU_COUNT", cls.DEFAULT_CPU_COUNT)),
        }

    @classmethod
    def create_analyzer(cls, sample_rate: int = 16000) -> Optional[object]:
        """
        Create Smart Turn V3 analyzer if enabled.

        Args:
            sample_rate: Audio sample rate (Smart Turn requires 16kHz)

        Returns:
            LocalSmartTurnAnalyzerV3 instance if enabled, None otherwise
        """
        config = cls.from_env()

        if not config["enabled"]:
            return None

        if sample_rate != 16000:
            # Smart Turn requires 16kHz; Pipecat handles resampling when needed.
            pass

        smart_turn_class = _load_smart_turn_class()
        params = {
            "smart_turn_model_path": config["model_path"],
            "sample_rate": sample_rate,
        }
        if "cpu_count" in inspect.signature(smart_turn_class).parameters:
            params["cpu_count"] = config["cpu_count"]
        return smart_turn_class(**params)
