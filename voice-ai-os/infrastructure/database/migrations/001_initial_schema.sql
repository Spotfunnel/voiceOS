-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for Voice AI Platform
-- Created: Day 1 Foundation
-- 
-- This migration creates all core tables, indexes, views, functions, and triggers
-- for the event-sourced Voice AI platform architecture.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TENANTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL, -- For routing (cached in Redis)
  state VARCHAR(3) NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  timezone VARCHAR(50) NOT NULL DEFAULT 'Australia/Sydney',
  locale VARCHAR(10) DEFAULT 'en-AU' NOT NULL,
  config_version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_phone_number ON tenants(phone_number);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- =============================================================================
-- OBJECTIVE CONFIGURATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS objective_configs (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  objective_graph JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  schema_version VARCHAR(10) DEFAULT 'v1' NOT NULL,
  created_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_objective_configs_tenant_id ON objective_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_objective_configs_active ON objective_configs(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_objective_configs_created_at ON objective_configs(created_at DESC);

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  trace_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20),
  direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(20) CHECK (status IN ('in_progress', 'completed', 'failed')),
  termination_reason VARCHAR(100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_trace_id ON conversations(trace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_phone_number ON conversations(phone_number);

-- =============================================================================
-- EVENTS TABLE (Append-only, optimized for high write throughput)
-- =============================================================================
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_version VARCHAR(10) DEFAULT 'v1' NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(trace_id, sequence_number)
);

-- CRITICAL INDEXES FOR HIGH WRITE THROUGHPUT
CREATE INDEX IF NOT EXISTS idx_events_trace_id_sequence ON events(trace_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_events_tenant_id_timestamp ON events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

-- =============================================================================
-- OBJECTIVES TABLE (Caching table, reconstructable from events)
-- =============================================================================
CREATE TABLE IF NOT EXISTS objectives (
  objective_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  objective_type VARCHAR(50) NOT NULL,
  state VARCHAR(20) NOT NULL CHECK (state IN ('PENDING', 'ELICITING', 'VALIDATING', 'CONFIRMING', 'COMPLETED', 'FAILED')),
  captured_data JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_objectives_conversation_id ON objectives(conversation_id);
CREATE INDEX IF NOT EXISTS idx_objectives_state ON objectives(state);

-- =============================================================================
-- VIEWS
-- =============================================================================
CREATE OR REPLACE VIEW active_tenants AS
SELECT 
  t.tenant_id,
  t.business_name,
  t.phone_number,
  t.state,
  t.timezone,
  t.locale,
  t.config_version,
  c.objective_graph,
  c.schema_version,
  t.created_at
FROM tenants t
LEFT JOIN objective_configs c ON t.tenant_id = c.tenant_id AND c.active = true
WHERE t.status = 'active';

CREATE OR REPLACE VIEW conversation_stats_30d AS
SELECT 
  tenant_id,
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_conversations,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_conversations,
  AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration_seconds
FROM conversations
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id;

CREATE OR REPLACE VIEW event_type_stats AS
SELECT 
  event_type,
  event_version,
  COUNT(*) as total_events,
  MAX(timestamp) as last_seen
FROM events
GROUP BY event_type, event_version
ORDER BY total_events DESC;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION get_next_sequence_number(
  p_trace_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_max_sequence INTEGER;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) INTO v_max_sequence
  FROM events
  WHERE trace_id = p_trace_id;
  
  RETURN v_max_sequence + 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION emit_event(
  p_trace_id UUID,
  p_tenant_id UUID,
  p_event_type VARCHAR,
  p_payload JSONB,
  p_event_version VARCHAR DEFAULT 'v1'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_sequence_number INTEGER;
BEGIN
  v_sequence_number := get_next_sequence_number(p_trace_id);
  
  INSERT INTO events (trace_id, tenant_id, sequence_number, event_type, event_version, payload)
  VALUES (p_trace_id, p_tenant_id, v_sequence_number, p_event_type, p_event_version, p_payload)
  RETURNING event_id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_conversation_events(
  p_trace_id UUID
) RETURNS TABLE (
  event_id UUID,
  event_type VARCHAR,
  payload JSONB,
  sequence_number INTEGER,
  event_timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.event_id, e.event_type, e.payload, e.sequence_number, e.timestamp as event_timestamp
  FROM events e
  WHERE e.trace_id = p_trace_id
  ORDER BY e.sequence_number ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
