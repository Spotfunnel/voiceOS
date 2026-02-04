"""
Multi-ASR voting processor for Australian accent optimization.

Flow:
1. Receive AudioRawFrame
2. If multi-ASR enabled: call multiple ASR services in parallel
3. Rank candidates (placeholder until LLM ranking is wired)
4. Emit TranscriptionFrame with best candidate
5. If multi-ASR fails, fall back to downstream STT
"""

import asyncio
import logging
import os
import time
from typing import Optional, List

from pipecat.frames.frames import Frame, AudioRawFrame, TranscriptionFrame, EndFrame
from pipecat.processors.frame_processor import FrameProcessor

from ..events.event_emitter import EventEmitter
from ..services.asr_services import (
    AssemblyAIService,
    OpenAIAudioService,
    DeepgramBatchService,
)

logger = logging.getLogger(__name__)


class MultiASRProcessor(FrameProcessor):
    """
    Multi-ASR voting processor with conditional activation.

    - Enabled: When active primitive requires multi-ASR (email, phone)
    - Disabled: Pass audio through to downstream STT (single ASR fast path)
    """

    def __init__(
        self,
        deepgram_batch: Optional[DeepgramBatchService] = None,
        assemblyai: Optional[AssemblyAIService] = None,
        openai_audio: Optional[OpenAIAudioService] = None,
        event_emitter: Optional[EventEmitter] = None,
    ):
        super().__init__()
        self.deepgram_batch = deepgram_batch or DeepgramBatchService.from_env()
        self.assemblyai = assemblyai or AssemblyAIService.from_env()
        self.openai_audio = openai_audio or OpenAIAudioService.from_env()
        self.event_emitter = event_emitter
        self.multi_asr_enabled = False
        self.vote_count = 0
        self.audio_buffer = bytearray()
        self.buffer_start_time: Optional[float] = None
        self.last_audio_time: Optional[float] = None
        self.last_direction = None
        self.silence_task: Optional[asyncio.Task] = None
        self.sample_rate = int(os.getenv("MULTI_ASR_SAMPLE_RATE", "16000"))
        self.channels = int(os.getenv("MULTI_ASR_CHANNELS", "1"))
        self.bytes_per_sample = int(os.getenv("MULTI_ASR_BYTES_PER_SAMPLE", "2"))
        self.max_buffer_duration_ms = int(
            os.getenv("MULTI_ASR_MAX_BUFFER_MS", "5000")
        )
        self.silence_timeout_ms = int(
            os.getenv("MULTI_ASR_SILENCE_TIMEOUT_MS", "1000")
        )

        logger.info("MultiASRProcessor initialized (conditional activation)")

    def enable_multi_asr(self) -> None:
        """Enable multi-ASR voting (for critical primitives)."""
        self.multi_asr_enabled = True
        logger.debug("Multi-ASR voting ENABLED")

    def disable_multi_asr(self) -> None:
        """Disable multi-ASR voting (fall back to downstream STT)."""
        self.multi_asr_enabled = False
        self._reset_buffer()
        logger.debug("Multi-ASR voting DISABLED (single ASR fast path)")

    async def process_frame(self, frame: Frame, direction):
        if isinstance(frame, AudioRawFrame):
            if not self.multi_asr_enabled:
                await self.push_frame(frame, direction)
                return

            if hasattr(frame, "sample_rate"):
                self.sample_rate = frame.sample_rate
            if hasattr(frame, "num_channels"):
                self.channels = frame.num_channels
            if self.deepgram_batch:
                self.deepgram_batch.sample_rate = self.sample_rate
                self.deepgram_batch.channels = self.channels
            if self.assemblyai:
                self.assemblyai.sample_rate = self.sample_rate
                self.assemblyai.channels = self.channels
            if self.openai_audio:
                self.openai_audio.sample_rate = self.sample_rate
                self.openai_audio.channels = self.channels

            self._buffer_audio(frame.audio, direction)
            if self._buffer_duration_ms() >= self.max_buffer_duration_ms:
                await self._flush_buffer(direction)
            return

        if isinstance(frame, EndFrame):
            if self.multi_asr_enabled:
                await self._flush_buffer(direction)
            await self.push_frame(frame, direction)
            return

        await self.push_frame(frame, direction)

    def _buffer_audio(self, audio_bytes: bytes, direction) -> None:
        if self.buffer_start_time is None:
            self.buffer_start_time = time.time()
        self.last_audio_time = time.time()
        self.last_direction = direction
        self.audio_buffer.extend(audio_bytes)
        self._ensure_silence_task()

    def _buffer_duration_ms(self) -> float:
        bytes_per_second = self.sample_rate * self.channels * self.bytes_per_sample
        if bytes_per_second == 0:
            return 0.0
        return (len(self.audio_buffer) / bytes_per_second) * 1000.0

    def _ensure_silence_task(self) -> None:
        if self.silence_task and not self.silence_task.done():
            return
        self.silence_task = asyncio.create_task(self._silence_watchdog())

    async def _silence_watchdog(self) -> None:
        while self.audio_buffer:
            await asyncio.sleep(self.silence_timeout_ms / 1000.0)
            if not self.last_audio_time:
                continue
            elapsed = (time.time() - self.last_audio_time) * 1000.0
            if elapsed >= self.silence_timeout_ms:
                await self._flush_buffer(self.last_direction)
                return

    async def _flush_buffer(self, direction) -> None:
        if not self.audio_buffer:
            return
        audio_bytes = bytes(self.audio_buffer)
        self._reset_buffer()

        transcript = await self._multi_asr_transcribe(audio_bytes)
        if transcript:
            transcription_frame = TranscriptionFrame(
                text=transcript,
                user_id="user",
                timestamp=None,
            )
            transcription_frame.multi_asr_used = True
            await self._emit_vote_event(transcript)
            await self.push_frame(transcription_frame, direction)
            return

        logger.warning("Multi-ASR failed; falling back to downstream STT")
        await self.push_frame(
            AudioRawFrame(
                audio=audio_bytes,
                sample_rate=self.sample_rate,
                num_channels=self.channels,
            ),
            direction,
        )

    def _reset_buffer(self) -> None:
        self.audio_buffer.clear()
        self.buffer_start_time = None
        self.last_audio_time = None
        self.last_direction = None
        if self.silence_task and not self.silence_task.done():
            self.silence_task.cancel()

    async def _multi_asr_transcribe(self, audio_bytes: bytes) -> str:
        try:
            results = await asyncio.gather(
                self.deepgram_batch.transcribe(audio_bytes),
                self.assemblyai.transcribe(audio_bytes),
                self.openai_audio.transcribe(audio_bytes),
                return_exceptions=True,
            )

            candidates = self._filter_candidates(results)
            if not candidates:
                return ""

            if len(candidates) == 1:
                return candidates[0]

            best = await self._rank_candidates(candidates)
            self.vote_count += 1
            return best
        except Exception as exc:
            logger.error("Multi-ASR voting failed: %s", exc)
            return ""

    @staticmethod
    def _filter_candidates(results: List[object]) -> List[str]:
        candidates: List[str] = []
        for result in results:
            if isinstance(result, Exception):
                continue
            if isinstance(result, str) and result.strip():
                candidates.append(result.strip())
        return candidates

    async def _rank_candidates(self, candidates: List[str]) -> str:
        if len(candidates) == 1:
            return candidates[0]

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return max(candidates, key=len)

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key)
            candidates_text = "\n".join(
                f"{index + 1}. {candidate}" for index, candidate in enumerate(candidates)
            )
            prompt = (
                "Given these transcriptions of Australian English speech, "
                "which is most likely correct?\n\n"
                f"{candidates_text}\n\n"
                "Consider Australian pronunciation patterns. "
                "Return ONLY the number (1, 2, or 3) of the best transcription."
            )
            response = await client.chat.completions.create(
                model=os.getenv("OPENAI_RANKER_MODEL", "gpt-4o-mini"),
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in Australian English transcription.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
                max_tokens=10,
            )
            choice_text = response.choices[0].message.content.strip()
            choice_num = int(choice_text)
            if 1 <= choice_num <= len(candidates):
                return candidates[choice_num - 1]
        except Exception as exc:
            logger.error("LLM ranking failed: %s", exc)

        return max(candidates, key=len)

    async def _emit_vote_event(self, transcript: str) -> None:
        if not self.event_emitter:
            return
        await self.event_emitter.emit(
            "multi_asr_vote",
            data={
                "vote_count": self.vote_count,
                "transcript": transcript,
            },
        )

    @classmethod
    def from_env(
        cls,
        event_emitter: Optional[EventEmitter] = None,
    ) -> "MultiASRProcessor":
        return cls(
            deepgram_batch=DeepgramBatchService.from_env(),
            assemblyai=AssemblyAIService.from_env(),
            openai_audio=OpenAIAudioService.from_env(),
            event_emitter=event_emitter,
        )
