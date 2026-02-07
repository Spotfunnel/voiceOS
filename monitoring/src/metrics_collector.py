"""
Metrics Collector - Collects metrics from event stream with <5% overhead

Features:
- Latency tracking (P50/P95/P99 per component: STT, LLM, TTS, total)
- Cost per call (STT + LLM + TTS breakdown)
- Circuit breaker status (open/closed per provider)
- Call quality (MOS score, jitter, packet loss)
- Worker health (memory, CPU, active calls)

CRITICAL: Async collection with in-memory buffer to maintain <5% overhead
"""

import asyncio
import logging
import psutil
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from collections import defaultdict
import uuid

logger = logging.getLogger(__name__)


@dataclass
class LatencyMetric:
    """Latency metric for a component"""
    trace_id: str
    conversation_id: str
    tenant_id: str
    objective_id: Optional[str]
    component: str  # 'stt', 'llm', 'tts', 'turn_e2e', 'network'
    latency_ms: int
    provider: Optional[str]
    model: Optional[str]
    timestamp: datetime


@dataclass
class CostMetric:
    """Cost metric for a provider/service"""
    trace_id: str
    conversation_id: str
    tenant_id: str
    provider: str  # 'deepgram', 'openai', 'cartesia', 'elevenlabs'
    service_type: str  # 'stt', 'llm', 'tts'
    usage_amount: float
    usage_unit: str  # 'minutes', 'tokens', 'characters'
    cost_usd: float
    rate_per_unit: float
    timestamp: datetime


@dataclass
class HealthMetric:
    """Health metric for a component"""
    component: str  # 'worker', 'circuit_breaker', 'provider'
    component_id: Optional[str]
    status: str  # 'healthy', 'degraded', 'unhealthy', 'down'
    metrics: Dict[str, Any]
    circuit_state: Optional[str]  # 'closed', 'open', 'half_open'
    failure_count: Optional[int]
    last_failure_at: Optional[datetime]
    timestamp: datetime


@dataclass
class CallQualityMetric:
    """Call quality metrics"""
    trace_id: str
    conversation_id: str
    tenant_id: str
    mos_score: Optional[float]  # Mean Opinion Score (1-5)
    jitter_ms: Optional[float]
    packet_loss_percent: Optional[float]
    timestamp: datetime


# Provider cost rates (USD) - update based on actual pricing
PROVIDER_RATES: Dict[str, Dict[str, float]] = {
    # STT rates (per minute)
    'deepgram': {'stt': 0.0043},
    'assemblyai': {'stt': 0.00025},
    'gpt-4o-audio': {'stt': 0.006},
    
    # LLM rates (per 1K tokens)
    'openai': {
        'llm_input': 0.0025,  # GPT-4.1 input: $2.50/1M tokens (update if pricing changes)
        'llm_output': 0.01,   # GPT-4.1 output: $10/1M tokens (update if pricing changes)
    },
    
    # TTS rates (per character)
    'cartesia': {'tts': 0.00001},  # $0.01/1K characters
    'elevenlabs': {'tts': 0.00003},  # $0.03/1K characters
}


class MetricsCollector:
    """
    Async metrics collector with buffering for <5% overhead
    
    Collects metrics from events and buffers them for batch writes.
    Flushes every 5 seconds or when buffer reaches 100 items.
    """
    
    def __init__(self, metrics_store):
        """
        Initialize metrics collector.
        
        Args:
            metrics_store: MetricsStore instance for persistence
        """
        self.metrics_store = metrics_store
        
        # Buffers for batch writes
        self.latency_buffer: List[LatencyMetric] = []
        self.cost_buffer: List[CostMetric] = []
        self.health_buffer: List[HealthMetric] = []
        self.call_quality_buffer: List[CallQualityMetric] = []
        
        # Buffer configuration
        self.buffer_size = 100
        self.flush_interval_seconds = 5
        
        # Lock for thread-safe buffer operations
        self.lock = asyncio.Lock()
        
        # Background flush task
        self.flush_task: Optional[asyncio.Task] = None
        self.running = False
        
        # Worker health tracking
        self.worker_id = str(uuid.uuid4())[:8]
        self.active_calls = 0
        
    async def start(self):
        """Start background flush task"""
        self.running = True
        self.flush_task = asyncio.create_task(self._periodic_flush())
        logger.info(f"MetricsCollector started (worker_id={self.worker_id})")
    
    async def stop(self):
        """Stop collector and flush remaining metrics"""
        self.running = False
        if self.flush_task:
            self.flush_task.cancel()
            try:
                await self.flush_task
            except asyncio.CancelledError:
                pass
        
        # Final flush
        await self.flush_all()
        logger.info("MetricsCollector stopped")
    
    async def process_event(self, event: Dict[str, Any]):
        """
        Process event and extract metrics (async, non-blocking)
        
        Args:
            event: Event dict with event_type, trace_id, data, etc.
        """
        try:
            event_type = event.get('event_type', '')
            data = event.get('data', {})
            metadata = event.get('metadata', {})
            
            trace_id = event.get('trace_id', '')
            conversation_id = event.get('conversation_id', '')
            tenant_id = event.get('tenant_id', '')
            
            # Extract latency metrics
            await self._extract_latency_metrics(event_type, data, trace_id, conversation_id, tenant_id)
            
            # Extract cost metrics
            await self._extract_cost_metrics(event_type, data, trace_id, conversation_id, tenant_id)
            
            # Extract health metrics
            await self._extract_health_metrics(event_type, data, metadata)
            
            # Extract call quality metrics
            await self._extract_call_quality_metrics(event_type, data, trace_id, conversation_id, tenant_id)
            
            # Track active calls
            if event_type == 'call_started':
                self.active_calls += 1
            elif event_type == 'call_ended':
                self.active_calls = max(0, self.active_calls - 1)
                
        except Exception as e:
            logger.error(f"Error processing event {event.get('event_id', 'unknown')}: {e}", exc_info=True)
    
    async def _extract_latency_metrics(
        self, event_type: str, data: Dict[str, Any],
        trace_id: str, conversation_id: str, tenant_id: str
    ):
        """Extract latency metrics from event"""
        timestamp = datetime.now(timezone.utc)
        
        # Check for explicit latency field
        if 'latency_ms' in data:
            metric = LatencyMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                objective_id=data.get('objective_id'),
                component=data.get('component', 'turn_e2e'),
                latency_ms=int(data['latency_ms']),
                provider=data.get('provider'),
                model=data.get('model'),
                timestamp=timestamp
            )
            await self._buffer_latency(metric)
        
        # Extract component-specific latency from event types
        if event_type == 'stt_transcript_final' and 'latency_ms' in data:
            metric = LatencyMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                objective_id=None,
                component='stt',
                latency_ms=int(data['latency_ms']),
                provider=data.get('provider', 'deepgram'),
                model=None,
                timestamp=timestamp
            )
            await self._buffer_latency(metric)
        
        if event_type == 'llm_first_token' and 'ttft_ms' in data:
            metric = LatencyMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                objective_id=None,
                component='llm',
                latency_ms=int(data['ttft_ms']),
                provider='openai',
                model=data.get('model', 'gpt-4.1'),
                timestamp=timestamp
            )
            await self._buffer_latency(metric)
        
        if event_type == 'tts_first_byte' and 'ttfb_ms' in data:
            metric = LatencyMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                objective_id=None,
                component='tts',
                latency_ms=int(data['ttfb_ms']),
                provider=data.get('provider', 'cartesia'),
                model=data.get('model'),
                timestamp=timestamp
            )
            await self._buffer_latency(metric)
    
    async def _extract_cost_metrics(
        self, event_type: str, data: Dict[str, Any],
        trace_id: str, conversation_id: str, tenant_id: str
    ):
        """Extract cost metrics from event"""
        timestamp = datetime.now(timezone.utc)
        
        # STT cost (minutes)
        if event_type == 'stt_transcript_final' and 'duration_seconds' in data:
            provider = data.get('provider', 'deepgram')
            duration_seconds = float(data['duration_seconds'])
            minutes = duration_seconds / 60.0
            rate = PROVIDER_RATES.get(provider, {}).get('stt', 0.0043)
            cost = minutes * rate
            
            metric = CostMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                provider=provider,
                service_type='stt',
                usage_amount=minutes,
                usage_unit='minutes',
                cost_usd=cost,
                rate_per_unit=rate,
                timestamp=timestamp
            )
            await self._buffer_cost(metric)
        
        # LLM cost (tokens)
        if event_type == 'llm_completion':
            prompt_tokens = int(data.get('prompt_tokens', 0))
            completion_tokens = int(data.get('completion_tokens', 0))
            
            input_rate = PROVIDER_RATES.get('openai', {}).get('llm_input', 0.0025)
            output_rate = PROVIDER_RATES.get('openai', {}).get('llm_output', 0.01)
            
            # Input tokens
            if prompt_tokens > 0:
                metric = CostMetric(
                    trace_id=trace_id,
                    conversation_id=conversation_id,
                    tenant_id=tenant_id,
                    provider='openai',
                    service_type='llm',
                    usage_amount=prompt_tokens,
                    usage_unit='tokens',
                    cost_usd=(prompt_tokens / 1000.0) * input_rate,
                    rate_per_unit=input_rate,
                    timestamp=timestamp
                )
                await self._buffer_cost(metric)
            
            # Output tokens
            if completion_tokens > 0:
                metric = CostMetric(
                    trace_id=trace_id,
                    conversation_id=conversation_id,
                    tenant_id=tenant_id,
                    provider='openai',
                    service_type='llm',
                    usage_amount=completion_tokens,
                    usage_unit='tokens',
                    cost_usd=(completion_tokens / 1000.0) * output_rate,
                    rate_per_unit=output_rate,
                    timestamp=timestamp
                )
                await self._buffer_cost(metric)
        
        # TTS cost (characters)
        if event_type == 'tts_synthesis_complete' and 'character_count' in data:
            provider = data.get('provider', 'cartesia')
            characters = int(data['character_count'])
            rate = PROVIDER_RATES.get(provider, {}).get('tts', 0.00001)
            cost = (characters / 1000.0) * rate
            
            metric = CostMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                provider=provider,
                service_type='tts',
                usage_amount=characters,
                usage_unit='characters',
                cost_usd=cost,
                rate_per_unit=rate,
                timestamp=timestamp
            )
            await self._buffer_cost(metric)
    
    async def _extract_health_metrics(
        self, event_type: str, data: Dict[str, Any], metadata: Dict[str, Any]
    ):
        """Extract health metrics from event"""
        timestamp = datetime.now(timezone.utc)
        
        # Circuit breaker status
        if event_type == 'circuit_breaker_state_changed':
            metric = HealthMetric(
                component='circuit_breaker',
                component_id=data.get('provider'),
                status='unhealthy' if data.get('state') == 'open' else 'healthy',
                metrics={},
                circuit_state=data.get('state'),
                failure_count=data.get('failure_count'),
                last_failure_at=datetime.fromisoformat(data['last_failure_at'].replace('Z', '+00:00')) if data.get('last_failure_at') else None,
                timestamp=timestamp
            )
            await self._buffer_health(metric)
        
        # Worker health (periodic updates)
        if event_type == 'worker_health':
            metric = HealthMetric(
                component='worker',
                component_id=data.get('worker_id', self.worker_id),
                status=data.get('status', 'healthy'),
                metrics=data.get('metrics', {}),
                circuit_state=None,
                failure_count=None,
                last_failure_at=None,
                timestamp=timestamp
            )
            await self._buffer_health(metric)
        
        # Provider health
        if event_type == 'provider_health':
            metric = HealthMetric(
                component='provider',
                component_id=data.get('provider'),
                status=data.get('status', 'healthy'),
                metrics=data.get('metrics', {}),
                circuit_state=None,
                failure_count=None,
                last_failure_at=None,
                timestamp=timestamp
            )
            await self._buffer_health(metric)
    
    async def _extract_call_quality_metrics(
        self, event_type: str, data: Dict[str, Any],
        trace_id: str, conversation_id: str, tenant_id: str
    ):
        """Extract call quality metrics"""
        if event_type == 'call_quality_update':
            timestamp = datetime.now(timezone.utc)
            metric = CallQualityMetric(
                trace_id=trace_id,
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                mos_score=data.get('mos_score'),
                jitter_ms=data.get('jitter_ms'),
                packet_loss_percent=data.get('packet_loss_percent'),
                timestamp=timestamp
            )
            await self._buffer_call_quality(metric)
    
    async def collect_worker_health(self):
        """Collect current worker health metrics"""
        try:
            memory = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            timestamp = datetime.now(timezone.utc)
            metric = HealthMetric(
                component='worker',
                component_id=self.worker_id,
                status='healthy' if memory.percent < 80 else 'degraded' if memory.percent < 90 else 'unhealthy',
                metrics={
                    'memory_percent': memory.percent,
                    'cpu_percent': cpu_percent,
                    'active_calls': self.active_calls,
                    'memory_available_mb': memory.available / (1024 * 1024),
                },
                circuit_state=None,
                failure_count=None,
                last_failure_at=None,
                timestamp=timestamp
            )
            await self._buffer_health(metric)
        except Exception as e:
            logger.error(f"Error collecting worker health: {e}")
    
    async def _buffer_latency(self, metric: LatencyMetric):
        """Buffer latency metric"""
        async with self.lock:
            self.latency_buffer.append(metric)
            if len(self.latency_buffer) >= self.buffer_size:
                await self._flush_latency()
    
    async def _buffer_cost(self, metric: CostMetric):
        """Buffer cost metric"""
        async with self.lock:
            self.cost_buffer.append(metric)
            if len(self.cost_buffer) >= self.buffer_size:
                await self._flush_cost()
    
    async def _buffer_health(self, metric: HealthMetric):
        """Buffer health metric"""
        async with self.lock:
            self.health_buffer.append(metric)
            if len(self.health_buffer) >= self.buffer_size:
                await self._flush_health()
    
    async def _buffer_call_quality(self, metric: CallQualityMetric):
        """Buffer call quality metric"""
        async with self.lock:
            self.call_quality_buffer.append(metric)
            # Call quality metrics are less frequent, flush immediately
            await self._flush_call_quality()
    
    async def _flush_latency(self):
        """Flush latency metrics to store"""
        async with self.lock:
            if not self.latency_buffer:
                return
            metrics = self.latency_buffer[:self.buffer_size]
            self.latency_buffer = self.latency_buffer[self.buffer_size:]
        
        try:
            await self.metrics_store.insert_latency_metrics(metrics)
        except Exception as e:
            logger.error(f"Error flushing latency metrics: {e}")
            # Re-add to buffer for retry
            async with self.lock:
                self.latency_buffer = metrics + self.latency_buffer
    
    async def _flush_cost(self):
        """Flush cost metrics to store"""
        async with self.lock:
            if not self.cost_buffer:
                return
            metrics = self.cost_buffer[:self.buffer_size]
            self.cost_buffer = self.cost_buffer[self.buffer_size:]
        
        try:
            await self.metrics_store.insert_cost_metrics(metrics)
        except Exception as e:
            logger.error(f"Error flushing cost metrics: {e}")
            async with self.lock:
                self.cost_buffer = metrics + self.cost_buffer
    
    async def _flush_health(self):
        """Flush health metrics to store"""
        async with self.lock:
            if not self.health_buffer:
                return
            metrics = self.health_buffer[:self.buffer_size]
            self.health_buffer = self.health_buffer[self.buffer_size:]
        
        try:
            await self.metrics_store.insert_health_metrics(metrics)
        except Exception as e:
            logger.error(f"Error flushing health metrics: {e}")
            async with self.lock:
                self.health_buffer = metrics + self.health_buffer
    
    async def _flush_call_quality(self):
        """Flush call quality metrics to store"""
        async with self.lock:
            if not self.call_quality_buffer:
                return
            metrics = self.call_quality_buffer.copy()
            self.call_quality_buffer.clear()
        
        try:
            await self.metrics_store.insert_call_quality_metrics(metrics)
        except Exception as e:
            logger.error(f"Error flushing call quality metrics: {e}")
            async with self.lock:
                self.call_quality_buffer = metrics + self.call_quality_buffer
    
    async def _periodic_flush(self):
        """Periodic flush task (runs every flush_interval_seconds)"""
        while self.running:
            try:
                await asyncio.sleep(self.flush_interval_seconds)
                await self.flush_all()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic flush: {e}")
    
    async def flush_all(self):
        """Flush all buffers"""
        await asyncio.gather(
            self._flush_latency(),
            self._flush_cost(),
            self._flush_health(),
            self._flush_call_quality(),
            return_exceptions=True
        )
