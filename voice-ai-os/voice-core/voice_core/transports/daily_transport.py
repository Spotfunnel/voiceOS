"""
Daily.co WebRTC Transport Integration

Provides a wrapper around Pipecat's DailyTransport with additional
configuration for Australian accent optimization and VAD settings.
"""

try:
    from pipecat.transports.services.daily import DailyTransport
    _DAILY_IMPORT_ERROR = None
except Exception as e:
    DailyTransport = None  # type: ignore[assignment]
    _DAILY_IMPORT_ERROR = e
try:
    from pipecat.vad.silero import SileroVADAnalyzer
    _SILERO_IMPORT_ERROR = None
except Exception as e:
    SileroVADAnalyzer = None  # type: ignore[assignment]
    _SILERO_IMPORT_ERROR = e
import structlog

logger = structlog.get_logger(__name__)

VAD_MIN_VOLUME = 0.6
VAD_END_OF_TURN_THRESHOLD_MS = 300


class DailyTransportWrapper:
    """
    Wrapper for Daily.co transport with Australian accent optimizations.
    
    Configures VAD (Voice Activity Detection) for Australian English:
    - Higher end-of-turn threshold (300ms vs 150ms US default)
    - Optimized for rising intonation patterns
    """
    
    def __init__(
        self,
        room_url: str,
        token: str,
        bot_name: str = "SpotFunnel AI",
        audio_in_enabled: bool = True,
        audio_out_enabled: bool = True,
        vad_enabled: bool = True,
    ):
        """
        Initialize Daily.co transport wrapper.
        
        Args:
            room_url: Daily.co room URL
            token: Daily.co authentication token
            bot_name: Name of the bot (displayed in Daily.co)
            audio_in_enabled: Enable audio input
            audio_out_enabled: Enable audio output
            vad_enabled: Enable Voice Activity Detection
            min_volume: (internal) Minimum volume threshold for VAD
            end_of_turn_threshold_ms: (internal) End-of-turn detection threshold (ms)
        """
        self.room_url = room_url
        self.token = token
        self.bot_name = bot_name
        
        # Configure VAD for Australian accent
        vad_analyzer = None
        if vad_enabled:
            if SileroVADAnalyzer is None:
                raise ImportError(
                    "Silero VAD dependency missing or incompatible. "
                    "Install pipecat-ai[silero] and onnxruntime."
                ) from _SILERO_IMPORT_ERROR
            vad_analyzer = SileroVADAnalyzer(
                min_volume=VAD_MIN_VOLUME,
                end_of_turn_threshold_ms=VAD_END_OF_TURN_THRESHOLD_MS,
            )
            logger.info(
                "VAD configured for Australian accent",
                min_volume=VAD_MIN_VOLUME,
                end_of_turn_threshold_ms=VAD_END_OF_TURN_THRESHOLD_MS,
            )
        
        if DailyTransport is None:
            raise ImportError(
                "Daily dependency missing or incompatible. "
                "Install pipecat-ai[daily] and a compatible daily SDK."
            ) from _DAILY_IMPORT_ERROR

        # Create DailyTransport instance
        self.transport = DailyTransport(
            room_url=room_url,
            token=token,
            bot_name=bot_name,
            audio_in_enabled=audio_in_enabled,
            audio_out_enabled=audio_out_enabled,
            vad_analyzer=vad_analyzer,
            vad_enabled=vad_enabled,
        )
        
        logger.info(
            "Daily.co transport initialized",
            room_url=room_url,
            bot_name=bot_name,
            vad_enabled=vad_enabled,
        )
    
    def input(self):
        """Get the input processor for the pipeline."""
        return self.transport.input()
    
    def output(self):
        """Get the output processor for the pipeline."""
        return self.transport.output()
    
    async def start(self):
        """Start the transport connection."""
        await self.transport.start()
        logger.info("Daily.co transport started")
    
    async def stop(self):
        """Stop the transport connection."""
        await self.transport.stop()
        logger.info("Daily.co transport stopped")
