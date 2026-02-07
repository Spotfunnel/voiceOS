-- Migration: Add call history summaries per tenant
-- Created: 2026-02-07

CREATE TABLE IF NOT EXISTS call_history (
    call_history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    caller_phone VARCHAR(30),
    summary TEXT NOT NULL,
    outcome VARCHAR(100),
    conversation_id UUID,
    call_sid VARCHAR(64),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_history_tenant_phone_time
    ON call_history(tenant_id, caller_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_history_tenant_time
    ON call_history(tenant_id, created_at DESC);

COMMENT ON TABLE call_history IS 'Recent call summaries per tenant and caller phone number';
COMMENT ON COLUMN call_history.summary IS 'Short summary of the call for future context';
