import pytest

from pipecat.frames.frames import AudioRawFrame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection

from src.processors.multi_asr_processor import MultiASRProcessor


class FakeASRService:
    def __init__(self, text: str):
        self.text = text

    async def transcribe(self, audio_bytes: bytes) -> str:
        return self.text


class CapturingMultiASR(MultiASRProcessor):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.captured = []

    async def push_frame(self, frame, direction):
        self.captured.append(frame)


@pytest.mark.asyncio
async def test_multi_asr_emits_transcription_on_flush():
    processor = CapturingMultiASR(
        deepgram_batch=FakeASRService("hello"),
        assemblyai=FakeASRService("hello there"),
        openai_audio=FakeASRService("hi"),
    )
    processor.enable_multi_asr()

    # Force immediate flush by manipulating buffer thresholds
    processor.sample_rate = 1
    processor.channels = 1
    processor.bytes_per_sample = 1
    processor.max_buffer_duration_ms = 1

    frame = AudioRawFrame(audio=b"ab", sample_rate=1, num_channels=1)
    await processor.process_frame(frame, FrameDirection.DOWNSTREAM)

    assert any(isinstance(f, TranscriptionFrame) for f in processor.captured)
    transcript = next(
        f.text for f in processor.captured if isinstance(f, TranscriptionFrame)
    )
    assert transcript == "hello there"
