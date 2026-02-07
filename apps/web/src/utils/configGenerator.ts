/**
 * YAML Config Generator
 * Converts UI state → YAML config
 * Validates DAG (no cycles)
 * Validates required fields
 */

import * as yaml from 'js-yaml';
import type { TenantConfig, Objective } from '@/types/config';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate that objective graph is a DAG (no cycles)
 */
function validateDAG(objectives: Objective[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(objectiveId: string): boolean {
    if (recursionStack.has(objectiveId)) {
      return true; // Cycle detected
    }
    if (visited.has(objectiveId)) {
      return false; // Already processed
    }

    visited.add(objectiveId);
    recursionStack.add(objectiveId);

    const objective = objectives.find((obj) => obj.id === objectiveId);
    if (!objective) {
      recursionStack.delete(objectiveId);
      return false;
    }

    // Check on_success path
    if (objective.on_success && objective.on_success !== 'end_call') {
      if (hasCycle(objective.on_success)) {
        errors.push({
          field: `objectives[${objectives.indexOf(objective)}].on_success`,
          message: `Cycle detected: ${objectiveId} → ${objective.on_success}`,
        });
        recursionStack.delete(objectiveId);
        return true;
      }
    }

    // Check on_failure path
    if (objective.on_failure && objective.on_failure !== 'end_call') {
      if (hasCycle(objective.on_failure)) {
        errors.push({
          field: `objectives[${objectives.indexOf(objective)}].on_failure`,
          message: `Cycle detected: ${objectiveId} → ${objective.on_failure}`,
        });
        recursionStack.delete(objectiveId);
        return true;
      }
    }

    recursionStack.delete(objectiveId);
    return false;
  }

  // Check all objectives for cycles
  objectives.forEach((obj) => {
    if (!visited.has(obj.id)) {
      hasCycle(obj.id);
    }
  });

  return errors;
}

/**
 * Validate that all referenced objectives exist
 */
function validateReferences(objectives: Objective[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const objectiveIds = new Set(objectives.map((obj) => obj.id));

  objectives.forEach((objective, index) => {
    if (objective.on_success && objective.on_success !== 'end_call') {
      if (!objectiveIds.has(objective.on_success)) {
        errors.push({
          field: `objectives[${index}].on_success`,
          message: `Referenced objective "${objective.on_success}" does not exist`,
        });
      }
    }

    if (objective.on_failure && objective.on_failure !== 'end_call') {
      if (!objectiveIds.has(objective.on_failure)) {
        errors.push({
          field: `objectives[${index}].on_failure`,
          message: `Referenced objective "${objective.on_failure}" does not exist`,
        });
      }
    }
  });

  return errors;
}

/**
 * Validate configuration
 */
export function validateConfig(config: TenantConfig): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate required fields
  if (!config.tenant_id || config.tenant_id.trim() === '') {
    errors.push({ field: 'tenant_id', message: 'Tenant ID is required' });
  }

  if (!config.tenant_name || config.tenant_name.trim() === '') {
    errors.push({ field: 'tenant_name', message: 'Tenant name is required' });
  }

  if (!config.locale) {
    errors.push({ field: 'locale', message: 'Locale is required' });
  }

  if (!config.objectives || config.objectives.length === 0) {
    errors.push({ field: 'objectives', message: 'At least one objective is required' });
  }

  // Validate objectives
  config.objectives?.forEach((objective, index) => {
    if (!objective.id || objective.id.trim() === '') {
      errors.push({
        field: `objectives[${index}].id`,
        message: 'Objective ID is required',
      });
    }

    if (!objective.type) {
      errors.push({
        field: `objectives[${index}].type`,
        message: 'Objective type is required',
      });
    }

    if (!objective.purpose || objective.purpose.trim() === '') {
      errors.push({
        field: `objectives[${index}].purpose`,
        message: 'Purpose is required',
      });
    }

    if (objective.max_retries !== undefined && objective.max_retries < 1) {
      errors.push({
        field: `objectives[${index}].max_retries`,
        message: 'Max retries must be at least 1',
      });
    }
  });

  // Validate DAG (no cycles)
  if (config.objectives && config.objectives.length > 0) {
    const dagErrors = validateDAG(config.objectives);
    errors.push(...dagErrors);

    const refErrors = validateReferences(config.objectives);
    errors.push(...refErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate YAML config from TenantConfig
 */
export function generateYAML(config: TenantConfig): string {
  // Clean up config for YAML generation
  const yamlConfig: any = {
    tenant_id: config.tenant_id,
    tenant_name: config.tenant_name,
    locale: config.locale,
    schema_version: config.schema_version || 'v1',
    objectives: config.objectives.map((obj) => {
      const yamlObj: any = {
        id: obj.id,
        type: obj.type,
        purpose: obj.purpose,
        required: obj.required,
      };

      if (obj.version) {
        yamlObj.version = obj.version;
      }

      if (obj.max_retries !== undefined) {
        yamlObj.max_retries = obj.max_retries;
      }

      if (obj.on_success) {
        yamlObj.on_success = obj.on_success;
      }

      if (obj.on_failure) {
        yamlObj.on_failure = obj.on_failure;
      }

      if (obj.escalation) {
        yamlObj.escalation = obj.escalation;
      }

      return yamlObj;
    }),
  };

  if (config.workflow_webhook_url) {
    yamlConfig.workflow_webhook_url = config.workflow_webhook_url;
  }

  if (config.metadata) {
    yamlConfig.metadata = {
      ...config.metadata,
      created_at: config.metadata.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return yaml.dump(yamlConfig, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
  });
}

/**
 * Download config file
 */
export function downloadConfig(config: TenantConfig, filename?: string): void {
  const yamlContent = generateYAML(config);
  const blob = new Blob([yamlContent], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${config.tenant_id}-config.yaml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
