"""
Daily.co telephony transport integration

Provides PSTN/WebRTC call handling using Pipecat's DailyTransport.
Configured for Australian timezone (AEST/AEDT).
"""

import os
import asyncio
from typing import Optional
from datetime import datetime
import logging
import pytz

from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.audio.vad.silero import SileroVADAnalyzer
try:
    from pipecat.transports.services.daily import DailyParams, DailyTransport
except Exception as exc:  # Daily SDK not available on Windows or missing deps.
    DailyParams = None
    DailyTransport = None
    logger = logging.getLogger(__name__)
    logger.warning("Daily transport disabled: %s", exc)

from ..events.event_emitter import EventEmitter
from .smart_turn_config import SmartTurnConfig

logger = logging.getLogger(__name__)


class DailyTransportWrapper:
    """
    Wrapper around Pipecat's DailyTransport with Australian timezone configuration
    and event emission integration.
    """
    
    def __init__(
        self,
        room_url: str,
        token: str,
        event_emitter: Optional[EventEmitter] = None,
        bot_name: str = "SpotFunnel AI"
    ):
        """
        Initialize Daily.co transport.
        
        Args:
            room_url: Daily.co room URL
            token: Daily.co room token
            event_emitter: Event emitter for call events
            bot_name: Bot name for Daily.co
        """
        self.room_url = room_url
        self.token = token
        self.event_emitter = event_emitter
        self.bot_name = bot_name
        
        vad_params = VADParams(min_volume=0.6, stop_secs=0.25)
        vad_analyzer = SileroVADAnalyzer(sample_rate=16000, params=vad_params)
        vad_analyzer.end_of_turn_threshold_ms = 250
        vad_analyzer.min_volume = vad_params.min_volume

        smart_turn_analyzer = SmartTurnConfig.create_analyzer(sample_rate=16000)
        if smart_turn_analyzer:
            logger.info("Smart Turn V3 enabled (12ms inference, 23 languages)")
        else:
            logger.info("Smart Turn V3 disabled, using VAD-only turn detection")

        if DailyParams is None or DailyTransport is None:
            logger.warning("Daily SDK not available; Daily transport disabled.")
            self.transport = _StubDailyTransport(vad_analyzer=vad_analyzer)
        else:
            params = DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                vad_enabled=True,
                vad_analyzer=vad_analyzer,
                turn_analyzer=smart_turn_analyzer,
            )

            # Create DailyTransport with explicit loop (fallback to stub on failure)
            try:
                self.transport = DailyTransport(
                    room_url=room_url,
                    token=token,
                    bot_name=bot_name,
                    params=params,
                )
            except RuntimeError as exc:
                logger.warning("DailyTransport init failed, using stub: %s", exc)
                self.transport = _StubDailyTransport(vad_analyzer=vad_analyzer)

        # Expose vad_analyzer for tests/inspection
        self.transport.vad_analyzer = vad_analyzer
        
        # Australian timezone
        self.timezone = pytz.timezone("Australia/Sydney")
        
    async def start(self):
        """Emit call_started event (transport is managed by PipelineRunner)"""
        if self.event_emitter:
            await self.event_emitter.emit("call_started", {
                "room_url": self.room_url,
                "timestamp": datetime.now(self.timezone).isoformat(),
                "timezone": "Australia/Sydney"
            })
    
    async def stop(self):
        """Emit call_ended event (transport is managed by PipelineRunner)"""
        if self.event_emitter:
            await self.event_emitter.emit("call_ended", {
                "room_url": self.room_url,
                "timestamp": datetime.now(self.timezone).isoformat(),
            })
    
    def input(self):
        """Get transport input (for pipeline)"""
        return self.transport.input()
    
    def output(self):
        """Get transport output (for pipeline)"""
        return self.transport.output()

    @classmethod
    def from_env(cls, event_emitter: Optional[EventEmitter] = None):
        """
        Create DailyTransportWrapper from environment variables.

        Environment variables:
            DAILY_API_KEY: Daily.co API key
            DAILY_ROOM_URL: Daily.co room URL (optional, can be passed as arg)
            DAILY_ROOM_TOKEN: Daily.co room token (optional, empty for public rooms)
        """
        room_url = os.getenv("DAILY_ROOM_URL")
        token = os.getenv("DAILY_ROOM_TOKEN")

        if not room_url or not token:
            raise ValueError("DAILY_ROOM_URL and DAILY_ROOM_TOKEN must be set")

        return cls(
            room_url=room_url,
            token=token,
            event_emitter=event_emitter
        )


class _StubDailyTransport:
    def __init__(self, vad_analyzer):
        self.vad_analyzer = vad_analyzer

    def input(self):
        raise NotImplementedError("Daily transport not available in this environment.")

    def output(self):
        raise NotImplementedError("Daily transport not available in this environment.")
    
