-- Migration: Add support for multiple named knowledge bases per tenant
-- Created: 2026-02-07

-- Table to store multiple knowledge bases per tenant
CREATE TABLE IF NOT EXISTS tenant_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Index for quick lookup by tenant
CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_bases_tenant_id ON tenant_knowledge_bases(tenant_id);

-- Index for name lookup within tenant
CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_bases_tenant_name ON tenant_knowledge_bases(tenant_id, name);

COMMENT ON TABLE tenant_knowledge_bases IS 'Multiple named knowledge bases per tenant for dynamic retrieval';
COMMENT ON COLUMN tenant_knowledge_bases.name IS 'Display name for this knowledge base (e.g., "FAQs", "Product A Troubleshooting")';
COMMENT ON COLUMN tenant_knowledge_bases.description IS 'When the AI should query this KB (e.g., "Use for common questions about hours, services, pricing")';
COMMENT ON COLUMN tenant_knowledge_bases.content IS 'Knowledge base content in markdown or plain text format';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_knowledge_base_timestamp ON tenant_knowledge_bases;
CREATE TRIGGER trigger_update_knowledge_base_timestamp
    BEFORE UPDATE ON tenant_knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_updated_at();
