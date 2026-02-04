"""
Unit tests for Smart Turn V3 configuration.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from transports.smart_turn_config import SmartTurnConfig


def test_smart_turn_config_from_env_defaults():
    config = SmartTurnConfig.from_env()

    assert config["enabled"] is True
    assert config["model_path"] is None
    assert config["cpu_count"] == 1


def test_smart_turn_config_from_env_custom():
    with patch.dict(
        os.environ,
        {
            "SMART_TURN_ENABLED": "true",
            "SMART_TURN_MODEL_PATH": "/custom/model.onnx",
            "SMART_TURN_CPU_COUNT": "2",
        },
    ):
        config = SmartTurnConfig.from_env()

        assert config["enabled"] is True
        assert config["model_path"] == "/custom/model.onnx"
        assert config["cpu_count"] == 2


def test_smart_turn_config_disabled():
    with patch.dict(os.environ, {"SMART_TURN_ENABLED": "false"}):
        config = SmartTurnConfig.from_env()
        assert config["enabled"] is False


def test_smart_turn_analyzer_creation_enabled():
    mock_analyzer = MagicMock()

    with patch(
        "transports.smart_turn_config._load_smart_turn_class",
        return_value=MagicMock(return_value=mock_analyzer),
    ) as mock_loader:
        with patch.dict(os.environ, {"SMART_TURN_ENABLED": "true"}):
            analyzer = SmartTurnConfig.create_analyzer(sample_rate=16000)

            assert analyzer is not None
            assert analyzer == mock_analyzer
            mock_loader.assert_called_once_with()


def test_smart_turn_analyzer_creation_disabled():
    with patch.dict(os.environ, {"SMART_TURN_ENABLED": "false"}):
        analyzer = SmartTurnConfig.create_analyzer(sample_rate=16000)

        assert analyzer is None
