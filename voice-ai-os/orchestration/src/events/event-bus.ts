/**
 * Event Bus - Layer 2: Orchestration
 * 
 * Event bus with PostgreSQL persistence, async emission, PII sanitization.
 * Following R-ARCH-009: Voice Core MUST Emit Events for Observability
 * Following D-ARCH-007: Event Schema is Immutable (Append-Only)
 * Following production-observability patterns: trace_id, sequence_number, async emission
 */

import { v4 as uuidv4 } from 'uuid';
import type { BaseEvent, EventType } from '../models/config.model.js';
import { db } from '../database/db.js';
import { sanitizePIIFields } from '../utils/pii-sanitizer.js';

/**
 * Event listener function
 */
export type EventListener = (event: BaseEvent) => void | Promise<void>;

/**
 * Event Bus Configuration
 */
export interface EventBusConfig {
  /** Enable PostgreSQL persistence */
  enablePersistence?: boolean;
  /** Buffer size before flushing to database */
  bufferSize?: number;
  /** Flush interval in milliseconds */
  flushInterval?: number;
}

/**
 * Event Bus with PostgreSQL persistence
 * 
 * Features:
 * - Async emission (<5ms overhead)
 * - PostgreSQL persistence (append-only)
 * - PII sanitization before storage
 * - Trace ID and sequence number tracking
 * - Event replay capability
 */
export class EventBus {
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private eventBuffer: BaseEvent[] = [];
  private sequenceCounters: Map<string, number> = new Map(); // trace_id -> sequence_number
  private config: Required<EventBusConfig>;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushLock: Promise<void> = Promise.resolve();

  constructor(config: EventBusConfig = {}) {
    this.config = {
      enablePersistence: config.enablePersistence ?? true,
      bufferSize: config.bufferSize ?? 100,
      flushInterval: config.flushInterval ?? 100, // 100ms
    };

    // Start periodic flush if persistence enabled
    if (this.config.enablePersistence) {
      this.startPeriodicFlush();
    }
  }

  /**
   * Emit an event (async, non-blocking)
   * 
   * Target: <5ms overhead for event emission
   */
  async emit(
    eventType: EventType,
    tenantId: string,
    conversationId: string,
    data: Record<string, unknown>,
    traceId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const startTime = Date.now();

    // Generate or use provided trace_id
    const eventTraceId = traceId || uuidv4();

    // Get and increment sequence number for this trace_id
    const currentSequence = this.sequenceCounters.get(eventTraceId) || 0;
    const sequenceNumber = currentSequence + 1;
    this.sequenceCounters.set(eventTraceId, sequenceNumber);

    // Sanitize PII before creating event
    const sanitizedData = sanitizePIIFields(data);

    const event: BaseEvent = {
      event_id: uuidv4(),
      event_type: eventType,
      event_version: 'v1',
      trace_id: eventTraceId,
      sequence_number: sequenceNumber,
      tenant_id: tenantId,
      conversation_id: conversationId,
      timestamp: new Date(),
      data: sanitizedData,
      metadata,
    };

    // Append to buffer (non-blocking)
    this.eventBuffer.push(event);

    // Notify listeners (fire-and-forget, don't await)
    this.notifyListeners(event).catch(error => {
      console.error(`Error in event listener for ${eventType}:`, error);
    });

    // Flush if buffer full (async, non-blocking)
    if (this.eventBuffer.length >= this.config.bufferSize) {
      this.flush().catch(error => {
        console.error('Error flushing event buffer:', error);
      });
    }

    // Verify latency target (<5ms)
    const latency = Date.now() - startTime;
    if (latency > 5) {
      console.warn(`Event emission latency ${latency}ms exceeds 5ms target`);
    }
  }

  /**
   * Notify listeners (async, fire-and-forget)
   */
  private async notifyListeners(event: BaseEvent): Promise<void> {
    const listeners = this.listeners.get(event.event_type) || new Set();
    const allListeners = this.listeners.get('*' as EventType) || new Set();
    const allToNotify = [...listeners, ...allListeners];

    // Execute listeners in parallel (don't block)
    const promises = Array.from(allToNotify).map(listener => {
      return Promise.resolve(listener(event)).catch(error => {
        console.error(`Error in event listener:`, error);
      });
    });

    await Promise.allSettled(promises);
  }

  /**
   * Flush events to PostgreSQL (async, batch write)
   */
  async flush(): Promise<void> {
    // Prevent concurrent flushes
    await this.flushLock;

    if (this.eventBuffer.length === 0) {
      return;
    }

    this.flushLock = (async () => {
      const eventsToFlush = this.eventBuffer.splice(0);

      if (!this.config.enablePersistence || eventsToFlush.length === 0) {
        return;
      }

      try {
        // Batch insert to PostgreSQL (append-only)
        const values = eventsToFlush.map((event, index) => {
          const base = index * 8;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        }).join(', ');

        const params: unknown[] = [];
        for (const event of eventsToFlush) {
          params.push(
            event.conversation_id,
            event.event_type,
            event.trace_id,
            event.sequence_number,
            event.timestamp,
            JSON.stringify(event.data),
            JSON.stringify(event.metadata || {}),
            event.tenant_id
          );
        }

        const query = `
          INSERT INTO events (
            conversation_id, event_type, trace_id, sequence_number,
            timestamp, payload, metadata, tenant_id
          )
          VALUES ${values}
        `;

        await db.query(query, params);
      } catch (error) {
        // Log error but don't fail - events are in buffer, will retry
        console.error('Error persisting events to PostgreSQL:', error);
        // Put events back in buffer for retry
        this.eventBuffer.unshift(...eventsToFlush);
      }
    })();

    await this.flushLock;
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Error in periodic flush:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop periodic flush timer
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Subscribe to events
   */
  on(eventType: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Replay events for a conversation (event sourcing)
   * 
   * Retrieves all events for a trace_id, sorted by sequence_number.
   */
  async replay(traceId: string): Promise<BaseEvent[]> {
    if (!this.config.enablePersistence) {
      // Fallback to in-memory buffer if persistence disabled
      return this.eventBuffer
        .filter(e => e.trace_id === traceId)
        .sort((a, b) => a.sequence_number - b.sequence_number);
    }

    try {
      const result = await db.query<{
        conversation_id: string;
        event_type: string;
        trace_id: string;
        sequence_number: number;
        timestamp: Date;
        payload: string;
        metadata: string;
        tenant_id: string;
      }>(
        `SELECT conversation_id, event_type, trace_id, sequence_number,
                timestamp, payload, metadata, tenant_id
         FROM events
         WHERE trace_id = $1
         ORDER BY sequence_number ASC`,
        [traceId]
      );

      return result.rows.map(row => ({
        event_id: '', // Not stored in DB, generate if needed
        event_type: row.event_type as EventType,
        event_version: 'v1',
        trace_id: row.trace_id,
        sequence_number: row.sequence_number,
        tenant_id: row.tenant_id,
        conversation_id: row.conversation_id,
        timestamp: row.timestamp,
        data: JSON.parse(row.payload),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error(`Error replaying events for trace_id ${traceId}:`, error);
      return [];
    }
  }

  /**
   * Get events for a conversation (from database or buffer)
   */
  async getConversationEvents(conversationId: string): Promise<BaseEvent[]> {
    if (!this.config.enablePersistence) {
      return this.eventBuffer
        .filter(e => e.conversation_id === conversationId)
        .sort((a, b) => a.sequence_number - b.sequence_number);
    }

    try {
      const result = await db.query<{
        conversation_id: string;
        event_type: string;
        trace_id: string;
        sequence_number: number;
        timestamp: Date;
        payload: string;
        metadata: string;
        tenant_id: string;
      }>(
        `SELECT conversation_id, event_type, trace_id, sequence_number,
                timestamp, payload, metadata, tenant_id
         FROM events
         WHERE conversation_id = $1
         ORDER BY sequence_number ASC`,
        [conversationId]
      );

      return result.rows.map(row => ({
        event_id: '',
        event_type: row.event_type as EventType,
        event_version: 'v1',
        trace_id: row.trace_id,
        sequence_number: row.sequence_number,
        tenant_id: row.tenant_id,
        conversation_id: row.conversation_id,
        timestamp: row.timestamp,
        data: JSON.parse(row.payload),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error(`Error getting events for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Clear event buffer (for testing)
   */
  clear(): void {
    this.eventBuffer = [];
    this.sequenceCounters.clear();
    this.listeners.clear();
  }

  /**
   * Cleanup (stop timers, flush remaining events)
   */
  async cleanup(): Promise<void> {
    this.stopPeriodicFlush();
    await this.flush();
  }
}

/**
 * Singleton event bus instance
 */
export const eventBus = new EventBus({
  enablePersistence: process.env.ENABLE_EVENT_PERSISTENCE !== 'false',
  bufferSize: parseInt(process.env.EVENT_BUFFER_SIZE || '100', 10),
  flushInterval: parseInt(process.env.EVENT_FLUSH_INTERVAL || '100', 10),
});
