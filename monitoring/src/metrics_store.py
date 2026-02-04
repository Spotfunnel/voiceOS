"""
Metrics Store - PostgreSQL time-series storage with TimescaleDB

Features:
- PostgreSQL time-series tables
- Aggregation queries (hourly/daily rollups)
- Retention policy (raw: 7 days, aggregated: 90 days)
- Efficient queries using TimescaleDB hypertables
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
import asyncpg
from dataclasses import asdict

from .metrics_collector import (
    LatencyMetric, CostMetric, HealthMetric, CallQualityMetric
)

logger = logging.getLogger(__name__)


class MetricsStore:
    """
    PostgreSQL metrics store with TimescaleDB for time-series data
    
    Handles:
    - Latency metrics (P50/P95/P99 percentiles)
    - Cost metrics (per call, per tenant, per provider)
    - Health metrics (workers, circuit breakers, providers)
    - Call quality metrics (MOS, jitter, packet loss)
    """
    
    def __init__(self, database_url: str):
        """
        Initialize metrics store.
        
        Args:
            database_url: PostgreSQL connection string
        """
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self):
        """Create connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            logger.info("MetricsStore connected to PostgreSQL")
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("MetricsStore disconnected")
    
    async def insert_latency_metrics(self, metrics: List[LatencyMetric]):
        """Insert latency metrics (batch)"""
        if not metrics:
            return
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO metrics_latency (
                        trace_id, conversation_id, tenant_id, objective_id,
                        component, latency_ms, provider, model, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT DO NOTHING
                    """,
                    [
                        (
                            m.trace_id,
                            m.conversation_id,
                            m.tenant_id,
                            m.objective_id,
                            m.component,
                            m.latency_ms,
                            m.provider,
                            m.model,
                            m.timestamp
                        )
                        for m in metrics
                    ]
                )
    
    async def insert_cost_metrics(self, metrics: List[CostMetric]):
        """Insert cost metrics (batch)"""
        if not metrics:
            return
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO metrics_cost (
                        trace_id, conversation_id, tenant_id,
                        provider, service_type, usage_amount, usage_unit,
                        cost_usd, rate_per_unit, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    """,
                    [
                        (
                            m.trace_id,
                            m.conversation_id,
                            m.tenant_id,
                            m.provider,
                            m.service_type,
                            m.usage_amount,
                            m.usage_unit,
                            m.cost_usd,
                            m.rate_per_unit,
                            m.timestamp
                        )
                        for m in metrics
                    ]
                )
    
    async def insert_health_metrics(self, metrics: List[HealthMetric]):
        """Insert health metrics (batch)"""
        if not metrics:
            return
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    """
                    INSERT INTO metrics_health (
                        component, component_id, status, metrics,
                        circuit_state, failure_count, last_failure_at, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """,
                    [
                        (
                            m.component,
                            m.component_id,
                            m.status,
                            m.metrics if isinstance(m.metrics, dict) else {},
                            m.circuit_state,
                            m.failure_count,
                            m.last_failure_at,
                            m.timestamp
                        )
                        for m in metrics
                    ]
                )
    
    async def insert_call_quality_metrics(self, metrics: List[CallQualityMetric]):
        """Insert call quality metrics"""
        if not metrics:
            return
        
        # Note: Call quality metrics may need a separate table or be stored in metrics_health
        # For now, we'll store them in a JSONB field in metrics_health
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for m in metrics:
                    await conn.execute(
                        """
                        INSERT INTO metrics_health (
                            component, component_id, status, metrics, timestamp
                        ) VALUES ($1, $2, $3, $4, $5)
                        """,
                        'call_quality',
                        m.trace_id,
                        'healthy',  # Default status
                        {
                            'mos_score': m.mos_score,
                            'jitter_ms': m.jitter_ms,
                            'packet_loss_percent': m.packet_loss_percent,
                        },
                        m.timestamp
                    )
    
    async def get_latency_percentiles(
        self,
        tenant_id: Optional[str] = None,
        component: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get latency percentiles (P50/P95/P99)
        
        Args:
            tenant_id: Optional tenant filter
            component: Optional component filter ('stt', 'llm', 'tts', 'turn_e2e')
            start_time: Start time (default: 1 hour ago)
            end_time: End time (default: now)
        
        Returns:
            Dict with p50, p95, p99, sample_count
        """
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)
        
        query = """
            SELECT
                percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99,
                COUNT(*) AS sample_count
            FROM metrics_latency
            WHERE timestamp >= $1 AND timestamp <= $2
        """
        params = [start_time, end_time]
        
        if tenant_id:
            query += " AND tenant_id = $" + str(len(params) + 1)
            params.append(tenant_id)
        
        if component:
            query += " AND component = $" + str(len(params) + 1)
            params.append(component)
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            if row:
                return {
                    'p50': float(row['p50']) if row['p50'] else 0.0,
                    'p95': float(row['p95']) if row['p95'] else 0.0,
                    'p99': float(row['p99']) if row['p99'] else 0.0,
                    'sample_count': int(row['sample_count']) if row['sample_count'] else 0,
                }
            return {'p50': 0.0, 'p95': 0.0, 'p99': 0.0, 'sample_count': 0}
    
    async def get_latency_time_series(
        self,
        tenant_id: Optional[str] = None,
        component: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        bucket_minutes: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get latency time series with percentiles
        
        Args:
            tenant_id: Optional tenant filter
            component: Optional component filter
            start_time: Start time
            end_time: End time
            bucket_minutes: Time bucket size in minutes
        
        Returns:
            List of dicts with bucket, p50, p95, p99, sample_count
        """
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)
        
        query = f"""
            SELECT
                time_bucket('{bucket_minutes} minutes', timestamp) AS bucket,
                percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99,
                COUNT(*) AS sample_count
            FROM metrics_latency
            WHERE timestamp >= $1 AND timestamp <= $2
        """
        params = [start_time, end_time]
        
        if tenant_id:
            query += " AND tenant_id = $" + str(len(params) + 1)
            params.append(tenant_id)
        
        if component:
            query += " AND component = $" + str(len(params) + 1)
            params.append(component)
        
        query += " GROUP BY bucket ORDER BY bucket"
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [
                {
                    'bucket': row['bucket'].isoformat() if row['bucket'] else None,
                    'p50': float(row['p50']) if row['p50'] else 0.0,
                    'p95': float(row['p95']) if row['p95'] else 0.0,
                    'p99': float(row['p99']) if row['p99'] else 0.0,
                    'sample_count': int(row['sample_count']) if row['sample_count'] else 0,
                }
                for row in rows
            ]
    
    async def get_cost_per_call(self, trace_id: str) -> Dict[str, Any]:
        """
        Get cost breakdown for a specific call
        
        Args:
            trace_id: Trace ID for the call
        
        Returns:
            Dict with total_cost, breakdown by provider/service
        """
        async with self.pool.acquire() as conn:
            # Get total cost
            total_row = await conn.fetchrow(
                """
                SELECT SUM(cost_usd) AS total_cost
                FROM metrics_cost
                WHERE trace_id = $1
                """,
                trace_id
            )
            total_cost = float(total_row['total_cost']) if total_row and total_row['total_cost'] else 0.0
            
            # Get breakdown by provider/service
            breakdown_rows = await conn.fetch(
                """
                SELECT
                    provider,
                    service_type,
                    SUM(cost_usd) AS cost,
                    SUM(usage_amount) AS usage,
                    MAX(usage_unit) AS unit
                FROM metrics_cost
                WHERE trace_id = $1
                GROUP BY provider, service_type
                """,
                trace_id
            )
            
            breakdown = {}
            for row in breakdown_rows:
                provider = row['provider']
                service_type = row['service_type']
                key = f"{provider}_{service_type}"
                breakdown[key] = {
                    'provider': provider,
                    'service_type': service_type,
                    'cost_usd': float(row['cost']) if row['cost'] else 0.0,
                    'usage': float(row['usage']) if row['usage'] else 0.0,
                    'unit': row['unit']
                }
            
            return {
                'trace_id': trace_id,
                'total_cost_usd': total_cost,
                'breakdown': breakdown
            }
    
    async def get_cost_trends(
        self,
        tenant_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        bucket_hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get cost trends over time
        
        Args:
            tenant_id: Optional tenant filter
            start_time: Start time
            end_time: End time
            bucket_hours: Time bucket size in hours
        
        Returns:
            List of dicts with bucket, total_cost, breakdown
        """
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(days=7)
        if not end_time:
            end_time = datetime.now(timezone.utc)
        
        query = f"""
            SELECT
                time_bucket('{bucket_hours} hours', timestamp) AS bucket,
                SUM(cost_usd) AS total_cost,
                jsonb_object_agg(
                    provider || '_' || service_type,
                    jsonb_build_object(
                        'cost', SUM(cost_usd),
                        'usage', SUM(usage_amount),
                        'unit', MAX(usage_unit)
                    )
                ) AS breakdown
            FROM metrics_cost
            WHERE timestamp >= $1 AND timestamp <= $2
        """
        params = [start_time, end_time]
        
        if tenant_id:
            query += " AND tenant_id = $" + str(len(params) + 1)
            params.append(tenant_id)
        
        query += " GROUP BY bucket ORDER BY bucket"
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [
                {
                    'bucket': row['bucket'].isoformat() if row['bucket'] else None,
                    'total_cost_usd': float(row['total_cost']) if row['total_cost'] else 0.0,
                    'breakdown': dict(row['breakdown']) if row['breakdown'] else {},
                }
                for row in rows
            ]
    
    async def get_health_status(
        self,
        component: Optional[str] = None,
        component_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get current health status
        
        Args:
            component: Optional component filter ('worker', 'circuit_breaker', 'provider')
            component_id: Optional component ID filter
        
        Returns:
            List of health status dicts
        """
        query = """
            SELECT DISTINCT ON (component, component_id)
                component, component_id, status, metrics,
                circuit_state, failure_count, last_failure_at, timestamp
            FROM metrics_health
        """
        params = []
        conditions = []
        
        if component:
            conditions.append(f"component = ${len(params) + 1}")
            params.append(component)
        
        if component_id:
            conditions.append(f"component_id = ${len(params) + 1}")
            params.append(component_id)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY component, component_id, timestamp DESC"
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [
                {
                    'component': row['component'],
                    'component_id': row['component_id'],
                    'status': row['status'],
                    'metrics': dict(row['metrics']) if row['metrics'] else {},
                    'circuit_state': row['circuit_state'],
                    'failure_count': row['failure_count'],
                    'last_failure_at': row['last_failure_at'].isoformat() if row['last_failure_at'] else None,
                    'timestamp': row['timestamp'].isoformat() if row['timestamp'] else None,
                }
                for row in rows
            ]
    
    async def get_call_metrics(
        self,
        tenant_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get call metrics (volume, success rate, failure reasons)
        
        Args:
            tenant_id: Optional tenant filter
            start_time: Start time
            end_time: End time
        
        Returns:
            Dict with total_calls, success_rate, failure_reasons, etc.
        """
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)
        
        query = """
            SELECT
                COUNT(*) AS total_calls,
                COUNT(*) FILTER (WHERE status = 'success') AS successful_calls,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed_calls,
                COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned_calls,
                jsonb_object_agg(
                    failure_reason,
                    COUNT(*)
                ) FILTER (WHERE failure_reason IS NOT NULL) AS failure_reasons
            FROM metrics_calls
            WHERE timestamp >= $1 AND timestamp <= $2
        """
        params = [start_time, end_time]
        
        if tenant_id:
            query += " AND tenant_id = $" + str(len(params) + 1)
            params.append(tenant_id)
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            if row:
                total_calls = int(row['total_calls']) if row['total_calls'] else 0
                successful_calls = int(row['successful_calls']) if row['successful_calls'] else 0
                
                return {
                    'total_calls': total_calls,
                    'successful_calls': successful_calls,
                    'failed_calls': int(row['failed_calls']) if row['failed_calls'] else 0,
                    'abandoned_calls': int(row['abandoned_calls']) if row['abandoned_calls'] else 0,
                    'success_rate': (successful_calls / total_calls) if total_calls > 0 else 0.0,
                    'failure_reasons': dict(row['failure_reasons']) if row['failure_reasons'] else {},
                }
            return {
                'total_calls': 0,
                'successful_calls': 0,
                'failed_calls': 0,
                'abandoned_calls': 0,
                'success_rate': 0.0,
                'failure_reasons': {},
            }
