-- =============================================================================
-- MIGRATION 011: System Errors Table
-- =============================================================================
-- Purpose: Structured error tracking for admin quality dashboard
-- Date: 2026-02-07
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_errors (
  error_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  call_id VARCHAR(255),
  error_type VARCHAR(100),
  error_message TEXT,
  stack_trace TEXT,
  severity VARCHAR(20),
  context JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_errors_tenant ON system_errors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_severity ON system_errors(severity);
CREATE INDEX IF NOT EXISTS idx_system_errors_created ON system_errors(created_at DESC);
