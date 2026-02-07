-- =============================================================================
-- MIGRATION 010: Call Logs Table (Dashboard + Analytics)
-- =============================================================================
-- Purpose: Persist per-call summaries, outcomes, and internal cost tracking
-- Date: 2026-02-07
-- =============================================================================

CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id VARCHAR(255) UNIQUE NOT NULL,
  call_sid VARCHAR(255),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(conversation_id),

  -- Call metadata
  caller_phone VARCHAR(30),
  direction VARCHAR(20) DEFAULT 'inbound',
  status VARCHAR(50),

  -- Timing
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Content
  transcript TEXT,
  summary TEXT,

  -- Captured data
  reason_for_calling VARCHAR(255),
  outcome VARCHAR(255),
  captured_data JSONB DEFAULT '{}',

  -- Action tracking
  requires_action BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20),
  resolved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  -- Internal cost tracking
  stt_cost_usd NUMERIC(10, 6),
  llm_cost_usd NUMERIC(10, 6),
  tts_cost_usd NUMERIC(10, 6),
  total_cost_usd NUMERIC(10, 6),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_started ON call_logs(tenant_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_requires_action ON call_logs(tenant_id, requires_action) WHERE requires_action = TRUE;
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_phone ON call_logs(caller_phone);

-- Keep updated_at current
CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
