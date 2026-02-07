-- SpotFunnel Voice AI Platform - Database Schema
-- V1 Schema (Event-Sourced Architecture)
-- Following ARCHITECTURE_LAWS.md principles:
-- - Event sourcing (append-only events)
-- - Immutable configurations (versioned)
-- - Multi-tenant isolation
-- - Trace IDs for correlation
-- - Sub-100ms phone → tenant routing

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TENANTS TABLE
-- =============================================================================
-- Represents customers (Australian home service businesses)
-- Each tenant has isolated configuration and call data

CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL, -- For routing (cached in Redis)
  state VARCHAR(3) NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  timezone VARCHAR(50) NOT NULL DEFAULT 'Australia/Sydney', -- For datetime display
  locale VARCHAR(10) DEFAULT 'en-AU' NOT NULL,
  config_version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata JSONB DEFAULT '{}', -- Additional tenant metadata (billing info, contact, etc.)
  system_prompt TEXT, -- Layer 2: business-specific instructions
  agent_role VARCHAR(50) DEFAULT 'receptionist',
  agent_personality VARCHAR(50) DEFAULT 'friendly',
  greeting_message TEXT,
  static_knowledge TEXT, -- Tier 1: Pre-loaded knowledge (FAQ, company info, max 10K tokens)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for tenant lookups
CREATE INDEX idx_tenants_phone_number ON tenants(phone_number);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC);

COMMENT ON COLUMN tenants.static_knowledge IS
'Tier 1 pre-loaded static knowledge (FAQ, company info, policies). Max 10K tokens. Loaded into system prompt for zero-latency retrieval.';

-- =============================================================================
-- OBJECTIVE CONFIGURATIONS TABLE
-- =============================================================================
-- Versioned, immutable tenant configurations
-- Following R-ARCH-002: Immutable configurations (never updated, only new versions created)
-- Following D-ARCH-006: Configuration schema is versioned and validated

CREATE TABLE objective_configs (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  objective_graph JSONB NOT NULL, -- DAG of objectives (declarative configuration)
  active BOOLEAN DEFAULT true,
  schema_version VARCHAR(10) DEFAULT 'v1' NOT NULL, -- Config schema version
  
  -- Audit fields
  created_by VARCHAR(255), -- User who created this configuration
  notes TEXT, -- Change notes / deployment notes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Immutability constraint: combination of tenant_id + version must be unique
  UNIQUE(tenant_id, version)
);

-- Indexes for configuration lookups
CREATE INDEX idx_objective_configs_tenant_id ON objective_configs(tenant_id);
CREATE INDEX idx_objective_configs_active ON objective_configs(active) WHERE active = true;
CREATE INDEX idx_objective_configs_created_at ON objective_configs(created_at DESC);

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================
-- Conversation logs and metadata
-- Each conversation belongs to a tenant and has a unique trace_id for correlation

CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  trace_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(), -- For event correlation
  
  -- Call metadata
  phone_number VARCHAR(20), -- Caller's phone number
  direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
  
  -- Conversation status
  status VARCHAR(20) CHECK (status IN ('in_progress', 'completed', 'failed')),
  termination_reason VARCHAR(100), -- Why conversation ended (user_hangup, system_error, objective_completed, etc.)
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Media
  recording_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for conversation queries
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id, started_at DESC);
CREATE INDEX idx_conversations_trace_id ON conversations(trace_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_phone_number ON conversations(phone_number);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
-- Append-only event stream (Event Sourcing)
-- Following R-ARCH-009: Voice Core MUST emit events for observability
-- Following D-ARCH-007: Event schema is immutable (append-only)
-- Following D-ARCH-009: Orchestration layer is stateless (event-sourced)
-- CRITICAL: Events are NEVER updated or deleted (append-only)

CREATE TABLE events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id UUID NOT NULL, -- Links to conversation (for correlation)
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL, -- Monotonic ordering within conversation
  
  -- Event metadata
  event_type VARCHAR(50) NOT NULL, -- e.g., "objective_started", "objective_completed", "user_spoke"
  event_version VARCHAR(10) DEFAULT 'v1' NOT NULL, -- Event schema version (immutable)
  
  -- Event payload (MUST be sanitized for PII)
  payload JSONB NOT NULL, -- Event-specific data (sanitized, no plain-text PII)
  
  -- Timestamp (UTC, immutable)
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Unique constraint: trace_id + sequence_number must be unique (prevents duplicate events)
  UNIQUE(trace_id, sequence_number)
);

-- Indexes for event queries (optimized for conversation replay)
CREATE INDEX idx_events_trace_id ON events(trace_id, sequence_number);
CREATE INDEX idx_events_tenant_id ON events(tenant_id, timestamp DESC);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);

-- =============================================================================
-- OBJECTIVES TABLE
-- =============================================================================
-- Objective execution state (reconstructable from events)
-- Tracks state of objectives within conversations

CREATE TABLE objectives (
  objective_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  objective_type VARCHAR(50) NOT NULL, -- e.g., "capture_email_au", "capture_phone_au"
  state VARCHAR(20) NOT NULL CHECK (state IN ('PENDING', 'ELICITING', 'VALIDATING', 'CONFIRMING', 'COMPLETED', 'FAILED')),
  
  -- Captured data (sanitized)
  captured_data JSONB,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for objective queries
CREATE INDEX idx_objectives_conversation_id ON objectives(conversation_id);
CREATE INDEX idx_objectives_state ON objectives(state);

-- =============================================================================
-- N8N WORKFLOW CONFIGURATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS n8n_workflows (
    workflow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    workflow_name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    auth_token TEXT,
    timeout_seconds INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_n8n_workflows_tenant ON n8n_workflows(tenant_id);

CREATE TABLE IF NOT EXISTS n8n_workflow_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES n8n_workflows(workflow_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    call_id UUID,
    triggered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status TEXT NOT NULL,
    response_data JSONB,
    error_message TEXT
);

CREATE INDEX idx_n8n_logs_tenant_time ON n8n_workflow_logs(tenant_id, triggered_at);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active tenants with current configuration
CREATE VIEW active_tenants AS
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

-- Conversation statistics by tenant (last 30 days)
CREATE VIEW conversation_stats_30d AS
SELECT 
  tenant_id,
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_conversations,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_conversations,
  AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration_seconds
FROM conversations
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id;

-- Event counts by type (for monitoring)
CREATE VIEW event_type_stats AS
SELECT 
  event_type,
  event_version,
  COUNT(*) as total_events,
  MAX(timestamp) as last_seen
FROM events
GROUP BY event_type, event_version
ORDER BY total_events DESC;

-- =============================================================================
-- FUNCTIONS FOR EVENT SOURCING
-- =============================================================================

-- Function to get next sequence number for a trace_id
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

-- Function to emit an event (called by application)
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
  -- Get next sequence number for this trace_id
  v_sequence_number := get_next_sequence_number(p_trace_id);
  
  -- Insert event (append-only)
  INSERT INTO events (trace_id, tenant_id, sequence_number, event_type, event_version, payload)
  VALUES (p_trace_id, p_tenant_id, v_sequence_number, p_event_type, p_event_version, p_payload)
  RETURNING event_id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversation events (for replay)
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

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DATA (for development/testing)
-- =============================================================================

-- Example tenant
INSERT INTO tenants (id, name, locale, phone_number, config_version)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Plumbing Solutions AU',
  'en-AU',
  '+61400123456',
  'v1.0.0'
);

-- Example configuration
INSERT INTO configs (id, tenant_id, version, schema_version, objectives, locale, status)
VALUES (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'v1.0.0',
  'v1',
  '{
    "objectives": [
      {
        "id": "capture_contact",
        "type": "capture_email_au",
        "purpose": "appointment_confirmation",
        "required": true,
        "on_success": "next"
      },
      {
        "id": "capture_phone",
        "type": "capture_phone_au",
        "purpose": "callback",
        "required": true,
        "on_success": "next"
      }
    ]
  }'::jsonb,
  'en-AU',
  'active'
);

-- Example phone routing entry
INSERT INTO phone_routing (phone_number, tenant_id)
VALUES (
  '+61400123456',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
);

-- =============================================================================
-- ADMIN CONTROL PANEL TABLES (PHASE 8B)
-- =============================================================================

CREATE TABLE IF NOT EXISTS config_versions (
  version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'tenant')),
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  change_description TEXT,
  is_current BOOLEAN DEFAULT TRUE,
  diff_from_previous TEXT
);

CREATE INDEX IF NOT EXISTS idx_config_versions_section ON config_versions(section, is_current);
CREATE INDEX IF NOT EXISTS idx_config_versions_tenant ON config_versions(tenant_id);

CREATE TABLE IF NOT EXISTS config_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL,
  version_id UUID REFERENCES config_versions(version_id),
  tenant_id UUID REFERENCES tenants(id),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON config_audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_section ON config_audit_log(section, timestamp DESC);

CREATE TABLE IF NOT EXISTS tenant_caps (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  soft_cap_minutes INT NOT NULL DEFAULT 1000,
  hard_cap_minutes INT NOT NULL DEFAULT 1200,
  minutes_used INT DEFAULT 0,
  cap_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overage_allowed BOOLEAN DEFAULT FALSE,
  alert_threshold_percent INT DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS system_errors (
  error_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  call_id VARCHAR(255),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  event_trail JSONB,
  explanation TEXT,
  suggested_action TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_errors_tenant ON system_errors(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_severity ON system_errors(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON system_errors(resolved, timestamp DESC);

CREATE TABLE IF NOT EXISTS call_reasons (
  call_id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  reason VARCHAR(50) NOT NULL,
  sub_reason VARCHAR(100),
  confidence FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_reasons_tenant ON call_reasons(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_call_reasons_reason ON call_reasons(reason, timestamp DESC);
