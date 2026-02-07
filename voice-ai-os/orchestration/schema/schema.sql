-- SpotFunnel Voice AI Platform - Orchestration Layer Database Schema
-- Layer 2: Orchestration Service
-- Following three-layer architecture principles

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TENANTS TABLE
-- =============================================================================
-- Represents customers (multi-tenant isolation)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  config JSONB DEFAULT '{}', -- Tenant-level configuration metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC);

-- =============================================================================
-- CONFIGS TABLE
-- =============================================================================
-- Versioned tenant configurations (declarative objective graphs)
-- Following R-ARCH-003: Objectives MUST Be Declarative
-- Following D-ARCH-006: Configuration Schema is Versioned and Validated
CREATE TABLE configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  yaml_content TEXT NOT NULL, -- Raw YAML configuration content
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Immutability: tenant_id + version must be unique
  UNIQUE(tenant_id, version)
);

-- Indexes
CREATE INDEX idx_configs_tenant_id ON configs(tenant_id);
CREATE INDEX idx_configs_version ON configs(version);
CREATE INDEX idx_configs_created_at ON configs(created_at DESC);

-- =============================================================================
-- CALLS TABLE
-- =============================================================================
-- Call logs and metadata
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL, -- Links to events table
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX idx_calls_conversation_id ON calls(conversation_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);

-- =============================================================================
-- CALL LOGS TABLE
-- =============================================================================
-- Customer dashboard call logs and captured data
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  outcome VARCHAR(50) NOT NULL CHECK (
    outcome IN ('lead_captured', 'callback_requested', 'faq_resolved', 'escalated', 'failed', 'in_progress')
  ),
  transcript TEXT NOT NULL DEFAULT '',
  captured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_action BOOLEAN NOT NULL DEFAULT FALSE,
  priority VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, call_id)
);

-- Indexes
CREATE INDEX idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX idx_call_logs_start_time ON call_logs(start_time DESC);
CREATE INDEX idx_call_logs_outcome ON call_logs(outcome);
CREATE INDEX idx_call_logs_requires_action ON call_logs(requires_action);

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================
-- Conversation metadata (links to events via trace_id)
-- Following production-observability patterns
CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trace_id UUID NOT NULL UNIQUE, -- Correlation ID for entire conversation
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed', 'aborted')) DEFAULT 'in_progress'
);

-- Indexes
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_trace_id ON conversations(trace_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
-- Append-only event stream (Event Sourcing)
-- Following D-ARCH-009: Orchestration Layer is Stateless (Event-Sourced)
-- Following D-ARCH-007: Event Schema is Immutable (Append-Only)
-- Following production-observability patterns: trace_id, sequence_number for ordering
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL, -- Groups events by conversation
  trace_id UUID NOT NULL, -- Correlation ID (same for entire conversation)
  sequence_number INTEGER NOT NULL, -- Monotonically increasing within conversation
  event_type VARCHAR(100) NOT NULL, -- e.g., "objective_started", "objective_completed"
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  payload JSONB NOT NULL, -- Event-specific data payload (PII-sanitized)
  metadata JSONB DEFAULT '{}' -- Component, agent_version, etc.
);

-- Indexes for event queries and replay
CREATE INDEX idx_events_conversation_id ON events(conversation_id, sequence_number ASC);
CREATE INDEX idx_events_trace_id ON events(trace_id, sequence_number ASC);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_tenant_id ON events(tenant_id);

-- Unique constraint: trace_id + sequence_number ensures ordering
CREATE UNIQUE INDEX idx_events_trace_sequence ON events(trace_id, sequence_number);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active tenants with latest configuration
CREATE VIEW active_tenants_with_config AS
SELECT 
  t.id,
  t.name,
  t.config,
  t.created_at,
  c.id as config_id,
  c.version as config_version,
  c.yaml_content,
  c.created_at as config_created_at
FROM tenants t
LEFT JOIN LATERAL (
  SELECT * FROM configs 
  WHERE tenant_id = t.id 
  ORDER BY created_at DESC 
  LIMIT 1
) c ON true;

-- Call statistics by tenant
CREATE VIEW call_stats AS
SELECT 
  tenant_id,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_calls
FROM calls
GROUP BY tenant_id;

-- Event counts by type (for monitoring)
CREATE VIEW event_type_stats AS
SELECT 
  event_type,
  COUNT(*) as total_events,
  MAX(timestamp) as last_seen
FROM events
GROUP BY event_type
ORDER BY total_events DESC;
