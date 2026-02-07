"""
Telnyx telephony transport integration for PSTN calls with HD audio

AUDIO CONFIGURATION:
- Telnyx supports up to 16kHz HD audio (vs Twilio's 8kHz)
- PCMU (mulaw) encoding for PSTN compatibility
- Automatic resampling for pipeline integration

Audio encoding validation happens at initialization to prevent production failures.
"""

import os
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import pytz

try:
    from pipecat.serializers.telnyx import TelnyxFrameSerializer
    from pipecat.transports.base_transport import BaseTransport
except Exception:  # pragma: no cover - optional dependency
    TelnyxFrameSerializer = None
    BaseTransport = None

from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.audio.vad.silero import SileroVADAnalyzer

from ..events.event_emitter import EventEmitter
from .smart_turn_config import SmartTurnConfig

logger = logging.getLogger(__name__)


class _StubTelnyxTransport:
    def __init__(self, *args, **kwargs):
        self._error = "pipecat TelnyxFrameSerializer is not available in this environment."

    def input(self):
        raise NotImplementedError(self._error)

    def output(self):
        raise NotImplementedError(self._error)


class AudioEncodingMismatchError(Exception):
    """Raised when audio encoding doesn't match telephony provider requirements"""
    pass


class TelnyxTransportWrapper:
    """
    Wrapper around Pipecat's TelnyxFrameSerializer with PSTN HD audio configuration.
    
    AUDIO CONFIGURATION:
    - PSTN calls: PCMU (mulaw) 16kHz HD audio
    - Better quality than Twilio's 8kHz
    - Automatic resampling for pipeline integration
    
    Validates encoding at initialization to prevent production failures.
    """
    
    def __init__(
        self,
        api_key: str,
        call_control_id: str,
        stream_id: str,
        event_emitter: Optional[EventEmitter] = None,
        bot_name: str = "SpotFunnel AI",
        sample_rate: int = 16000,  # HD audio (vs Twilio's 8kHz)
    ):
        """
        Initialize Telnyx transport.
        
        Args:
            api_key: Telnyx API key
            call_control_id: Telnyx call control ID
            stream_id: Telnyx stream ID for WebSocket
            event_emitter: Event emitter for call events
            bot_name: Bot name for Telnyx
            sample_rate: Audio sample rate (default 16000 for HD audio)
            
        Raises:
            AudioEncodingMismatchError: If encoding requirements not met
            ValueError: If invalid parameters
        """
        self.api_key = api_key
        self.call_control_id = call_control_id
        self.stream_id = stream_id
        self.event_emitter = event_emitter
        self.bot_name = bot_name
        self.sample_rate = sample_rate
        
        # Audio encoding configuration (HD audio for Telnyx)
        self.audio_encoding = self._get_audio_encoding()
        
        # Validate encoding requirements
        self._validate_audio_encoding()
        
        # Configure VAD for Australian accent (250ms threshold)
        # Note: Barge-in requires 2-word minimum (handled at LLM layer)
        vad_params = VADParams(min_volume=0.6, stop_secs=0.25)
        vad_analyzer = SileroVADAnalyzer(
            sample_rate=self.audio_encoding["sample_rate"],
            params=vad_params,
        )
        vad_analyzer.end_of_turn_threshold_ms = 250
        vad_analyzer.min_volume = vad_params.min_volume

        smart_turn_analyzer = SmartTurnConfig.create_analyzer(sample_rate=16000)
        if smart_turn_analyzer:
            logger.info(
                "Smart Turn V3 enabled for Telnyx PSTN (16kHz HD audio)"
            )
        else:
            logger.info("Smart Turn V3 disabled for Telnyx PSTN")
        
        # Create TelnyxFrameSerializer
        if TelnyxFrameSerializer is None:
            logger.error("TelnyxFrameSerializer not available - using stub")
            self.serializer = None
        else:
            self.serializer = TelnyxFrameSerializer(
                stream_id=stream_id,
                outbound_encoding="PCMU",  # Audio from Telnyx to us
                inbound_encoding="PCMU",   # Audio from us to Telnyx
                call_control_id=call_control_id,
                api_key=api_key,
                params=TelnyxFrameSerializer.InputParams(
                    telnyx_sample_rate=sample_rate,
                    sample_rate=sample_rate,
                    inbound_encoding="PCMU",
                    outbound_encoding="PCMU",
                    auto_hang_up=True
                )
            )
        
        # Australian timezone
        self.timezone = pytz.timezone("Australia/Sydney")
        
        # Call metadata (for recording hooks)
        self.call_metadata: Dict[str, Any] = {}
        
    def _get_audio_encoding(self) -> Dict[str, Any]:
        """
        Get audio encoding configuration for Telnyx.
        
        Returns:
            Dict with encoding, sample_rate, channels
        """
        return {
            "encoding": "PCMU",  # mulaw
            "sample_rate": self.sample_rate,
            "channels": 1,
            "provider": "telnyx",
            "transport": "pstn"
        }
    
    def _validate_audio_encoding(self):
        """
        Validate audio encoding requirements.
        
        CRITICAL: This runs at initialization (not in production) to prevent
        100% failure rate from encoding mismatches.
        
        Raises:
            AudioEncodingMismatchError: If encoding requirements not met
        """
        encoding = self.audio_encoding
        
        # Validate Telnyx requirements
        if encoding["encoding"] not in ["PCMU", "PCMA"]:
            raise AudioEncodingMismatchError(
                f"Telnyx requires PCMU or PCMA encoding, got {encoding['encoding']}. "
                "This will cause garbled audio. Fix: Set encoding='PCMU'"
            )
        
        if encoding["sample_rate"] not in [8000, 16000]:
            raise AudioEncodingMismatchError(
                f"Telnyx supports 8kHz or 16kHz sample rate, got {encoding['sample_rate']}Hz. "
                "This will cause garbled audio. Fix: Set sample_rate=16000"
            )
    
    async def start(self):
        """
        Start the transport and emit call_started event.
        """
        # Note: Telnyx WebSocket connection is handled by the serializer
        # No explicit start needed for serializer
        
        if self.event_emitter:
            await self.event_emitter.emit("call_started", {
                "call_control_id": self.call_control_id,
                "provider": "telnyx",
                "audio_encoding": self.audio_encoding,
                "timestamp": datetime.now(self.timezone).isoformat(),
                "timezone": "Australia/Sydney"
            })
    
    async def stop(self):
        """Stop the transport and emit call_ended event"""
        if self.event_emitter:
            await self.event_emitter.emit("call_ended", {
                "call_control_id": self.call_control_id,
                "provider": "telnyx",
                "timestamp": datetime.now(self.timezone).isoformat(),
            })
    
    def input(self):
        """Get transport input (for pipeline)"""
        if self.serializer:
            return self.serializer
        raise NotImplementedError("TelnyxFrameSerializer not available")
    
    def output(self):
        """Get transport output (for pipeline)"""
        if self.serializer:
            return self.serializer
        raise NotImplementedError("TelnyxFrameSerializer not available")
    
    def enable_recording(self):
        """
        Enable call recording.
        
        CRITICAL: Recording upload MUST be non-blocking (fire-and-forget).
        Never block call workers on I/O operations.
        """
        self.call_metadata["recording_enabled"] = True
        
        # Note: Actual recording happens via Telnyx API
        # Upload to object storage MUST be async (background job queue)
    
    async def get_recording_url(self) -> Optional[str]:
        """
        Get call recording URL (non-blocking).
        
        Returns:
            Recording URL if available, None otherwise
        """
        if not self.call_control_id:
            return None
        
        # Note: Actual implementation would query Telnyx API
        # This is a placeholder for V1
        return None
    
    @classmethod
    def from_env(cls, call_control_id: str, stream_id: str, event_emitter: Optional[EventEmitter] = None):
        """
        Create TelnyxTransportWrapper from environment variables.
        
        Args:
            call_control_id: Telnyx call control ID (from webhook)
            stream_id: Telnyx stream ID (from webhook)
            event_emitter: Event emitter for call events
        
        Environment variables:
            TELNYX_API_KEY: Telnyx API key
            TELNYX_SAMPLE_RATE: Audio sample rate (default 16000)
        """
        api_key = os.getenv("TELNYX_API_KEY")
        
        if not api_key:
            raise ValueError(
                "TELNYX_API_KEY must be set in environment"
            )
        
        sample_rate = int(os.getenv("TELNYX_SAMPLE_RATE", "16000"))
        
        return cls(
            api_key=api_key,
            call_control_id=call_control_id,
            stream_id=stream_id,
            event_emitter=event_emitter,
            sample_rate=sample_rate
        )
