"""
Pipeline error handlers for graceful degradation.
Provides user-facing fallback messages when providers fail.
"""
import logging

logger = logging.getLogger(__name__)


class PipelineErrorHandler:
    """Handle pipeline errors gracefully with user-facing fallbacks."""

    def __init__(self, tenant_id: str, call_sid: str):
        self.tenant_id = tenant_id
        self.call_sid = call_sid

    def get_llm_failure_message(self) -> str:
        """
        Get fallback message for LLM provider failure.
        This message will be spoken to the caller via TTS (if available)
        or Twilio's built-in TTS as last resort.
        """
        logger.critical(
            "All LLM providers failed for call %s (tenant %s)",
            self.call_sid,
            self.tenant_id,
        )
        return (
            "I apologize, but I'm experiencing technical difficulties right now. "
            "Let me transfer you to someone who can help you immediately."
        )

    def get_tts_failure_message(self) -> str:
        """
        Get fallback message for TTS provider failure.
        This will be played using Twilio's built-in TTS.
        """
        logger.critical(
            "All TTS providers failed for call %s (tenant %s)",
            self.call_sid,
            self.tenant_id,
        )
        return (
            "I'm sorry, I'm having trouble with my voice system. "
            "Please hold while I transfer you to a representative."
        )

    def get_stt_failure_message(self) -> str:
        """Get fallback message for STT failure."""
        logger.critical(
            "STT failed for call %s (tenant %s)",
            self.call_sid,
            self.tenant_id,
        )
        return (
            "I'm having trouble hearing you clearly. "
            "Let me connect you with someone who can help."
        )

    def get_generic_error_message(self) -> str:
        """Get generic error message for unexpected failures."""
        return (
            "I apologize, but something went wrong. "
            "Let me transfer you to someone who can assist you."
        )
