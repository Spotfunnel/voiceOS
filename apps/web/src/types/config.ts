/**
 * Type definitions for Voice AI Objective Configuration
 * Based on voice-ai-os/orchestration/src/models/objective.model.ts
 */

export enum PrimitiveType {
  CAPTURE_EMAIL_AU = 'capture_email_au',
  CAPTURE_PHONE_AU = 'capture_phone_au',
  CAPTURE_ADDRESS_AU = 'capture_address_au',
  CAPTURE_NAME_AU = 'capture_name_au',
  CAPTURE_DATE_AU = 'capture_date_au',
  CAPTURE_TIME_AU = 'capture_time_au',
  CAPTURE_DATETIME_AU = 'capture_datetime_au',
  CAPTURE_SERVICE_TYPE = 'capture_service_type',
  CAPTURE_PREFERRED_DATETIME = 'capture_preferred_datetime',
}

export enum EscalationStrategy {
  TRANSFER = 'transfer',
  SKIP = 'skip',
  RETRY = 'retry',
  ABORT = 'abort',
}

export enum Locale {
  EN_AU = 'en-AU',
  EN_US = 'en-US',
  EN_GB = 'en-GB',
}

export interface Objective {
  id: string;
  type: PrimitiveType;
  version?: string;
  purpose: string;
  required: boolean;
  max_retries?: number;
  on_success?: string;
  on_failure?: string;
  escalation?: EscalationStrategy;
  metadata?: Record<string, unknown>;
}

export interface TenantConfig {
  tenant_id: string;
  tenant_name: string;
  locale: Locale;
  schema_version: string;
  objectives: Objective[];
  workflow_webhook_url?: string;
  metadata?: {
    created_at?: string;
    updated_at?: string;
    created_by?: string;
  };
}

export interface ObjectiveTemplate {
  id: string;
  name: string;
  description: string;
  example: string;
  type: PrimitiveType;
  defaultPurpose: string;
  defaultRequired: boolean;
  defaultMaxRetries: number;
}
