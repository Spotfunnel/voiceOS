"""
Integration tests for TTS services (Cartesia, ElevenLabs, Multi-provider)

Tests:
- Cartesia TTS circuit breaker
- ElevenLabs TTS circuit breaker
- Multi-provider TTS automatic fallback
- Cost tracking
"""

import pytest
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tts.cartesia_tts import CartesiaTTSService, CircuitBreakerOpen as CartesiaCircuitBreakerOpen
from tts.elevenlabs_tts import ElevenLabsTTSService, CircuitBreakerOpen as ElevenLabsCircuitBreakerOpen
from tts.multi_provider_tts import MultiProviderTTS, AllTTSProvidersFailed
from pipecat.frames.frames import TextFrame, TTSAudioRawFrame


class TestCartesiaTTS:
    """Tests for Cartesia TTS service"""
    
    def test_initialization(self):
        """Test Cartesia TTS service initialization"""
        with patch.dict('os.environ', {'CARTESIA_API_KEY': 'test_key'}):
            tts = CartesiaTTSService(api_key="test_key")
            assert tts.api_key == "test_key"
            assert tts.failure_count == 0
            assert not tts.circuit_open
    
    def test_missing_api_key(self):
        """Test Cartesia TTS raises error when API key missing"""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError, match="CARTESIA_API_KEY must be set"):
                CartesiaTTSService()
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker opens after failure threshold"""
        with patch.dict('os.environ', {'CARTESIA_API_KEY': 'test_key'}):
            tts = CartesiaTTSService(api_key="test_key")
            
            # Mock service to raise exceptions
            async def mock_process_frame(frame):
                raise Exception("TTS service unavailable")
                yield  # Make it a generator
            
            tts.service.process_frame = mock_process_frame
            
            # Trigger failures up to threshold
            for i in range(5):
                with pytest.raises(Exception):
                    async for _ in tts.synthesize("test"):
                        pass
            
            # Circuit should be open now
            assert tts.is_circuit_open
            assert tts.failure_count >= 5
            
            # Next call should raise CircuitBreakerOpen
            with pytest.raises(CartesiaCircuitBreakerOpen):
                async for _ in tts.synthesize("test"):
                    pass
    
    def test_reset_circuit_breaker(self):
        """Test circuit breaker can be reset"""
        with patch.dict('os.environ', {'CARTESIA_API_KEY': 'test_key'}):
            tts = CartesiaTTSService(api_key="test_key")
            
            # Manually open circuit
            tts.circuit_open = True
            tts.failure_count = 5
            
            # Reset
            tts.reset_circuit_breaker()
            
            assert not tts.circuit_open
            assert tts.failure_count == 0


class TestElevenLabsTTS:
    """Tests for ElevenLabs TTS service"""
    
    def test_initialization(self):
        """Test ElevenLabs TTS service initialization"""
        with patch.dict('os.environ', {'ELEVENLABS_API_KEY': 'test_key'}):
            tts = ElevenLabsTTSService(api_key="test_key")
            assert tts.api_key == "test_key"
            assert tts.failure_count == 0
            assert not tts.circuit_open
    
    def test_missing_api_key(self):
        """Test ElevenLabs TTS raises error when API key missing"""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError, match="ELEVENLABS_API_KEY must be set"):
                ElevenLabsTTSService()


class TestMultiProviderTTS:
    """Tests for multi-provider TTS with automatic fallback"""
    
    @pytest.mark.asyncio
    async def test_uses_cartesia_primary(self):
        """Test multi-provider TTS uses Cartesia as primary"""
        with patch.dict('os.environ', {
            'CARTESIA_API_KEY': 'test_key',
            'ELEVENLABS_API_KEY': 'test_key'
        }):
            # Mock Cartesia to succeed
            cartesia = MagicMock(spec=CartesiaTTSService)
            
            async def mock_cartesia_synthesize(text):
                yield TTSAudioRawFrame(audio=b"test_audio", sample_rate=16000, num_channels=1)
            
            cartesia.synthesize = mock_cartesia_synthesize
            cartesia.is_circuit_open = False
            
            # Mock ElevenLabs (should not be called)
            elevenlabs = MagicMock(spec=ElevenLabsTTSService)
            
            # Create multi-provider TTS
            multi_tts = MultiProviderTTS(cartesia=cartesia, elevenlabs=elevenlabs)
            
            # Process text frame
            frame = TextFrame(text="Hello world")
            results = []
            async for output_frame in multi_tts.process_frame(frame):
                results.append(output_frame)
            
            # Verify Cartesia was used
            assert len(results) > 0
            assert multi_tts.provider_usage["cartesia"] == 1
            assert multi_tts.provider_usage["elevenlabs"] == 0
    
    @pytest.mark.asyncio
    async def test_falls_back_to_elevenlabs(self):
        """Test multi-provider TTS falls back to ElevenLabs when Cartesia fails"""
        with patch.dict('os.environ', {
            'CARTESIA_API_KEY': 'test_key',
            'ELEVENLABS_API_KEY': 'test_key'
        }):
            # Mock Cartesia to fail
            cartesia = MagicMock(spec=CartesiaTTSService)
            
            async def mock_cartesia_fail(text):
                raise Exception("Cartesia unavailable")
                yield  # Make it a generator
            
            cartesia.synthesize = mock_cartesia_fail
            cartesia.is_circuit_open = False
            
            # Mock ElevenLabs to succeed
            elevenlabs = MagicMock(spec=ElevenLabsTTSService)
            
            async def mock_elevenlabs_synthesize(text):
                yield TTSAudioRawFrame(audio=b"fallback_audio", sample_rate=16000, num_channels=1)
            
            elevenlabs.synthesize = mock_elevenlabs_synthesize
            elevenlabs.is_circuit_open = False
            
            # Create multi-provider TTS
            multi_tts = MultiProviderTTS(cartesia=cartesia, elevenlabs=elevenlabs)
            
            # Process text frame
            frame = TextFrame(text="Hello world")
            results = []
            async for output_frame in multi_tts.process_frame(frame):
                results.append(output_frame)
            
            # Verify ElevenLabs was used as fallback
            assert len(results) > 0
            assert multi_tts.provider_usage["cartesia"] == 0
            assert multi_tts.provider_usage["elevenlabs"] == 1
    
    @pytest.mark.asyncio
    async def test_raises_when_all_providers_fail(self):
        """Test multi-provider TTS raises AllTTSProvidersFailed when both fail"""
        with patch.dict('os.environ', {
            'CARTESIA_API_KEY': 'test_key',
            'ELEVENLABS_API_KEY': 'test_key'
        }):
            # Mock both to fail
            cartesia = MagicMock(spec=CartesiaTTSService)
            
            async def mock_fail(text):
                raise Exception("Unavailable")
                yield
            
            cartesia.synthesize = mock_fail
            cartesia.is_circuit_open = False
            
            elevenlabs = MagicMock(spec=ElevenLabsTTSService)
            elevenlabs.synthesize = mock_fail
            elevenlabs.is_circuit_open = False
            
            # Create multi-provider TTS
            multi_tts = MultiProviderTTS(cartesia=cartesia, elevenlabs=elevenlabs)
            
            # Process text frame - should raise
            frame = TextFrame(text="Hello world")
            
            with pytest.raises(AllTTSProvidersFailed):
                async for _ in multi_tts.process_frame(frame):
                    pass
    
    def test_cost_tracking(self):
        """Test multi-provider TTS tracks costs correctly"""
        with patch.dict('os.environ', {
            'CARTESIA_API_KEY': 'test_key',
            'ELEVENLABS_API_KEY': 'test_key'
        }):
            cartesia = MagicMock(spec=CartesiaTTSService)
            elevenlabs = MagicMock(spec=ElevenLabsTTSService)
            
            multi_tts = MultiProviderTTS(cartesia=cartesia, elevenlabs=elevenlabs)
            
            # Verify cost per char
            assert multi_tts.cost_per_char["cartesia"] == 0.000037
            assert multi_tts.cost_per_char["elevenlabs"] == 0.00020
            assert multi_tts.total_cost == 0.0
    
    def test_get_provider_stats(self):
        """Test provider statistics reporting"""
        with patch.dict('os.environ', {
            'CARTESIA_API_KEY': 'test_key',
            'ELEVENLABS_API_KEY': 'test_key'
        }):
            cartesia = MagicMock(spec=CartesiaTTSService)
            cartesia.is_circuit_open = False
            
            elevenlabs = MagicMock(spec=ElevenLabsTTSService)
            elevenlabs.is_circuit_open = False
            
            multi_tts = MultiProviderTTS(cartesia=cartesia, elevenlabs=elevenlabs)
            
            stats = multi_tts.get_provider_stats()
            
            assert "usage" in stats
            assert "total_cost" in stats
            assert "cartesia_circuit_open" in stats
            assert "elevenlabs_circuit_open" in stats
