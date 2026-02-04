/**
 * Configuration Model - Layer 2: Orchestration
 * 
 * Customer configuration is declarative and versioned.
 * Following R-ARCH-010: Onboarding MUST Be Configuration-Only
 */

import { Objective, ObjectiveGraph } from './objective.model.js';

/**
 * Locale support (R-ARCH-008)
 * V1: Australian-first, architecture supports expansion
 */
export enum Locale {
  EN_AU = 'en-AU',
  // V2 locales (not implemented in V1):
  // EN_US = 'en-US',
  // EN_GB = 'en-GB'
}

/**
 * Configuration schema version
 * D-ARCH-006: Configuration Schema is Versioned and Validated
 */
export const CONFIG_SCHEMA_VERSION = 'v1' as const;

/**
 * Tenant configuration (multi-tenant isolation)
 * Following R-ARCH-016: Multi-Tenant Isolation
 */
export interface TenantConfig {
  /** Unique tenant identifier */
  tenant_id: string;
  
  /** Human-readable tenant name */
  tenant_name: string;
  
  /** Locale for this tenant */
  locale: Locale;
  
  /** Configuration schema version */
  schema_version: typeof CONFIG_SCHEMA_VERSION;
  
  /** Objective graph (DAG) */
  objectives: Objective[];
  
  /** Workflow webhook URL (Layer 3 integration) */
  workflow_webhook_url?: string;
  
  /** Configuration metadata */
  metadata?: {
    created_at: Date;
    updated_at: Date;
    created_by: string;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Event schema (immutable, append-only)
 * D-ARCH-007: Event Schema is Immutable (Append-Only)
 */
export const EVENT_VERSION = 'v1' as const;

/**
 * Event types emitted by orchestration layer
 * Following R-ARCH-009: Voice Core MUST Emit Events for Observability
 */
export enum EventType {
  // Objective lifecycle events
  OBJECTIVE_STARTED = 'objective_started',
  OBJECTIVE_COMPLETED = 'objective_completed',
  OBJECTIVE_FAILED = 'objective_failed',
  OBJECTIVE_SKIPPED = 'objective_skipped',
  
  // Conversation lifecycle events
  CONVERSATION_STARTED = 'conversation_started',
  CONVERSATION_ENDED = 'conversation_ended',
  
  // Configuration events
  CONFIG_LOADED = 'config_loaded',
  CONFIG_VALIDATION_FAILED = 'config_validation_failed'
}

/**
 * Base event structure (immutable)
 * Following production-observability patterns: trace_id, sequence_number for ordering
 */
export interface BaseEvent {
  /** Unique event identifier */
  event_id: string;
  
  /** Event type */
  event_type: EventType;
  
  /** Event schema version */
  event_version: typeof EVENT_VERSION;
  
  /** Trace ID (correlation ID for entire conversation) */
  trace_id: string;
  
  /** Sequence number (monotonically increasing within conversation) */
  sequence_number: number;
  
  /** Tenant identifier */
  tenant_id: string;
  
  /** Conversation identifier */
  conversation_id: string;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Event payload (type-specific, PII-sanitized before storage) */
  data: Record<string, unknown>;
  
  /** Metadata (component, agent_version, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Objective completed event payload
 */
export interface ObjectiveCompletedEvent extends BaseEvent {
  event_type: EventType.OBJECTIVE_COMPLETED;
  data: {
    objective_id: string;
    objective_type: string;
    captured_data: Record<string, unknown>;
    attempts: number;
  };
}

/**
 * Objective failed event payload
 */
export interface ObjectiveFailedEvent extends BaseEvent {
  event_type: EventType.OBJECTIVE_FAILED;
  data: {
    objective_id: string;
    objective_type: string;
    error_code: string;
    error_message: string;
    attempts: number;
  };
}
