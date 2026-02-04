-- =============================================================================
-- TIMESCALEDB METRICS SCHEMA
-- =============================================================================
-- Production monitoring tables for Voice AI platform
-- Uses TimescaleDB hypertables for efficient time-series queries

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- LATENCY METRICS TABLE
-- =============================================================================
-- Tracks component-level and end-to-end latency metrics
-- P50/P95/P99 percentiles calculated via TimescaleDB continuous aggregates

CREATE TABLE IF NOT EXISTS metrics_latency (
  trace_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  objective_id UUID, -- Optional: track latency per objective
  
  -- Component identification
  component VARCHAR(50) NOT NULL, -- 'stt', 'llm', 'tts', 'turn_e2e', 'network'
  
  -- Latency measurement (milliseconds)
  latency_ms INTEGER NOT NULL,
  
  -- Additional context
  provider VARCHAR(50), -- e.g., 'deepgram', 'openai', 'cartesia'
  model VARCHAR(100), -- e.g., 'gpt-4o', 'sonic-3'
  
  -- Timestamp (UTC)
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Convert to hypertable (partitioned by time)
SELECT create_hypertable('metrics_latency', 'timestamp', 
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_latency_trace_id ON metrics_latency(trace_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_latency_tenant_component ON metrics_latency(tenant_id, component, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_latency_conversation ON metrics_latency(conversation_id, timestamp DESC);

-- Continuous aggregate for P50/P95/P99 percentiles (5-minute buckets)
CREATE MATERIALIZED VIEW IF NOT EXISTS latency_percentiles_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', timestamp) AS bucket,
  tenant_id,
  component,
  provider,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99,
  COUNT(*) AS sample_count
FROM metrics_latency
GROUP BY bucket, tenant_id, component, provider;

-- Refresh policy: update every 1 minute
SELECT add_continuous_aggregate_policy('latency_percentiles_5m',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists => TRUE
);

-- =============================================================================
-- COST METRICS TABLE
-- =============================================================================
-- Tracks cost per call, per provider, per tenant
-- Costs calculated from usage metrics (STT minutes, LLM tokens, TTS characters)

CREATE TABLE IF NOT EXISTS metrics_cost (
  trace_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Provider and service type
  provider VARCHAR(50) NOT NULL, -- 'deepgram', 'openai', 'cartesia', 'elevenlabs'
  service_type VARCHAR(20) NOT NULL, -- 'stt', 'llm', 'tts'
  
  -- Usage metrics
  usage_amount DECIMAL(12, 4) NOT NULL, -- minutes (STT), tokens (LLM), characters (TTS)
  usage_unit VARCHAR(20) NOT NULL, -- 'minutes', 'tokens', 'characters'
  
  -- Cost calculation
  cost_usd DECIMAL(10, 6) NOT NULL, -- Cost in USD
  rate_per_unit DECIMAL(10, 6) NOT NULL, -- Rate used for calculation
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Convert to hypertable
SELECT create_hypertable('metrics_cost', 'timestamp',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_trace_id ON metrics_cost(trace_id);
CREATE INDEX IF NOT EXISTS idx_cost_tenant ON metrics_cost(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cost_conversation ON metrics_cost(conversation_id);

-- Continuous aggregate for cost per call (per conversation)
CREATE MATERIALIZED VIEW IF NOT EXISTS cost_per_call
WITH (timescaledb.continuous) AS
SELECT
  trace_id,
  conversation_id,
  tenant_id,
  time_bucket('1 minute', timestamp) AS bucket,
  SUM(cost_usd) AS total_cost_usd,
  COUNT(DISTINCT provider) AS provider_count,
  jsonb_object_agg(provider, jsonb_build_object(
    'cost', SUM(cost_usd),
    'usage', SUM(usage_amount),
    'unit', MAX(usage_unit)
  )) AS breakdown
FROM metrics_cost
GROUP BY trace_id, conversation_id, tenant_id, bucket;

-- Continuous aggregate for monthly cost per tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS cost_per_tenant_monthly
WITH (timescaledb.continuous) AS
SELECT
  tenant_id,
  time_bucket('1 month', timestamp) AS month,
  SUM(cost_usd) AS total_cost_usd,
  COUNT(DISTINCT conversation_id) AS call_count,
  AVG(cost_usd) AS avg_cost_per_call
FROM metrics_cost
GROUP BY tenant_id, month;

-- =============================================================================
-- HEALTH METRICS TABLE
-- =============================================================================
-- Tracks worker health, circuit breaker status, provider health

CREATE TABLE IF NOT EXISTS metrics_health (
  component VARCHAR(50) NOT NULL, -- 'worker', 'circuit_breaker', 'provider', 'database', 'redis'
  component_id VARCHAR(100), -- e.g., worker instance ID, provider name
  
  -- Health status
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'down')),
  
  -- Metrics (JSONB for flexibility)
  metrics JSONB, -- e.g., {'memory_percent': 65, 'cpu_percent': 45, 'active_calls': 12}
  
  -- Circuit breaker specific
  circuit_state VARCHAR(20), -- 'closed', 'open', 'half_open'
  failure_count INTEGER,
  last_failure_at TIMESTAMPTZ,
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Convert to hypertable
SELECT create_hypertable('metrics_health', 'timestamp',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_component ON metrics_health(component, component_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_status ON metrics_health(status, timestamp DESC);

-- =============================================================================
-- CALL METRICS TABLE
-- =============================================================================
-- Aggregated call-level metrics (success rate, failure reasons)

CREATE TABLE IF NOT EXISTS metrics_calls (
  trace_id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Call outcome
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'abandoned')),
  failure_reason VARCHAR(100), -- e.g., 'stt_timeout', 'llm_error', 'tts_failure'
  
  -- Duration metrics
  call_duration_seconds INTEGER,
  turn_count INTEGER,
  
  -- Quality metrics
  avg_confidence DECIMAL(5, 3), -- Average STT confidence
  interruption_count INTEGER,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calls_tenant_status ON metrics_calls(tenant_id, status, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calls_conversation ON metrics_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_calls_failure_reason ON metrics_calls(failure_reason) WHERE failure_reason IS NOT NULL;

-- =============================================================================
-- ALERT HISTORY TABLE
-- =============================================================================
-- Tracks alert firing history for deduplication

CREATE TABLE IF NOT EXISTS alert_history (
  alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type VARCHAR(50) NOT NULL, -- 'latency_p95', 'cost_threshold', 'circuit_breaker_open'
  alert_severity VARCHAR(20) NOT NULL CHECK (alert_severity IN ('critical', 'warning', 'info')),
  
  -- Alert context
  component VARCHAR(50),
  tenant_id UUID,
  trace_id UUID,
  
  -- Alert details
  message TEXT NOT NULL,
  metric_value DECIMAL(12, 4),
  threshold DECIMAL(12, 4),
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('firing', 'resolved', 'acknowledged')),
  
  -- Timestamps
  fired_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_type_status ON alert_history(alert_type, status, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_firing ON alert_history(status, fired_at DESC) WHERE status = 'firing';
