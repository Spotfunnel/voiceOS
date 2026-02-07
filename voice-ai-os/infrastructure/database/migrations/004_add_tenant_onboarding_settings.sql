-- Per-tenant onboarding settings
CREATE TABLE IF NOT EXISTS tenant_onboarding_settings (
  tenant_id UUID PRIMARY KEY,
  system_prompt TEXT,
  knowledge_base TEXT,
  n8n_workflows JSONB NOT NULL DEFAULT '[]'::jsonb,
  dashboard_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  dashboard_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  pipeline_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  dashboard_report_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  telephony JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
