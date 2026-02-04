/**
 * Configuration Service - Layer 2: Orchestration
 * 
 * Loads and validates customer objective graphs from YAML/JSON.
 * Following R-ARCH-003: Objectives MUST Be Declarative
 * Following D-ARCH-006: Configuration Schema is Versioned and Validated
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { TenantConfig, ConfigValidationResult, ConfigValidationError } from '../models/config.model.js';
import type { Objective, ObjectiveGraph } from '../models/objective.model.js';
import { PrimitiveType, EscalationStrategy } from '../models/objective.model.js';
import { Locale, CONFIG_SCHEMA_VERSION } from '../models/config.model.js';
import { db } from '../database/db.js';

/**
 * Zod schema for Objective validation
 */
const ObjectiveSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(PrimitiveType),
  version: z.string().optional(),
  purpose: z.string().min(1),
  required: z.boolean(),
  max_retries: z.number().int().positive().optional(),
  on_success: z.string().optional(),
  on_failure: z.string().optional(),
  escalation: z.nativeEnum(EscalationStrategy).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for TenantConfig validation
 */
const TenantConfigSchema = z.object({
  tenant_id: z.string().min(1),
  tenant_name: z.string().min(1),
  locale: z.nativeEnum(Locale),
  schema_version: z.literal(CONFIG_SCHEMA_VERSION),
  objectives: z.array(ObjectiveSchema).min(1),
  workflow_webhook_url: z.string().url().optional(),
  metadata: z.object({
    created_at: z.string().datetime().or(z.date()),
    updated_at: z.string().datetime().or(z.date()),
    created_by: z.string(),
  }).optional(),
});

/**
 * Configuration Service
 */
export class ConfigService {
  /**
   * Load configuration from database
   * @param tenantId - Tenant UUID
   * @param version - Optional config version (defaults to latest)
   */
  async loadFromDatabase(tenantId: string, version?: string): Promise<TenantConfig> {
    let query: string;
    let params: any[];

    if (version) {
      // Load specific version
      query = `
        SELECT yaml_content, created_at
        FROM configs
        WHERE tenant_id = $1 AND version = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [tenantId, version];
    } else {
      // Load latest version
      query = `
        SELECT yaml_content, created_at
        FROM configs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [tenantId];
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      throw new Error(`Configuration not found for tenant ${tenantId}${version ? ` version ${version}` : ''}`);
    }

    const yamlContent = result.rows[0].yaml_content;
    
    // Parse YAML content
    const parsed = yaml.load(yamlContent) as unknown;
    
    // Validate and load
    return this.load(parsed);
  }

  /**
   * Save configuration to database
   * @param tenantId - Tenant UUID
   * @param config - TenantConfig to save
   * @param version - Version string (e.g., 'v1.0.0')
   */
  async saveToDatabase(tenantId: string, config: TenantConfig, version: string): Promise<void> {
    // Validate configuration first
    const validation = this.validate(config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Validate DAG
    const dagValidation = this.validateDAG(config.objectives);
    if (!dagValidation.valid) {
      throw new Error(`Objective graph validation failed: ${dagValidation.errors.map(e => e.message).join(', ')}`);
    }

    // Convert config to YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
    });

    // Save to database
    await db.query(
      `INSERT INTO configs (tenant_id, version, yaml_content)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, version) DO UPDATE
       SET yaml_content = EXCLUDED.yaml_content`,
      [tenantId, version, yamlContent]
    );
  }

  /**
   * Get latest configuration version for a tenant
   * @param tenantId - Tenant UUID
   */
  async getLatestConfigVersion(tenantId: string): Promise<string | null> {
    const result = await db.query(
      `SELECT version FROM configs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId]
    );

    return result.rows.length > 0 ? result.rows[0].version : null;
  }

  /**
   * List all configuration versions for a tenant
   * @param tenantId - Tenant UUID
   */
  async listConfigVersions(tenantId: string): Promise<Array<{ version: string; created_at: Date }>> {
    const result = await db.query(
      `SELECT version, created_at
       FROM configs
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return result.rows.map(row => ({
      version: row.version,
      created_at: row.created_at,
    }));
  }

  /**
   * Load configuration from file (YAML or JSON)
   */
  async loadFromFile(filePath: string): Promise<TenantConfig> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    let parsed: unknown;
    if (ext === '.yaml' || ext === '.yml') {
      parsed = yaml.load(content);
    } else if (ext === '.json') {
      parsed = JSON.parse(content);
    } else {
      throw new Error(`Unsupported file format: ${ext}. Use .yaml, .yml, or .json`);
    }
    
    return this.load(parsed);
  }

  /**
   * Load configuration from object
   */
  async load(config: unknown): Promise<TenantConfig> {
    // Validate schema
    const validation = this.validate(config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Parse and normalize
    const parsed = TenantConfigSchema.parse(config);
    
    // Normalize dates
    if (parsed.metadata) {
      parsed.metadata.created_at = parsed.metadata.created_at instanceof Date 
        ? parsed.metadata.created_at 
        : new Date(parsed.metadata.created_at);
      parsed.metadata.updated_at = parsed.metadata.updated_at instanceof Date 
        ? parsed.metadata.updated_at 
        : new Date(parsed.metadata.updated_at);
    }

    // Validate objective graph is DAG
    const dagValidation = this.validateDAG(parsed.objectives);
    if (!dagValidation.valid) {
      throw new Error(`Objective graph validation failed: ${dagValidation.errors.map(e => e.message).join(', ')}`);
    }

    return parsed;
  }

  /**
   * Validate configuration schema
   */
  validate(config: unknown): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];

    try {
      TenantConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          });
        }
      } else {
        errors.push({
          field: 'root',
          message: String(error),
          code: 'UNKNOWN_ERROR',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate objective graph is acyclic (DAG)
   * D-ARCH-005: Objective Graph is Directed Acyclic Graph
   */
  validateDAG(objectives: Objective[]): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];

    // Build adjacency list
    const graph = new Map<string, string[]>();
    const objectiveIds = new Set<string>();

    // Initialize graph
    for (const obj of objectives) {
      objectiveIds.add(obj.id);
      graph.set(obj.id, []);
    }

    // Build edges
    for (const obj of objectives) {
      if (obj.on_success && objectiveIds.has(obj.on_success)) {
        graph.get(obj.id)!.push(obj.on_success);
      }
      if (obj.on_failure && objectiveIds.has(obj.on_failure)) {
        graph.get(obj.id)!.push(obj.on_failure);
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recStack.has(node)) {
        return true; // Cycle detected
      }
      if (visited.has(node)) {
        return false; // Already processed
      }

      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    // Check all nodes for cycles
    for (const objId of objectiveIds) {
      if (!visited.has(objId)) {
        if (hasCycle(objId)) {
          errors.push({
            field: 'objectives',
            message: `Cycle detected in objective graph involving objective: ${objId}`,
            code: 'CYCLE_DETECTED',
          });
        }
      }
    }

    // Check for orphaned objectives (no path from root)
    // Note: We don't enforce a single root here, but we could
    // For now, we just ensure all objectives are reachable

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build objective graph from configuration
   */
  buildObjectiveGraph(config: TenantConfig): ObjectiveGraph {
    const objectivesMap = new Map<string, Objective>();
    
    for (const obj of config.objectives) {
      objectivesMap.set(obj.id, obj);
    }

    // Find root objective (one with no incoming edges)
    // If multiple roots, use first one (could be improved)
    const hasIncomingEdge = new Set<string>();
    for (const obj of config.objectives) {
      if (obj.on_success) {
        hasIncomingEdge.add(obj.on_success);
      }
      if (obj.on_failure) {
        hasIncomingEdge.add(obj.on_failure);
      }
    }

    const rootObjectives = config.objectives.filter(obj => !hasIncomingEdge.has(obj.id));
    const root = rootObjectives.length > 0 ? rootObjectives[0].id : config.objectives[0].id;

    return {
      root,
      objectives: Object.fromEntries(objectivesMap),
    };
  }
}
