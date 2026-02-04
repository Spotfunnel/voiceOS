/**
 * Cost Collector - Tracks cost per call, per tenant, per provider
 * 
 * Features:
 * - STT cost per call (Deepgram, AssemblyAI, GPT-4o-audio)
 * - LLM cost per call (GPT-4o token usage)
 * - TTS cost per call (Cartesia, ElevenLabs)
 * - Total cost per call
 * - Cost per tenant (monthly)
 * - Alert if cost > $0.20/min
 */

import type { BaseEvent } from '../services/metrics-service.js';
import { MetricsService } from '../services/metrics-service.js';

export interface CallCost {
  traceId: string;
  conversationId: string;
  tenantId: string;
  totalCostUsd: number;
  breakdown: {
    stt: { cost: number; provider: string; minutes: number };
    llm: { cost: number; tokens: number };
    tts: { cost: number; provider: string; characters: number };
  };
  costPerMinute: number;
  callDurationSeconds: number;
}

export class CostCollector {
  private metricsService: MetricsService;
  private callCosts: Map<string, Partial<CallCost>> = new Map(); // traceId -> cost data

  constructor(metricsService: MetricsService) {
    this.metricsService = metricsService;
  }

  /**
   * Process event and extract cost metrics
   */
  async processEvent(event: BaseEvent): Promise<void> {
    const payload = event.data as Record<string, unknown>;
    const traceId = event.trace_id;

    // Initialize call cost tracking
    if (!this.callCosts.has(traceId)) {
      this.callCosts.set(traceId, {
        traceId,
        conversationId: event.conversation_id,
        tenantId: event.tenant_id,
        totalCostUsd: 0,
        breakdown: {
          stt: { cost: 0, provider: '', minutes: 0 },
          llm: { cost: 0, tokens: 0 },
          tts: { cost: 0, provider: '', characters: 0 },
        },
        costPerMinute: 0,
        callDurationSeconds: 0,
      });
    }

    const callCost = this.callCosts.get(traceId)!;

    // STT cost
    if (event.event_type === 'stt_transcript_final' && payload.duration_seconds) {
      await this.metricsService.processEvent(event);
      // Cost is already calculated in metrics service
    }

    // LLM cost
    if (event.event_type === 'llm_completion' && payload.prompt_tokens && payload.completion_tokens) {
      await this.metricsService.processEvent(event);
    }

    // TTS cost
    if (event.event_type === 'tts_synthesis_complete' && payload.character_count) {
      await this.metricsService.processEvent(event);
    }

    // Call ended - calculate final cost
    if (event.event_type === 'call_ended') {
      const durationSeconds = payload.duration_seconds as number | undefined;
      if (durationSeconds) {
        callCost.callDurationSeconds = durationSeconds;

        // Get total cost from metrics service
        const totalCost = await this.metricsService.getCostPerCall(traceId);
        callCost.totalCostUsd = totalCost;

        // Calculate cost per minute
        const minutes = durationSeconds / 60;
        callCost.costPerMinute = minutes > 0 ? totalCost / minutes : 0;

        // Cleanup
        this.callCosts.delete(traceId);
      }
    }
  }

  /**
   * Get cost per call
   */
  async getCostPerCall(traceId: string): Promise<CallCost | null> {
    const totalCost = await this.metricsService.getCostPerCall(traceId);
    const callCost = this.callCosts.get(traceId);

    if (!callCost) {
      return null;
    }

    return {
      ...callCost,
      totalCostUsd: totalCost,
    } as CallCost;
  }

  /**
   * Get monthly cost per tenant
   */
  async getMonthlyCostPerTenant(tenantId: string, month: Date): Promise<number> {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

    // This would query the cost_per_tenant_monthly materialized view
    // For now, return 0 (would need database query)
    return 0;
  }

  /**
   * Check if cost per minute exceeds threshold ($0.20/min)
   */
  async checkCostThreshold(
    traceId: string,
    thresholdPerMinute: number = 0.20
  ): Promise<{ exceeded: boolean; costPerMinute: number; threshold: number }> {
    const callCost = await this.getCostPerCall(traceId);

    if (!callCost) {
      return { exceeded: false, costPerMinute: 0, threshold: thresholdPerMinute };
    }

    return {
      exceeded: callCost.costPerMinute > thresholdPerMinute,
      costPerMinute: callCost.costPerMinute,
      threshold: thresholdPerMinute,
    };
  }

  /**
   * Get cost breakdown by provider
   */
  async getCostBreakdownByProvider(
    tenantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<Record<string, { cost: number; calls: number }>> {
    // This would query metrics_cost table grouped by provider
    // For now, return empty object
    return {};
  }
}
