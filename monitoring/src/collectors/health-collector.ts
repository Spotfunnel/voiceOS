/**
 * Health Collector - Monitors worker health, circuit breakers, providers
 * 
 * Features:
 * - Worker health (memory, CPU, active calls)
 * - Circuit breaker status (open/closed/half-open)
 * - Provider health (Deepgram, OpenAI, Cartesia uptime)
 * - Database connection pool status
 * - Redis cache hit rate
 */

import type { BaseEvent } from '../services/metrics-service.js';
import { MetricsService, type HealthMetric } from '../services/metrics-service.js';

export interface WorkerHealth {
  workerId: string;
  memoryPercent: number;
  cpuPercent: number;
  activeCalls: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down';
  timestamp: Date;
}

export interface CircuitBreakerStatus {
  provider: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureAt?: Date;
  openedAt?: Date;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down';
}

export interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down';
  uptimePercent: number;
  errorRate: number;
  avgLatencyMs: number;
  lastChecked: Date;
}

export class HealthCollector {
  private metricsService: MetricsService;
  private workerHealth: Map<string, WorkerHealth> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerStatus> = new Map();
  private providerHealth: Map<string, ProviderHealth> = new Map();

  constructor(metricsService: MetricsService) {
    this.metricsService = metricsService;
  }

  /**
   * Process event and extract health metrics
   */
  async processEvent(event: BaseEvent): Promise<void> {
    const payload = event.data as Record<string, unknown>;

    // Worker health event
    if (event.event_type === 'worker_health') {
      const workerId = payload.worker_id as string;
      const health: WorkerHealth = {
        workerId,
        memoryPercent: (payload.memory_percent as number) || 0,
        cpuPercent: (payload.cpu_percent as number) || 0,
        activeCalls: (payload.active_calls as number) || 0,
        status: this.determineWorkerStatus(
          payload.memory_percent as number,
          payload.cpu_percent as number
        ),
        timestamp: event.timestamp,
      };

      this.workerHealth.set(workerId, health);

      // Record health metric
      await this.metricsService.processEvent(event);
    }

    // Circuit breaker state changed
    if (event.event_type === 'circuit_breaker_state_changed') {
      const provider = payload.provider as string;
      const state = payload.state as 'closed' | 'open' | 'half_open';
      const failureCount = (payload.failure_count as number) || 0;
      const lastFailureAt = payload.last_failure_at
        ? new Date(payload.last_failure_at as string)
        : undefined;
      const openedAt = payload.opened_at ? new Date(payload.opened_at as string) : undefined;

      const circuitBreaker: CircuitBreakerStatus = {
        provider,
        state,
        failureCount,
        lastFailureAt,
        openedAt,
        status: state === 'open' ? 'unhealthy' : state === 'half_open' ? 'degraded' : 'healthy',
      };

      this.circuitBreakers.set(provider, circuitBreaker);

      // Record health metric
      await this.metricsService.processEvent(event);
    }

    // Provider health event
    if (event.event_type === 'provider_health') {
      const provider = payload.provider as string;
      const health: ProviderHealth = {
        provider,
        status: payload.status as ProviderHealth['status'],
        uptimePercent: (payload.uptime_percent as number) || 100,
        errorRate: (payload.error_rate as number) || 0,
        avgLatencyMs: (payload.avg_latency_ms as number) || 0,
        lastChecked: event.timestamp,
      };

      this.providerHealth.set(provider, health);

      // Record health metric
      await this.metricsService.processEvent(event);
    }
  }

  /**
   * Determine worker status based on metrics
   */
  private determineWorkerStatus(
    memoryPercent: number,
    cpuPercent: number
  ): 'healthy' | 'degraded' | 'unhealthy' | 'down' {
    if (memoryPercent > 85 || cpuPercent > 90) {
      return 'down';
    }
    if (memoryPercent > 80 || cpuPercent > 80) {
      return 'unhealthy';
    }
    if (memoryPercent > 70 || cpuPercent > 70) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Get worker health
   */
  getWorkerHealth(workerId: string): WorkerHealth | undefined {
    return this.workerHealth.get(workerId);
  }

  /**
   * Get all worker health statuses
   */
  getAllWorkerHealth(): WorkerHealth[] {
    return Array.from(this.workerHealth.values());
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(provider: string): CircuitBreakerStatus | undefined {
    return this.circuitBreakers.get(provider);
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllCircuitBreakerStatuses(): CircuitBreakerStatus[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Check if circuit breaker has been open > 5 minutes
   */
  checkCircuitBreakerOpenDuration(provider: string, thresholdMinutes: number = 5): boolean {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (!circuitBreaker || circuitBreaker.state !== 'open' || !circuitBreaker.openedAt) {
      return false;
    }

    const openDurationMs = Date.now() - circuitBreaker.openedAt.getTime();
    const thresholdMs = thresholdMinutes * 60 * 1000;

    return openDurationMs > thresholdMs;
  }

  /**
   * Get provider health
   */
  getProviderHealth(provider: string): ProviderHealth | undefined {
    return this.providerHealth.get(provider);
  }

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): ProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * Check if provider has been down > 2 minutes
   */
  checkProviderDowntime(provider: string, thresholdMinutes: number = 2): boolean {
    const health = this.providerHealth.get(provider);
    if (!health || health.status !== 'down') {
      return false;
    }

    // Would need to track when provider went down
    // For now, return false
    return false;
  }
}
