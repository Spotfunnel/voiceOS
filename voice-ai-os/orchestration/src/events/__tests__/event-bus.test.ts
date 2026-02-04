/**
 * Event Bus Tests - Layer 2: Orchestration
 * 
 * Tests for event emission, trace_id propagation, sequence numbers, PII sanitization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../event-bus.js';
import { EventType } from '../../models/config.model.js';
import { PrimitiveType } from '../../models/objective.model.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // Create new EventBus instance for each test (disable persistence for speed)
    eventBus = new EventBus({
      enablePersistence: false,
      bufferSize: 10,
      flushInterval: 100,
    });
  });

  describe('Event Emission', () => {
    it('should emit events with trace_id and sequence_number', async () => {
      const traceId = 'test-trace-123';
      const conversationId = 'test-conv-456';
      const tenantId = 'test-tenant';

      await eventBus.emit(
        EventType.OBJECTIVE_STARTED,
        tenantId,
        conversationId,
        { objective_id: 'test_objective' },
        traceId
      );

      await eventBus.emit(
        EventType.OBJECTIVE_COMPLETED,
        tenantId,
        conversationId,
        { objective_id: 'test_objective' },
        traceId
      );

      const events = await eventBus.getConversationEvents(conversationId);
      expect(events).toHaveLength(2);
      expect(events[0].trace_id).toBe(traceId);
      expect(events[0].sequence_number).toBe(1);
      expect(events[1].trace_id).toBe(traceId);
      expect(events[1].sequence_number).toBe(2);
    });

    it('should generate trace_id if not provided', async () => {
      const conversationId = 'test-conv-456';
      const tenantId = 'test-tenant';

      await eventBus.emit(
        EventType.OBJECTIVE_STARTED,
        tenantId,
        conversationId,
        { objective_id: 'test_objective' }
      );

      const events = await eventBus.getConversationEvents(conversationId);
      expect(events).toHaveLength(1);
      expect(events[0].trace_id).toBeDefined();
      expect(events[0].sequence_number).toBe(1);
    });

    it('should increment sequence numbers per trace_id', async () => {
      const traceId1 = 'trace-1';
      const traceId2 = 'trace-2';
      const conversationId1 = 'conv-1';
      const conversationId2 = 'conv-2';
      const tenantId = 'test-tenant';

      // Emit events for trace_id 1
      await eventBus.emit(EventType.OBJECTIVE_STARTED, tenantId, conversationId1, {}, traceId1);
      await eventBus.emit(EventType.OBJECTIVE_COMPLETED, tenantId, conversationId1, {}, traceId1);

      // Emit events for trace_id 2 (should start at 1)
      await eventBus.emit(EventType.OBJECTIVE_STARTED, tenantId, conversationId2, {}, traceId2);

      const events1 = await eventBus.getConversationEvents(conversationId1);
      const events2 = await eventBus.getConversationEvents(conversationId2);

      expect(events1[0].sequence_number).toBe(1);
      expect(events1[1].sequence_number).toBe(2);
      expect(events2[0].sequence_number).toBe(1); // Different trace_id, starts at 1
    });
  });

  describe('PII Sanitization', () => {
    it('should sanitize email addresses in event data', async () => {
      const traceId = 'test-trace';
      const conversationId = 'test-conv';
      const tenantId = 'test-tenant';

      await eventBus.emit(
        EventType.OBJECTIVE_COMPLETED,
        tenantId,
        conversationId,
        {
          objective_id: 'capture_email',
          email: 'customer@example.com',
        },
        traceId
      );

      const events = await eventBus.getConversationEvents(conversationId);
      expect(events).toHaveLength(1);
      
      // Email should be sanitized
      const data = events[0].data as Record<string, unknown>;
      expect(data.email).toBe('<EMAIL>');
    });

    it('should sanitize phone numbers in event data', async () => {
      const traceId = 'test-trace';
      const conversationId = 'test-conv';
      const tenantId = 'test-tenant';

      await eventBus.emit(
        EventType.OBJECTIVE_COMPLETED,
        tenantId,
        conversationId,
        {
          objective_id: 'capture_phone',
          phone: '0412345678',
        },
        traceId
      );

      const events = await eventBus.getConversationEvents(conversationId);
      expect(events).toHaveLength(1);
      
      const data = events[0].data as Record<string, unknown>;
      expect(data.phone).toBe('<PHONE>');
    });

    it('should not sanitize non-PII fields', async () => {
      const traceId = 'test-trace';
      const conversationId = 'test-conv';
      const tenantId = 'test-tenant';

      await eventBus.emit(
        EventType.OBJECTIVE_COMPLETED,
        tenantId,
        conversationId,
        {
          objective_id: 'test_objective',
          attempts: 3,
          error_code: 'VALIDATION_FAILED',
        },
        traceId
      );

      const events = await eventBus.getConversationEvents(conversationId);
      expect(events).toHaveLength(1);
      
      const data = events[0].data as Record<string, unknown>;
      expect(data.attempts).toBe(3);
      expect(data.error_code).toBe('VALIDATION_FAILED');
    });
  });

  describe('Event Listeners', () => {
    it('should notify listeners when events are emitted', async () => {
      const listener = vi.fn();
      eventBus.on(EventType.OBJECTIVE_STARTED, listener);

      await eventBus.emit(
        EventType.OBJECTIVE_STARTED,
        'tenant',
        'conv',
        {},
        'trace'
      );

      // Wait a bit for async listener execution
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: EventType.OBJECTIVE_STARTED,
          trace_id: 'trace',
        })
      );
    });

    it('should support wildcard listeners', async () => {
      const listener = vi.fn();
      eventBus.on('*' as EventType, listener);

      await eventBus.emit(EventType.OBJECTIVE_STARTED, 'tenant', 'conv', {}, 'trace');
      await eventBus.emit(EventType.OBJECTIVE_COMPLETED, 'tenant', 'conv', {}, 'trace');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should allow unsubscribing from events', async () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on(EventType.OBJECTIVE_STARTED, listener);

      await eventBus.emit(EventType.OBJECTIVE_STARTED, 'tenant', 'conv', {}, 'trace');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      await eventBus.emit(EventType.OBJECTIVE_STARTED, 'tenant', 'conv', {}, 'trace');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Event Replay', () => {
    it('should replay events for a trace_id in sequence order', async () => {
      const traceId = 'test-trace';
      const conversationId = 'test-conv';
      const tenantId = 'test-tenant';

      // Emit events out of order (simulating async)
      await eventBus.emit(EventType.OBJECTIVE_COMPLETED, tenantId, conversationId, {}, traceId);
      await eventBus.emit(EventType.OBJECTIVE_STARTED, tenantId, conversationId, {}, traceId);

      const replayed = await eventBus.replay(traceId);
      
      expect(replayed).toHaveLength(2);
      expect(replayed[0].sequence_number).toBe(1);
      expect(replayed[1].sequence_number).toBe(2);
      expect(replayed[0].event_type).toBe(EventType.OBJECTIVE_COMPLETED);
      expect(replayed[1].event_type).toBe(EventType.OBJECTIVE_STARTED);
    });
  });

  describe('Async Emission Performance', () => {
    it('should emit events with <5ms overhead', async () => {
      const startTime = Date.now();
      
      await eventBus.emit(
        EventType.OBJECTIVE_STARTED,
        'tenant',
        'conv',
        {},
        'trace'
      );

      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(5);
    });
  });
});
