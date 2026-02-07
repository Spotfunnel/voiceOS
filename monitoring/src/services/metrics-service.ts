/**
 * Metrics Service - Collects and aggregates metrics from event stream
 * 
 * Features:
 * - Collects metrics from event bus
 * - Aggregates by tenant, conversation, objective
 * - Calculates P50/P95/P99 latency percentiles
 * - Tracks cost per call (STT, LLM, TTS)
 * - Monitors circuit breaker status
 * - Stores in TimescaleDB
 */

import { Pool, PoolClient } from 'pg';

// Event type definition (local copy to avoid circular dependencies)
export interface BaseEvent {
  event_id: string;
  event_type: string;
  event_version?: string;
  trace_id: string;
  sequence_number: number;
  tenant_id: string;
  conversation_id: string;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface LatencyMetric {
  traceId: string;
  conversationId: string;
  tenantId: string;
  objectiveId?: string;
  component: 'stt' | 'llm' | 'tts' | 'turn_e2e' | 'network';
  latencyMs: number;
  provider?: string;
  model?: string;
  timestamp: Date;
}

export interface CostMetric {
  traceId: string;
  conversationId: string;
  tenantId: string;
  provider: string;
  serviceType: 'stt' | 'llm' | 'tts';
  usageAmount: number;
  usageUnit: 'minutes' | 'tokens' | 'characters';
  costUsd: number;
  ratePerUnit: number;
  timestamp: Date;
}

export interface HealthMetric {
  component: string;
  componentId?: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down';
  metrics?: Record<string, unknown>;
  circuitState?: 'closed' | 'open' | 'half_open';
  failureCount?: number;
  lastFailureAt?: Date;
  timestamp: Date;
}

export interface CallMetric {
  traceId: string;
  conversationId: string;
  tenantId: string;
  status: 'success' | 'failed' | 'abandoned';
  failureReason?: string;
  callDurationSeconds?: number;
  turnCount?: number;
  avgConfidence?: number;
  interruptionCount?: number;
  startedAt: Date;
  endedAt?: Date;
}

/**
 * Provider cost rates (USD)
 * Update these based on actual provider pricing
 */
const PROVIDER_RATES: Record<string, Record<string, number>> = {
  // STT rates (per minute)
  deepgram: { stt: 0.0043 }, // $0.0043/min
  assemblyai: { stt: 0.00025 }, // $0.00025/min
  'gpt-4o-audio': { stt: 0.006 }, // $0.006/min
  
  // LLM rates (per 1K tokens)
  openai: {
    llm_input: 0.0025, // GPT-4.1 input: $2.50/1M tokens (update if pricing changes)
    llm_output: 0.01, // GPT-4.1 output: $10/1M tokens (update if pricing changes)
  },
  
  // TTS rates (per character)
  cartesia: { tts: 0.00001 }, // $0.01/1K characters
  elevenlabs: { tts: 0.00003 }, // $0.03/1K characters
};

export class MetricsService {
  private pool: Pool;
  private latencyBuffer: LatencyMetric[] = [];
  private costBuffer: CostMetric[] = [];
  private healthBuffer: HealthMetric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly bufferSize = 100;
  private readonly flushIntervalMs = 5000; // 5 seconds

  constructor(dbUrl: string) {
    this.pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Process event and extract metrics
   */
  async processEvent(event: BaseEvent): Promise<void> {
    try {
      // Extract latency metrics from event payload
      await this.extractLatencyMetrics(event);

      // Extract cost metrics from event payload
      await this.extractCostMetrics(event);

      // Extract health metrics from event payload
      await this.extractHealthMetrics(event);

      // Extract call metrics from event payload
      await this.extractCallMetrics(event);
    } catch (error) {
      console.error(`Error processing event ${event.event_id}:`, error);
    }
  }

  /**
   * Extract latency metrics from event
   */
  private async extractLatencyMetrics(event: BaseEvent): Promise<void> {
    const payload = event.data as Record<string, unknown>;

    // Check for latency fields in payload
    if (payload.latency_ms !== undefined) {
      const metric: LatencyMetric = {
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        objectiveId: payload.objective_id as string | undefined,
        component: (payload.component as LatencyMetric['component']) || 'turn_e2e',
        latencyMs: Number(payload.latency_ms),
        provider: payload.provider as string | undefined,
        model: payload.model as string | undefined,
        timestamp: event.timestamp,
      };

      this.latencyBuffer.push(metric);

      if (this.latencyBuffer.length >= this.bufferSize) {
        await this.flushLatencyMetrics();
      }
    }

    // Extract component-specific latency from event type
    if (event.event_type === 'stt_transcript_final' && payload.latency_ms) {
      this.latencyBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        component: 'stt',
        latencyMs: Number(payload.latency_ms),
        provider: payload.provider as string,
        timestamp: event.timestamp,
      });
    }

    if (event.event_type === 'llm_first_token' && payload.ttft_ms) {
      this.latencyBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        component: 'llm',
        latencyMs: Number(payload.ttft_ms),
        provider: 'openai',
        model: payload.model as string,
        timestamp: event.timestamp,
      });
    }

    if (event.event_type === 'tts_first_byte' && payload.ttfb_ms) {
      this.latencyBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        component: 'tts',
        latencyMs: Number(payload.ttfb_ms),
        provider: payload.provider as string,
        model: payload.model as string,
        timestamp: event.timestamp,
      });
    }
  }

  /**
   * Extract cost metrics from event
   */
  private async extractCostMetrics(event: BaseEvent): Promise<void> {
    const payload = event.data as Record<string, unknown>;

    // STT cost (minutes)
    if (event.event_type === 'stt_transcript_final' && payload.duration_seconds) {
      const provider = (payload.provider as string) || 'deepgram';
      const minutes = Number(payload.duration_seconds) / 60;
      const rate = PROVIDER_RATES[provider]?.stt || 0.0043;
      const cost = minutes * rate;

      this.costBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        provider,
        serviceType: 'stt',
        usageAmount: minutes,
        usageUnit: 'minutes',
        costUsd: cost,
        ratePerUnit: rate,
        timestamp: event.timestamp,
      });
    }

    // LLM cost (tokens)
    if (event.event_type === 'llm_completion' && payload.prompt_tokens && payload.completion_tokens) {
      const promptTokens = Number(payload.prompt_tokens);
      const completionTokens = Number(payload.completion_tokens);
      const inputRate = PROVIDER_RATES.openai?.llm_input || 0.0025;
      const outputRate = PROVIDER_RATES.openai?.llm_output || 0.01;

      // Input tokens
      this.costBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        provider: 'openai',
        serviceType: 'llm',
        usageAmount: promptTokens,
        usageUnit: 'tokens',
        costUsd: (promptTokens / 1000) * inputRate,
        ratePerUnit: inputRate,
        timestamp: event.timestamp,
      });

      // Output tokens
      this.costBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        provider: 'openai',
        serviceType: 'llm',
        usageAmount: completionTokens,
        usageUnit: 'tokens',
        costUsd: (completionTokens / 1000) * outputRate,
        ratePerUnit: outputRate,
        timestamp: event.timestamp,
      });
    }

    // TTS cost (characters)
    if (event.event_type === 'tts_synthesis_complete' && payload.character_count) {
      const provider = (payload.provider as string) || 'cartesia';
      const characters = Number(payload.character_count);
      const rate = PROVIDER_RATES[provider]?.tts || 0.00001;
      const cost = (characters / 1000) * rate;

      this.costBuffer.push({
        traceId: event.trace_id,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        provider,
        serviceType: 'tts',
        usageAmount: characters,
        usageUnit: 'characters',
        costUsd: cost,
        ratePerUnit: rate,
        timestamp: event.timestamp,
      });
    }

    if (this.costBuffer.length >= this.bufferSize) {
      await this.flushCostMetrics();
    }
  }

  /**
   * Extract health metrics from event
   */
  private async extractHealthMetrics(event: BaseEvent): Promise<void> {
    const payload = event.data as Record<string, unknown>;

    // Circuit breaker status
    if (event.event_type === 'circuit_breaker_state_changed') {
      this.healthBuffer.push({
        component: 'circuit_breaker',
        componentId: payload.provider as string,
        status: payload.status === 'open' ? 'unhealthy' : 'healthy',
        circuitState: payload.state as 'closed' | 'open' | 'half_open',
        failureCount: payload.failure_count as number,
        lastFailureAt: payload.last_failure_at ? new Date(payload.last_failure_at as string) : undefined,
        timestamp: event.timestamp,
      });
    }

    // Worker health
    if (event.event_type === 'worker_health') {
      this.healthBuffer.push({
        component: 'worker',
        componentId: payload.worker_id as string,
        status: payload.status as HealthMetric['status'],
        metrics: payload.metrics as Record<string, unknown>,
        timestamp: event.timestamp,
      });
    }

    // Provider health
    if (event.event_type === 'provider_health') {
      this.healthBuffer.push({
        component: 'provider',
        componentId: payload.provider as string,
        status: payload.status as HealthMetric['status'],
        metrics: payload.metrics as Record<string, unknown>,
        timestamp: event.timestamp,
      });
    }

    if (this.healthBuffer.length >= this.bufferSize) {
      await this.flushHealthMetrics();
    }
  }

  /**
   * Extract call metrics from event
   */
  private async extractCallMetrics(event: BaseEvent): Promise<void> {
    // Call started
    if (event.event_type === 'call_started') {
      // Will be updated when call ends
      return;
    }

    // Call ended
    if (event.event_type === 'call_ended') {
      const payload = event.data as Record<string, unknown>;
      // This would typically be handled by a separate call metrics aggregator
      // For now, we'll track it via events
    }
  }

  /**
   * Flush latency metrics to database
   */
  private async flushLatencyMetrics(): Promise<void> {
    if (this.latencyBuffer.length === 0) return;

    const metrics = this.latencyBuffer.splice(0, this.bufferSize);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO metrics_latency (
          trace_id, conversation_id, tenant_id, objective_id,
          component, latency_ms, provider, model, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `;

      for (const metric of metrics) {
        await client.query(query, [
          metric.traceId,
          metric.conversationId,
          metric.tenantId,
          metric.objectiveId || null,
          metric.component,
          metric.latencyMs,
          metric.provider || null,
          metric.model || null,
          metric.timestamp,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error flushing latency metrics:', error);
      // Re-add metrics to buffer for retry
      this.latencyBuffer.unshift(...metrics);
    } finally {
      client.release();
    }
  }

  /**
   * Flush cost metrics to database
   */
  private async flushCostMetrics(): Promise<void> {
    if (this.costBuffer.length === 0) return;

    const metrics = this.costBuffer.splice(0, this.bufferSize);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO metrics_cost (
          trace_id, conversation_id, tenant_id,
          provider, service_type, usage_amount, usage_unit,
          cost_usd, rate_per_unit, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      for (const metric of metrics) {
        await client.query(query, [
          metric.traceId,
          metric.conversationId,
          metric.tenantId,
          metric.provider,
          metric.serviceType,
          metric.usageAmount,
          metric.usageUnit,
          metric.costUsd,
          metric.ratePerUnit,
          metric.timestamp,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error flushing cost metrics:', error);
      this.costBuffer.unshift(...metrics);
    } finally {
      client.release();
    }
  }

  /**
   * Flush health metrics to database
   */
  private async flushHealthMetrics(): Promise<void> {
    if (this.healthBuffer.length === 0) return;

    const metrics = this.healthBuffer.splice(0, this.bufferSize);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO metrics_health (
          component, component_id, status, metrics,
          circuit_state, failure_count, last_failure_at, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      for (const metric of metrics) {
        await client.query(query, [
          metric.component,
          metric.componentId || null,
          metric.status,
          metric.metrics ? JSON.stringify(metric.metrics) : null,
          metric.circuitState || null,
          metric.failureCount || null,
          metric.lastFailureAt || null,
          metric.timestamp,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error flushing health metrics:', error);
      this.healthBuffer.unshift(...metrics);
    } finally {
      client.release();
    }
  }

  /**
   * Start periodic flush
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      await Promise.all([
        this.flushLatencyMetrics(),
        this.flushCostMetrics(),
        this.flushHealthMetrics(),
      ]);
    }, this.flushIntervalMs);
  }

  /**
   * Stop periodic flush
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Final flush
    Promise.all([
      this.flushLatencyMetrics(),
      this.flushCostMetrics(),
      this.flushHealthMetrics(),
    ]).finally(() => {
      this.pool.end();
    });
  }

  /**
   * Get latency percentiles
   */
  async getLatencyPercentiles(
    tenantId: string,
    component: string,
    startTime: Date,
    endTime: Date
  ): Promise<{ p50: number; p95: number; p99: number; sampleCount: number }> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT
          percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99,
          COUNT(*) AS sample_count
        FROM metrics_latency
        WHERE tenant_id = $1
          AND component = $2
          AND timestamp >= $3
          AND timestamp <= $4
        `,
        [tenantId, component, startTime, endTime]
      );

      const row = result.rows[0];
      return {
        p50: Number(row.p50) || 0,
        p95: Number(row.p95) || 0,
        p99: Number(row.p99) || 0,
        sampleCount: Number(row.sample_count) || 0,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get cost per call
   */
  async getCostPerCall(traceId: string): Promise<number> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT SUM(cost_usd) AS total_cost
        FROM metrics_cost
        WHERE trace_id = $1
        `,
        [traceId]
      );

      return Number(result.rows[0]?.total_cost || 0);
    } finally {
      client.release();
    }
  }

  /**
   * Get call metrics (for API)
   */
  async getCallMetrics(
    tenantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    abandonedCalls: number;
    successRate: number;
    failureReasons: Record<string, number>;
  }> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT
          COUNT(*) AS total_calls,
          COUNT(*) FILTER (WHERE status = 'success') AS successful_calls,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed_calls,
          COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned_calls,
          jsonb_object_agg(
            failure_reason,
            COUNT(*)
          ) FILTER (WHERE failure_reason IS NOT NULL) AS failure_reasons
        FROM metrics_calls
        WHERE tenant_id = $1
          AND timestamp >= $2
          AND timestamp <= $3
        `,
        [tenantId, startTime, endTime]
      );

      const row = result.rows[0];
      const totalCalls = Number(row.total_calls) || 0;
      const successfulCalls = Number(row.successful_calls) || 0;

      return {
        totalCalls,
        successfulCalls,
        failedCalls: Number(row.failed_calls) || 0,
        abandonedCalls: Number(row.abandoned_calls) || 0,
        successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
        failureReasons: row.failure_reasons || {},
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get database pool (for advanced queries)
   */
  getPool(): Pool {
    return this.pool;
  }
}
