"""
Twilio telephony transport integration for PSTN calls

CRITICAL: Twilio PSTN requires mulaw 8kHz audio encoding.
This is NOT negotiable - PCM 16kHz will cause garbled audio.

Audio encoding validation happens at initialization to prevent production failures.
Reference: production-failure-prevention.md - "Audio Encoding Mismatches"
"""

import os
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
import pytz

try:
    from pipecat.transports.services.twilio import TwilioTransport
except Exception:  # pragma: no cover - optional dependency
    TwilioTransport = None

from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.audio.vad.silero import SileroVADAnalyzer

from events.event_emitter import EventEmitter


class _StubTwilioTransport:
    def __init__(self, *args, **kwargs):
        self._error = "pipecat TwilioTransport is not available in this environment."

    def input(self):
        raise NotImplementedError(self._error)

    def output(self):
        raise NotImplementedError(self._error)


class AudioEncodingMismatchError(Exception):
    """Raised when audio encoding doesn't match telephony provider requirements"""
    pass


class TwilioTransportWrapper:
    """
    Wrapper around Pipecat's TwilioTransport with PSTN-specific configuration.
    
    CRITICAL AUDIO ENCODING:
    - PSTN calls: mulaw 8kHz (non-negotiable)
    - WebRTC calls: PCM 16kHz (optional, not implemented in V1)
    
    Validates encoding at initialization to prevent production failures.
    """
    
    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        event_emitter: Optional[EventEmitter] = None,
        bot_name: str = "SpotFunnel AI",
        transport_type: str = "pstn",  # "pstn" or "webrtc"
    ):
        """
        Initialize Twilio transport.
        
        Args:
            account_sid: Twilio account SID
            auth_token: Twilio auth token
            event_emitter: Event emitter for call events
            bot_name: Bot name for Twilio
            transport_type: "pstn" or "webrtc" (only "pstn" supported in V1)
            
        Raises:
            AudioEncodingMismatchError: If encoding requirements not met
            ValueError: If invalid transport_type
        """
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.event_emitter = event_emitter
        self.bot_name = bot_name
        self.transport_type = transport_type
        
        # Validate transport type
        if transport_type not in ["pstn", "webrtc"]:
            raise ValueError(f"Invalid transport_type: {transport_type}. Must be 'pstn' or 'webrtc'")
        
        if transport_type == "webrtc":
            raise NotImplementedError("Twilio WebRTC transport not implemented in V1. Use Daily.co for WebRTC.")
        
        # Audio encoding configuration (CRITICAL for PSTN)
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
        
        # Create TwilioTransport (fallback to stub if dependency missing)
        # Note: Pipecat TwilioTransport handles WebSocket connection from Twilio
        transport_cls = TwilioTransport or _StubTwilioTransport
        self.transport = transport_cls(
            account_sid=account_sid,
            auth_token=auth_token,
            bot_name=bot_name,
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=vad_analyzer,
            vad_enabled=True,
            # Audio encoding: mulaw 8kHz for PSTN
            audio_encoding=self.audio_encoding["encoding"],
            sample_rate=self.audio_encoding["sample_rate"],
            channels=self.audio_encoding["channels"],
        )
        
        # Australian timezone
        self.timezone = pytz.timezone("Australia/Sydney")
        
        # Call metadata (for recording hooks)
        self.call_sid: Optional[str] = None
        self.call_metadata: Dict[str, Any] = {}
        
    def _get_audio_encoding(self) -> Dict[str, Any]:
        """
        Get audio encoding configuration based on transport type.
        
        Returns:
            Dict with encoding, sample_rate, channels
            
        Reference: research/04.5-telephony-infrastructure.md
        """
        if self.transport_type == "pstn":
            # Twilio PSTN requires mulaw 8kHz (non-negotiable)
            return {
                "encoding": "mulaw",
                "sample_rate": 8000,
                "channels": 1,
                "provider": "twilio",
                "transport": "pstn"
            }
        elif self.transport_type == "webrtc":
            # Twilio WebRTC supports PCM 16kHz
            return {
                "encoding": "pcm",
                "sample_rate": 16000,
                "channels": 1,
                "provider": "twilio",
                "transport": "webrtc"
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
        
        # Validate Twilio PSTN requirements
        if self.transport_type == "pstn":
            if encoding["encoding"] != "mulaw":
                raise AudioEncodingMismatchError(
                    f"Twilio PSTN requires mulaw encoding, got {encoding['encoding']}. "
                    "This will cause garbled audio. Fix: Set encoding='mulaw'"
                )
            
            if encoding["sample_rate"] != 8000:
                raise AudioEncodingMismatchError(
                    f"Twilio PSTN requires 8kHz sample rate, got {encoding['sample_rate']}Hz. "
                    "This will cause garbled audio. Fix: Set sample_rate=8000"
                )
        
        # Validate Twilio WebRTC requirements (if implemented)
        elif self.transport_type == "webrtc":
            if encoding["encoding"] != "pcm":
                raise AudioEncodingMismatchError(
                    f"Twilio WebRTC requires PCM encoding, got {encoding['encoding']}"
                )
            
            if encoding["sample_rate"] != 16000:
                raise AudioEncodingMismatchError(
                    f"Twilio WebRTC requires 16kHz sample rate, got {encoding['sample_rate']}Hz"
                )
    
    async def start(self, call_sid: Optional[str] = None):
        """
        Start the transport and emit call_started event.
        
        Args:
            call_sid: Twilio call SID (for call recording hooks)
        """
        self.call_sid = call_sid
        await self.transport.start()
        
        if self.event_emitter:
            await self.event_emitter.emit("call_started", {
                "call_sid": call_sid,
                "provider": "twilio",
                "transport_type": self.transport_type,
                "audio_encoding": self.audio_encoding,
                "timestamp": datetime.now(self.timezone).isoformat(),
                "timezone": "Australia/Sydney"
            })
    
    async def stop(self):
        """Stop the transport and emit call_ended event"""
        if self.event_emitter:
            await self.event_emitter.emit("call_ended", {
                "call_sid": self.call_sid,
                "provider": "twilio",
                "timestamp": datetime.now(self.timezone).isoformat(),
            })
        
        await self.transport.stop()
    
    def input(self):
        """Get transport input (for pipeline)"""
        return self.transport.input()
    
    def output(self):
        """Get transport output (for pipeline)"""
        return self.transport.output()
    
    def enable_recording(self):
        """
        Enable call recording.
        
        CRITICAL: Recording upload MUST be non-blocking (fire-and-forget).
        Never block call workers on I/O operations.
        
        Reference: production-failure-prevention.md - "Worker Blocking on I/O Operations"
        """
        self.call_metadata["recording_enabled"] = True
        
        # Note: Actual recording happens via Twilio API
        # Upload to object storage MUST be async (background job queue)
    
    async def get_recording_url(self) -> Optional[str]:
        """
        Get call recording URL (non-blocking).
        
        Returns:
            Recording URL if available, None otherwise
        """
        if not self.call_sid:
            return None
        
        # Note: Actual implementation would query Twilio API
        # This is a placeholder for V1
        return None
    
    @classmethod
    def from_env(cls, event_emitter: Optional[EventEmitter] = None):
        """
        Create TwilioTransportWrapper from environment variables.
        
        Environment variables:
            TWILIO_ACCOUNT_SID: Twilio account SID
            TWILIO_AUTH_TOKEN: Twilio auth token
        """
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        
        if not account_sid or not auth_token:
            raise ValueError(
                "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in environment"
            )
        
        return cls(
            account_sid=account_sid,
            auth_token=auth_token,
            event_emitter=event_emitter,
            transport_type="pstn"  # Default to PSTN for V1
        )


def validate_audio_pipeline_compatibility(
    telephony_encoding: Dict[str, Any],
    stt_encoding: Dict[str, Any],
    tts_encoding: Dict[str, Any]
):
    """
    Validate audio encoding compatibility across pipeline components.
    
    CRITICAL: Run this during onboarding, not in production.
    
    Args:
        telephony_encoding: Audio encoding from telephony provider
        stt_encoding: Audio encoding expected by STT service
        tts_encoding: Audio encoding produced by TTS service
        
    Raises:
        AudioEncodingMismatchError: If encodings are incompatible
        
    Reference: production-failure-prevention.md - "Audio Encoding Mismatches"
    """
    # Extract encoding parameters
    tel_enc = telephony_encoding["encoding"]
    tel_rate = telephony_encoding["sample_rate"]
    
    stt_enc = stt_encoding["encoding"]
    stt_rate = stt_encoding["sample_rate"]
    
    tts_enc = tts_encoding["encoding"]
    tts_rate = tts_encoding["sample_rate"]
    
    # Check encoding compatibility
    if not (tel_enc == stt_enc == tts_enc):
        raise AudioEncodingMismatchError(
            f"Encoding mismatch: telephony={tel_enc}, stt={stt_enc}, tts={tts_enc}. "
            "All components must use the same audio encoding."
        )
    
    # Check sample rate compatibility
    if not (tel_rate == stt_rate == tts_rate):
        raise AudioEncodingMismatchError(
            f"Sample rate mismatch: telephony={tel_rate}Hz, stt={stt_rate}Hz, tts={tts_rate}Hz. "
            "All components must use the same sample rate."
        )
