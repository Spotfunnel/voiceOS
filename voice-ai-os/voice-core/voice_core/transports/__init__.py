"""
Transport layer for telephony integration.

Supports:
- Daily.co (WebRTC)
- PSTN (future)
- WebSocket (future)
"""

from voice_core.transports.daily_transport import DailyTransportWrapper

__all__ = ["DailyTransportWrapper"]
