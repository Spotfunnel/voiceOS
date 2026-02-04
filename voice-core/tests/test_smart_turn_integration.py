"""
Integration tests for Smart Turn V3 transport configuration.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from pipecat.audio.turn.base_turn_analyzer import BaseTurnAnalyzer, EndOfTurnState


class DummyTurnParams:
    pass


class DummyTurnAnalyzer(BaseTurnAnalyzer):
    @property
    def speech_triggered(self) -> bool:
        return False

    @property
    def params(self) -> DummyTurnParams:
        return DummyTurnParams()

    def append_audio(self, buffer: bytes, is_speech: bool) -> EndOfTurnState:
        return EndOfTurnState.INCOMPLETE

    async def analyze_end_of_turn(self):
        return EndOfTurnState.INCOMPLETE, None

    def clear(self):
        return None

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


@patch("transports.daily_transport.DailyTransport")
@patch("transports.smart_turn_config._load_smart_turn_class")
def test_daily_transport_smart_turn_enabled(mock_loader, mock_daily_transport):
    from transports.daily_transport import DailyTransportWrapper

    mock_analyzer = DummyTurnAnalyzer()
    mock_loader.return_value = MagicMock(return_value=mock_analyzer)

    with patch.dict(os.environ, {"SMART_TURN_ENABLED": "true"}):
        DailyTransportWrapper(
            room_url="https://example.daily.co/test",
            token="test_token",
        )

        mock_loader.assert_called_once()
        call_kwargs = mock_daily_transport.call_args[1]
        params = call_kwargs["params"]

        assert params.turn_analyzer == mock_analyzer


@patch("transports.daily_transport.DailyTransport")
def test_daily_transport_smart_turn_disabled(mock_daily_transport):
    from transports.daily_transport import DailyTransportWrapper

    with patch.dict(os.environ, {"SMART_TURN_ENABLED": "false"}):
        DailyTransportWrapper(
            room_url="https://example.daily.co/test",
            token="test_token",
        )

        call_kwargs = mock_daily_transport.call_args[1]
        params = call_kwargs["params"]

        assert params.turn_analyzer is None


@patch("transports.twilio_transport.TwilioTransport")
@patch("transports.smart_turn_config._load_smart_turn_class")
def test_twilio_transport_smart_turn_enabled(mock_loader, mock_twilio_transport):
    from transports.twilio_transport import TwilioTransportWrapper

    mock_analyzer = DummyTurnAnalyzer()
    mock_loader.return_value = MagicMock(return_value=mock_analyzer)

    with patch.dict(os.environ, {"SMART_TURN_ENABLED": "true"}):
        TwilioTransportWrapper(
            account_sid="test_sid",
            auth_token="test_token",
            transport_type="pstn",
        )

        mock_loader.assert_called_once()
        call_kwargs = mock_twilio_transport.call_args[1]

        assert call_kwargs["turn_analyzer"] == mock_analyzer
