"""
Integration tests for telephony transports (Daily.co, Twilio)

Tests:
- Daily.co transport initialization and VAD configuration
- Twilio transport initialization and audio encoding validation
- Audio encoding mismatch detection
"""

import pytest
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from transports.daily_transport import DailyTransportWrapper
from transports.twilio_transport import (
    TwilioTransportWrapper,
    AudioEncodingMismatchError,
    validate_audio_pipeline_compatibility
)
from events.event_emitter import EventEmitter


@pytest.fixture(autouse=True)
def disable_smart_turn(monkeypatch):
    from transports.smart_turn_config import SmartTurnConfig

    monkeypatch.setattr(SmartTurnConfig, "create_analyzer", lambda *args, **kwargs: None)


class TestDailyTransport:
    """Tests for Daily.co transport"""
    
    def test_vad_configuration_australian_accent(self):
        """Test VAD configured for Australian accent (250ms threshold)"""
        event_emitter = EventEmitter()
        
        transport = DailyTransportWrapper(
            room_url="https://example.daily.co/test",
            token="test_token",
            event_emitter=event_emitter,
        )
        
        # Check VAD analyzer configuration
        vad = transport.transport.vad_analyzer
        assert vad is not None
        assert vad.end_of_turn_threshold_ms == 250, "VAD threshold should be 250ms for Australian accent"
        assert vad.min_volume == 0.6
    
    def test_from_env_missing_credentials(self):
        """Test from_env raises error when credentials missing"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="DAILY_ROOM_URL and DAILY_ROOM_TOKEN must be set"):
                DailyTransportWrapper.from_env()
    
    def test_from_env_with_credentials(self):
        """Test from_env creates transport with environment credentials"""
        with patch.dict(os.environ, {
            "DAILY_ROOM_URL": "https://example.daily.co/test",
            "DAILY_ROOM_TOKEN": "test_token"
        }):
            transport = DailyTransportWrapper.from_env()
            assert transport.room_url == "https://example.daily.co/test"
            assert transport.token == "test_token"


class TestTwilioTransport:
    """Tests for Twilio transport"""
    
    def test_audio_encoding_pstn_mulaw_8khz(self):
        """Test Twilio PSTN transport uses mulaw 8kHz encoding"""
        event_emitter = EventEmitter()
        
        transport = TwilioTransportWrapper(
            account_sid="test_sid",
            auth_token="test_token",
            event_emitter=event_emitter,
            transport_type="pstn",
        )
        
        # Verify audio encoding
        encoding = transport.audio_encoding
        assert encoding["encoding"] == "mulaw", "Twilio PSTN must use mulaw encoding"
        assert encoding["sample_rate"] == 8000, "Twilio PSTN must use 8kHz sample rate"
        assert encoding["channels"] == 1
    
    def test_audio_encoding_mismatch_detection_encoding(self):
        """Test audio encoding mismatch detection (wrong encoding)"""
        event_emitter = EventEmitter()
        
        # This should raise AudioEncodingMismatchError because we're trying to use PCM for PSTN
        with pytest.raises(AudioEncodingMismatchError, match="mulaw encoding"):
            # Monkey-patch _get_audio_encoding to return wrong encoding
            with patch.object(TwilioTransportWrapper, '_get_audio_encoding', return_value={
                "encoding": "pcm",  # WRONG: Should be mulaw for PSTN
                "sample_rate": 8000,
                "channels": 1,
                "provider": "twilio",
                "transport": "pstn"
            }):
                TwilioTransportWrapper(
                    account_sid="test_sid",
                    auth_token="test_token",
                    event_emitter=event_emitter,
                    transport_type="pstn",
                )
    
    def test_audio_encoding_mismatch_detection_sample_rate(self):
        """Test audio encoding mismatch detection (wrong sample rate)"""
        event_emitter = EventEmitter()
        
        # This should raise AudioEncodingMismatchError because we're using wrong sample rate
        with pytest.raises(AudioEncodingMismatchError, match="8kHz sample rate"):
            # Monkey-patch _get_audio_encoding to return wrong sample rate
            with patch.object(TwilioTransportWrapper, '_get_audio_encoding', return_value={
                "encoding": "mulaw",
                "sample_rate": 16000,  # WRONG: Should be 8000 for PSTN
                "channels": 1,
                "provider": "twilio",
                "transport": "pstn"
            }):
                TwilioTransportWrapper(
                    account_sid="test_sid",
                    auth_token="test_token",
                    event_emitter=event_emitter,
                    transport_type="pstn",
                )
    
    def test_webrtc_transport_not_implemented(self):
        """Test Twilio WebRTC transport raises NotImplementedError in V1"""
        event_emitter = EventEmitter()
        
        with pytest.raises(NotImplementedError, match="Twilio WebRTC transport not implemented"):
            TwilioTransportWrapper(
                account_sid="test_sid",
                auth_token="test_token",
                event_emitter=event_emitter,
                transport_type="webrtc",
            )
    
    def test_from_env_missing_credentials(self):
        """Test from_env raises error when credentials missing"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set"):
                TwilioTransportWrapper.from_env()


class TestAudioPipelineCompatibility:
    """Tests for audio pipeline encoding compatibility validation"""
    
    def test_validate_compatible_encodings(self):
        """Test validation passes for compatible encodings"""
        telephony_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        stt_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        tts_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        # Should not raise
        validate_audio_pipeline_compatibility(
            telephony_encoding,
            stt_encoding,
            tts_encoding
        )
    
    def test_validate_encoding_mismatch(self):
        """Test validation fails for encoding mismatch"""
        telephony_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        stt_encoding = {
            "encoding": "pcm",  # MISMATCH
            "sample_rate": 8000,
            "channels": 1,
        }
        
        tts_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        with pytest.raises(AudioEncodingMismatchError, match="Encoding mismatch"):
            validate_audio_pipeline_compatibility(
                telephony_encoding,
                stt_encoding,
                tts_encoding
            )
    
    def test_validate_sample_rate_mismatch(self):
        """Test validation fails for sample rate mismatch"""
        telephony_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        stt_encoding = {
            "encoding": "mulaw",
            "sample_rate": 8000,
            "channels": 1,
        }
        
        tts_encoding = {
            "encoding": "mulaw",
            "sample_rate": 16000,  # MISMATCH
            "channels": 1,
        }
        
        with pytest.raises(AudioEncodingMismatchError, match="Sample rate mismatch"):
            validate_audio_pipeline_compatibility(
                telephony_encoding,
                stt_encoding,
                tts_encoding
            )
