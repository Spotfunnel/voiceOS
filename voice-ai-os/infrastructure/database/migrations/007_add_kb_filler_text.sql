-- Migration: Add filler text per knowledge base
-- Created: 2026-02-07

ALTER TABLE tenant_knowledge_bases
ADD COLUMN IF NOT EXISTS filler_text TEXT DEFAULT 'Let me look that up for you.';

COMMENT ON COLUMN tenant_knowledge_bases.filler_text IS 'Short filler sentence spoken when this KB is queried';
