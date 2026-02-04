/**
 * Latency Collector - Tracks end-to-end and component-level latency
 * 
 * Features:
 * - End-to-end turn latency (user stops → agent starts)
 * - Component latency (STT, LLM TTFT, TTS TTFB)
 * - P50/P95/P99 percentiles (NOT averages)
 * - Alert if P95 > 800ms
 * - Track by tenant, time window
 */

import type { BaseEvent } from '../services/metrics-service.js';
import { MetricsService } from '../services/metrics-service.js';

export interface TurnLatency {
  traceId: string;
  conversationId: string;
  tenantId: string;
  turnId: string;
  userSpeechEnd: Date;
  agentSpeechStart: Date;
  latencyMs: number;
  componentBreakdown: {
    stt: number;
    llm: number;
    tts: number;
    network?: number;
  };
}

export class LatencyCollector {
  private metricsService: MetricsService;
  private turnStartTimes: Map<string, Date> = new Map(); // turnId -> user speech end time
  private sttLatencies: Map<string, number> = new Map(); // turnId -> STT latency
  private llmLatencies: Map<string, number> = new Map(); // turnId -> LLM TTFT
  private ttsLatencies: Map<string, number> = new Map(); // turnId -> TTS TTFB

  constructor(metricsService: MetricsService) {
    this.metricsService = metricsService;
  }

  /**
   * Process event and extract latency metrics
   */
  async processEvent(event: BaseEvent): Promise<void> {
    const payload = event.data as Record<string, unknown>;
    const turnId = payload.turn_id as string | undefined;

    // User speech ended (start of turn)
    if (event.event_type === 'user_speech_ended' || event.event_type === 'end_of_turn_detected') {
      if (turnId) {
        this.turnStartTimes.set(turnId, event.timestamp);
      }
    }

    // STT transcript ready
    if (event.event_type === 'stt_transcript_final') {
      const latencyMs = payload.latency_ms as number | undefined;
      if (turnId && latencyMs !== undefined) {
        this.sttLatencies.set(turnId, latencyMs);

        // Record STT latency metric
        await this.metricsService.processEvent({
          ...event,
          data: {
            ...payload,
            component: 'stt',
            latency_ms: latencyMs,
          },
        });
      }
    }

    // LLM first token (TTFT)
    if (event.event_type === 'llm_first_token') {
      const ttftMs = payload.ttft_ms as number | undefined;
      if (turnId && ttftMs !== undefined) {
        this.llmLatencies.set(turnId, ttftMs);

        // Record LLM latency metric
        await this.metricsService.processEvent({
          ...event,
          data: {
            ...payload,
            component: 'llm',
            latency_ms: ttftMs,
          },
        });
      }
    }

    // TTS first byte (TTFB)
    if (event.event_type === 'tts_first_byte') {
      const ttfbMs = payload.ttfb_ms as number | undefined;
      if (turnId && ttfbMs !== undefined) {
        this.ttsLatencies.set(turnId, ttfbMs);

        // Record TTS latency metric
        await this.metricsService.processEvent({
          ...event,
          data: {
            ...payload,
            component: 'tts',
            latency_ms: ttfbMs,
          },
        });
      }
    }

    // Agent speech started (end of turn latency calculation)
    if (event.event_type === 'agent_speech_started' || event.event_type === 'tts_playback_started') {
      if (turnId) {
        const userSpeechEnd = this.turnStartTimes.get(turnId);
        if (userSpeechEnd) {
          const latencyMs = event.timestamp.getTime() - userSpeechEnd.getTime();

          // Calculate component breakdown
          const sttLatency = this.sttLatencies.get(turnId) || 0;
          const llmLatency = this.llmLatencies.get(turnId) || 0;
          const ttsLatency = this.ttsLatencies.get(turnId) || 0;

          // Record end-to-end turn latency
          await this.metricsService.processEvent({
            ...event,
            data: {
              ...payload,
              component: 'turn_e2e',
              latency_ms: latencyMs,
              stt_latency: sttLatency,
              llm_latency: llmLatency,
              tts_latency: ttsLatency,
            },
          });

          // Cleanup turn data
          this.turnStartTimes.delete(turnId);
          this.sttLatencies.delete(turnId);
          this.llmLatencies.delete(turnId);
          this.ttsLatencies.delete(turnId);
        }
      }
    }
  }

  /**
   * Calculate percentiles from latency array
   * Uses linear interpolation for percentile calculation
   */
  static calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number } {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);

    const percentile = (arr: number[], p: number): number => {
      const index = (p / 100) * (arr.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;

      if (upper >= arr.length) return arr[arr.length - 1];
      if (lower === upper) return arr[lower];

      return arr[lower] * (1 - weight) + arr[upper] * weight;
    };

    return {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  /**
   * Get latency percentiles for time window
   */
  async getLatencyPercentiles(
    tenantId: string,
    component: 'stt' | 'llm' | 'tts' | 'turn_e2e',
    startTime: Date,
    endTime: Date
  ): Promise<{ p50: number; p95: number; p99: number; sampleCount: number }> {
    return this.metricsService.getLatencyPercentiles(tenantId, component, startTime, endTime);
  }

  /**
   * Check if P95 latency exceeds threshold (800ms)
   */
  async checkLatencyThreshold(
    tenantId: string,
    component: 'stt' | 'llm' | 'tts' | 'turn_e2e',
    thresholdMs: number = 800,
    windowMinutes: number = 5
  ): Promise<{ exceeded: boolean; p95: number; threshold: number }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    const percentiles = await this.getLatencyPercentiles(tenantId, component, startTime, endTime);

    return {
      exceeded: percentiles.p95 > thresholdMs,
      p95: percentiles.p95,
      threshold: thresholdMs,
    };
  }
}
