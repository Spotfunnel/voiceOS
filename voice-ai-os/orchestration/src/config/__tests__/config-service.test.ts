/**
 * Config Service Tests - Layer 2: Orchestration
 * 
 * Tests for configuration validation (DAG check, schema validation)
 */

import { describe, it, expect } from 'vitest';
import { ConfigService } from '../config-service.js';
import type { TenantConfig } from '../../models/config.model.js';
import { Locale, CONFIG_SCHEMA_VERSION } from '../../models/config.model.js';
import { PrimitiveType, EscalationStrategy } from '../../models/objective.model.js';

describe('ConfigService', () => {
  const configService = new ConfigService();

  describe('Schema Validation', () => {
    it('should validate correct configuration', () => {
      const validConfig: TenantConfig = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'appointment_confirmation',
            required: true,
            max_retries: 3,
            on_success: 'capture_phone',
            escalation: EscalationStrategy.TRANSFER,
          },
          {
            id: 'capture_phone',
            type: PrimitiveType.CAPTURE_PHONE_AU,
            purpose: 'callback',
            required: true,
          },
        ],
      };

      const result = configService.validate(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with missing required fields', () => {
      const invalidConfig = {
        tenant_id: 'test_tenant',
        // Missing tenant_name, locale, schema_version, objectives
      };

      const result = configService.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject configuration with invalid primitive type', () => {
      const invalidConfig: Partial<TenantConfig> = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: 'invalid_primitive' as PrimitiveType,
            purpose: 'test',
            required: true,
          },
        ],
      };

      const result = configService.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('type'))).toBe(true);
    });

    it('should reject configuration with invalid schema version', () => {
      const invalidConfig: Partial<TenantConfig> = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: 'v2' as typeof CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'test',
            required: true,
          },
        ],
      };

      const result = configService.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('schema_version'))).toBe(true);
    });
  });

  describe('DAG Validation', () => {
    it('should validate acyclic objective graph', () => {
      const acyclicConfig: TenantConfig = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'test',
            required: true,
            on_success: 'capture_phone',
          },
          {
            id: 'capture_phone',
            type: PrimitiveType.CAPTURE_PHONE_AU,
            purpose: 'test',
            required: true,
            on_success: 'capture_address',
          },
          {
            id: 'capture_address',
            type: PrimitiveType.CAPTURE_ADDRESS_AU,
            purpose: 'test',
            required: true,
          },
        ],
      };

      const result = configService.validateDAG(acyclicConfig.objectives);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject cyclic objective graph', () => {
      const cyclicConfig: TenantConfig = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'test',
            required: true,
            on_success: 'capture_phone', // email -> phone
          },
          {
            id: 'capture_phone',
            type: PrimitiveType.CAPTURE_PHONE_AU,
            purpose: 'test',
            required: true,
            on_success: 'capture_email', // phone -> email (CYCLE!)
          },
        ],
      };

      const result = configService.validateDAG(cyclicConfig.objectives);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CYCLE_DETECTED')).toBe(true);
    });

    it('should validate graph with multiple roots', () => {
      const multiRootConfig: TenantConfig = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'test',
            required: true,
          },
          {
            id: 'capture_phone',
            type: PrimitiveType.CAPTURE_PHONE_AU,
            purpose: 'test',
            required: true,
          },
        ],
      };

      const result = configService.validateDAG(multiRootConfig.objectives);
      expect(result.valid).toBe(true);
    });

    it('should validate graph with on_failure transitions', () => {
      const configWithFailure: TenantConfig = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'test',
            required: true,
            on_success: 'capture_phone',
            on_failure: 'escalate',
          },
          {
            id: 'capture_phone',
            type: PrimitiveType.CAPTURE_PHONE_AU,
            purpose: 'test',
            required: true,
          },
          {
            id: 'escalate',
            type: PrimitiveType.GREETING_AU,
            purpose: 'test',
            required: false,
          },
        ],
      };

      const result = configService.validateDAG(configWithFailure.objectives);
      expect(result.valid).toBe(true);
    });
  });

  describe('buildObjectiveGraph', () => {
    it('should build objective graph from configuration', () => {
      const config: TenantConfig = {
        tenant_id: 'test_tenant',
        tenant_name: 'Test Tenant',
        locale: Locale.EN_AU,
        schema_version: CONFIG_SCHEMA_VERSION,
        objectives: [
          {
            id: 'capture_email',
            type: PrimitiveType.CAPTURE_EMAIL_AU,
            purpose: 'test',
            required: true,
            on_success: 'capture_phone',
          },
          {
            id: 'capture_phone',
            type: PrimitiveType.CAPTURE_PHONE_AU,
            purpose: 'test',
            required: true,
          },
        ],
      };

      const graph = configService.buildObjectiveGraph(config);
      expect(graph.root).toBe('capture_email');
      expect(graph.objectives).toHaveProperty('capture_email');
      expect(graph.objectives).toHaveProperty('capture_phone');
      expect(graph.objectives['capture_email'].on_success).toBe('capture_phone');
    });
  });
});
