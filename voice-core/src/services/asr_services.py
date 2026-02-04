"""
ASR service wrappers for multi-ASR voting (batch mode).

Supports:
- Deepgram (batch REST API)
- AssemblyAI Universal-2 (batch SDK)
- OpenAI GPT-4o-transcribe (batch API)
"""

from typing import Optional
import asyncio
import io
import logging
import os
import tempfile
import wave

import httpx

logger = logging.getLogger(__name__)


def _pcm_to_wav_bytes(
    pcm_bytes: bytes,
    sample_rate: int,
    channels: int,
    sample_width: int = 2,
) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()


class DeepgramBatchService:
    """
    Deepgram batch transcription via REST API.

    Uses the same API key as streaming Deepgram STT.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "nova-3",
        language: str = "en-AU",
        sample_rate: int = 16000,
        channels: int = 1,
    ):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        self.enabled = bool(self.api_key)
        self.model = model
        self.language = language
        self.sample_rate = sample_rate
        self.channels = channels
        if not self.enabled:
            logger.warning("DeepgramBatchService disabled (DEEPGRAM_API_KEY missing)")

    async def transcribe(self, audio_bytes: bytes) -> str:
        if not self.enabled:
            return ""

        try:
            wav_bytes = _pcm_to_wav_bytes(
                audio_bytes, sample_rate=self.sample_rate, channels=self.channels
            )
            params = {
                "model": self.model,
                "language": self.language,
                "punctuate": "true",
            }
            headers = {"Authorization": f"Token {self.api_key}"}
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://api.deepgram.com/v1/listen",
                    params=params,
                    headers=headers,
                    content=wav_bytes,
                )
            response.raise_for_status()
            data = response.json()
            alternatives = (
                data.get("results", {})
                .get("channels", [{}])[0]
                .get("alternatives", [])
            )
            if alternatives:
                return alternatives[0].get("transcript", "") or ""
            return ""
        except Exception as exc:
            logger.error("Deepgram batch transcription failed: %s", exc)
            return ""

    @classmethod
    def from_env(cls) -> "DeepgramBatchService":
        return cls()


class AssemblyAIService:
    """
    AssemblyAI wrapper for multi-ASR voting.

    Research: 300-600ms latency, high accuracy for Australian English.
    Cost: ~$0.01/min (same as Deepgram).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 16000,
        channels: int = 1,
    ):
        """
        Initialize AssemblyAI service.

        Args:
            api_key: AssemblyAI API key (defaults to ASSEMBLYAI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("ASSEMBLYAI_API_KEY")
        self.sample_rate = sample_rate
        self.channels = channels
        self.enabled = bool(self.api_key)
        if not self.enabled:
            logger.warning("AssemblyAIService disabled (ASSEMBLYAI_API_KEY missing)")

    async def transcribe(self, audio_bytes: bytes) -> str:
        """
        Transcribe audio to text.

        Args:
            audio_bytes: Raw audio data (16kHz, PCM16)

        Returns:
            Transcribed text (empty string if not configured)
        """
        if not self.enabled:
            return ""

        try:
            import assemblyai as aai

            aai.settings.api_key = self.api_key
            transcriber = aai.Transcriber()
            config = aai.TranscriptionConfig(language_code="en_au")

            wav_bytes = _pcm_to_wav_bytes(
                audio_bytes, sample_rate=self.sample_rate, channels=self.channels
            )
            with tempfile.NamedTemporaryFile(suffix=".wav") as temp_file:
                temp_file.write(wav_bytes)
                temp_file.flush()
                transcript = await asyncio.to_thread(
                    transcriber.transcribe, temp_file.name, config=config
                )

            if transcript.status == aai.TranscriptStatus.error:
                logger.error("AssemblyAI error: %s", transcript.error)
                return ""

            return transcript.text or ""
        except Exception as exc:
            logger.error("AssemblyAI transcription failed: %s", exc)
            return ""

    @classmethod
    def from_env(cls) -> "AssemblyAIService":
        """Create AssemblyAIService from environment variables."""
        return cls()


class OpenAIAudioService:
    """
    OpenAI GPT-4o-audio wrapper for multi-ASR voting.

    Research: Highest accuracy for Australian accent, but slower.
    Cost: ~$0.02/min (2x Deepgram).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        sample_rate: int = 16000,
        channels: int = 1,
        model: Optional[str] = None,
    ):
        """
        Initialize OpenAI Audio service.

        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.sample_rate = sample_rate
        self.channels = channels
        self.model = model or os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe")
        self.enabled = bool(self.api_key)
        if not self.enabled:
            logger.warning("OpenAIAudioService disabled (OPENAI_API_KEY missing)")

    async def transcribe(self, audio_bytes: bytes) -> str:
        """
        Transcribe audio to text using GPT-4o-audio.

        Args:
            audio_bytes: Raw audio data (16kHz, PCM16)

        Returns:
            Transcribed text (empty string if not configured)
        """
        if not self.enabled:
            return ""

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.api_key)
            wav_bytes = _pcm_to_wav_bytes(
                audio_bytes, sample_rate=self.sample_rate, channels=self.channels
            )
            audio_file = io.BytesIO(wav_bytes)
            audio_file.name = "audio.wav"

            transcript = await client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language="en",
            )
            return transcript.text or ""
        except Exception as exc:
            logger.error("OpenAI Audio transcription failed: %s", exc)
            return ""

    @classmethod
    def from_env(cls) -> "OpenAIAudioService":
        """Create OpenAIAudioService from environment variables."""
        return cls()
