"""
Daily.co telephony transport integration

Provides PSTN/WebRTC call handling using Pipecat's DailyTransport.
Configured for Australian timezone (AEST/AEDT).
"""

import os
import asyncio
from typing import Optional
from datetime import datetime
import pytz

from pipecat.transports.services.daily import DailyTransport

from ..events.event_emitter import EventEmitter


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
        
        # Create DailyTransport (VAD is handled internally by Pipecat 0.0.46)
        self.transport = DailyTransport(
            room_url=room_url,
            token=token,
            bot_name=bot_name,
        )
        
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
        token = os.getenv("DAILY_ROOM_TOKEN", "")  # Empty string for public rooms
        
        if not room_url:
            raise ValueError(
                "DAILY_ROOM_URL must be set in environment"
            )
        
        return cls(
            room_url=room_url,
            token=token if token else None,  # None for public rooms
            event_emitter=event_emitter
        )
