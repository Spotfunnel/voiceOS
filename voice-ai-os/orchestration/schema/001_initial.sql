-- Migration: 001_initial.sql
-- Description: Initial database schema for Orchestration Layer (Layer 2)
-- Created: 2026-02-03
-- 
-- This migration creates the foundational tables for the SpotFunnel Voice AI
-- Orchestration service following event-sourced, stateless architecture.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TENANTS TABLE
-- =============================================================================
-- Represents customers (multi-tenant isolation)
-- Following R-ARCH-016: Multi-Tenant Isolation
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  config JSONB DEFAULT '{}', -- Tenant-level configuration metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for tenants
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

-- Indexes for configs
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

-- Indexes for calls
CREATE INDEX idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX idx_calls_conversation_id ON calls(conversation_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
-- Append-only event stream (Event Sourcing)
-- Following D-ARCH-009: Orchestration Layer is Stateless (Event-Sourced)
-- Following D-ARCH-007: Event Schema is Immutable (Append-Only)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL, -- Groups events by conversation
  event_type VARCHAR(100) NOT NULL, -- e.g., "objective_started", "objective_completed"
  data JSONB NOT NULL, -- Event-specific data payload
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for event queries and replay
CREATE INDEX idx_events_conversation_id ON events(conversation_id, timestamp DESC);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);

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
