"""
Tests for Voice Core pipeline
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from voice_core.pipeline import VoicePipeline


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Mock environment variables"""
    monkeypatch.setenv("DEEPGRAM_API_KEY", "test_deepgram_key")
    monkeypatch.setenv("OPENAI_API_KEY", "test_openai_key")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test_elevenlabs_key")


@pytest.fixture
def pipeline(mock_env_vars):
    """Create pipeline instance for testing"""
    return VoicePipeline(
        daily_room_url="https://test.daily.co/test-room",
        daily_token="test_token",
    )


@pytest.mark.asyncio
async def test_pipeline_initialization(pipeline):
    """Test pipeline initialization"""
    assert pipeline.daily_room_url == "https://test.daily.co/test-room"
    assert pipeline.daily_token == "test_token"
    assert pipeline.deepgram_api_key == "test_deepgram_key"
    assert pipeline.openai_api_key == "test_openai_key"
    assert pipeline.elevenlabs_api_key == "test_elevenlabs_key"


@pytest.mark.asyncio
async def test_pipeline_missing_api_keys():
    """Test pipeline raises error when API keys are missing"""
    with pytest.raises(ValueError, match="Deepgram API key required"):
        VoicePipeline(
            daily_room_url="https://test.daily.co/test-room",
            daily_token="test_token",
            deepgram_api_key=None,
        )


@pytest.mark.asyncio
async def test_build_pipeline(pipeline):
    """Test pipeline building"""
    with patch("voice_core.pipeline.DailyTransportWrapper") as mock_transport_wrapper, \
         patch("voice_core.pipeline.DeepgramSTTService") as mock_stt, \
         patch("voice_core.pipeline.OpenAILLMService") as mock_llm, \
         patch("voice_core.pipeline.ElevenLabsTTSService") as mock_tts, \
         patch("voice_core.pipeline.LLMResponseAggregator") as mock_agg, \
         patch("voice_core.pipeline.Pipeline") as mock_pipeline_class:
        
        mock_pipeline_instance = MagicMock()
        mock_pipeline_class.return_value = mock_pipeline_instance
        
        # Mock transport wrapper
        mock_transport_instance = MagicMock()
        mock_transport_instance.transport = MagicMock()
        mock_transport_instance.transport.input = MagicMock(return_value=MagicMock())
        mock_transport_instance.transport.output = MagicMock(return_value=MagicMock())
        mock_transport_wrapper.return_value = mock_transport_instance
        
        result = pipeline.build_pipeline()
        
        assert result == mock_pipeline_instance
        mock_pipeline_class.assert_called_once()
        mock_transport_wrapper.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_start(pipeline):
    """Test pipeline start"""
    with patch.object(pipeline, "build_pipeline") as mock_build, \
         patch("voice_core.pipeline.PipelineTask") as mock_task_class, \
         patch("voice_core.pipeline.PipelineRunner") as mock_runner_class:
        
        mock_pipeline = MagicMock()
        mock_build.return_value = mock_pipeline
        
        mock_task = MagicMock()
        mock_task_class.return_value = mock_task
        
        mock_runner = AsyncMock()
        mock_runner.run = AsyncMock()
        mock_runner_class.return_value = mock_runner
        
        await pipeline.start()
        
        mock_build.assert_called_once()
        mock_task_class.assert_called_once_with(mock_pipeline)
        mock_runner.run.assert_called_once_with(mock_task)
        assert pipeline.task == mock_task
        assert pipeline.runner == mock_runner


@pytest.mark.asyncio
async def test_pipeline_stop(pipeline):
    """Test pipeline stop"""
    pipeline.task = AsyncMock()
    pipeline.runner = AsyncMock()
    pipeline.runner.cancel = AsyncMock()
    
    await pipeline.stop()
    
    pipeline.task.queue_frames.assert_called_once()
    pipeline.runner.cancel.assert_called_once()


