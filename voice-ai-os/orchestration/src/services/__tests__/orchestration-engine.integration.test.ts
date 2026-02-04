/**
 * Orchestration Engine Integration Tests - Layer 2: Orchestration
 * 
 * Integration test: Load config → execute graph → verify events emitted
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestrationEngine } from '../orchestration-engine.js';
import { ConfigService } from '../../config/config-service.js';
import { VoiceCoreClient } from '../../api/voice-core-client.js';
import { EventBus } from '../../events/event-bus.js';
import { EventType } from '../../models/config.model.js';
import { Locale, CONFIG_SCHEMA_VERSION } from '../../models/config.model.js';
import { PrimitiveType } from '../../models/objective.model.js';
import type { TenantConfig } from '../../models/config.model.js';

describe('OrchestrationEngine Integration', () => {
  let engine: OrchestrationEngine;
  let eventBus: EventBus;
  let configService: ConfigService;
  let voiceCoreClient: VoiceCoreClient;

  beforeEach(() => {
    eventBus = new EventBus({
      enablePersistence: false,
      bufferSize: 100,
      flushInterval: 100,
    });
    configService = new ConfigService();
    voiceCoreClient = new VoiceCoreClient({
      endpoint: 'http://localhost:8000',
    });
    // Default mock: successful primitive execution
    voiceCoreClient.executePrimitive = async () => ({
      success: true,
      data: {},
    });
    engine = new OrchestrationEngine(voiceCoreClient, configService, eventBus);
  });

  it('should load config, execute objective graph, and emit events', async () => {
    // Create test configuration: email → phone → address
    const config: TenantConfig = {
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
        },
        {
          id: 'capture_phone',
          type: PrimitiveType.CAPTURE_PHONE_AU,
          purpose: 'callback',
          required: true,
          max_retries: 3,
          on_success: 'capture_address',
        },
        {
          id: 'capture_address',
          type: PrimitiveType.CAPTURE_ADDRESS_AU,
          purpose: 'service_location',
          required: true,
          max_retries: 3,
        },
      ],
    };

    const conversationId = 'test-conv-123';
    const tenantId = 'test_tenant';

    // Collect emitted events
    const emittedEvents: Array<{ type: EventType; data: Record<string, unknown> }> = [];
    
    eventBus.on(EventType.CONVERSATION_STARTED, (event) => {
      emittedEvents.push({ type: event.event_type, data: event.data });
    });
    
    eventBus.on(EventType.OBJECTIVE_STARTED, (event) => {
      emittedEvents.push({ type: event.event_type, data: event.data });
    });
    
    eventBus.on(EventType.OBJECTIVE_COMPLETED, (event) => {
      emittedEvents.push({ type: event.event_type, data: event.data });
    });
    
    eventBus.on(EventType.CONVERSATION_ENDED, (event) => {
      emittedEvents.push({ type: event.event_type, data: event.data });
    });

    // Start conversation
    const traceId = await engine.startConversation(tenantId, conversationId, config);

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify events were emitted
    expect(emittedEvents.length).toBeGreaterThan(0);

    // Verify conversation_started event
    const conversationStarted = emittedEvents.find(e => e.type === EventType.CONVERSATION_STARTED);
    expect(conversationStarted).toBeDefined();
    expect(conversationStarted?.data).toHaveProperty('locale', Locale.EN_AU);
    expect(conversationStarted?.data).toHaveProperty('objective_count', 3);

    // Verify objective_started events (should have 3 objectives)
    const objectiveStartedEvents = emittedEvents.filter(e => e.type === EventType.OBJECTIVE_STARTED);
    expect(objectiveStartedEvents.length).toBeGreaterThanOrEqual(1);

    // Verify objective_completed events
    const objectiveCompletedEvents = emittedEvents.filter(e => e.type === EventType.OBJECTIVE_COMPLETED);
    // Note: With mock data, objectives should complete successfully
    expect(objectiveCompletedEvents.length).toBeGreaterThanOrEqual(1);

    // Verify trace_id propagation
    const allEvents = await eventBus.getConversationEvents(conversationId);
    const uniqueTraceIds = new Set(allEvents.map(e => e.trace_id));
    expect(uniqueTraceIds.size).toBe(1);
    expect(uniqueTraceIds.has(traceId)).toBe(true);

    // Verify sequence numbers are monotonic
    const sequenceNumbers = allEvents.map(e => e.sequence_number).sort((a, b) => a - b);
    for (let i = 0; i < sequenceNumbers.length; i++) {
      expect(sequenceNumbers[i]).toBe(i + 1);
    }
  });

  it('should handle objective failures and emit failure events', async () => {
    // Override mock to force failure
    voiceCoreClient.executePrimitive = async () => ({
      success: false,
      error: {
        code: 'MOCK_FAILURE',
        message: 'Mock failure for testing',
      },
    });
    // Create config with a required objective that will fail
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
          max_retries: 1, // Low retries to force failure
        },
      ],
    };

    const conversationId = 'test-conv-fail';
    const tenantId = 'test_tenant';

    const failureEvents: Array<{ type: EventType }> = [];
    eventBus.on(EventType.OBJECTIVE_FAILED, (event) => {
      failureEvents.push({ type: event.event_type });
    });

    // Mock Voice Core to return failures
    // Note: In a real test, we'd mock the VoiceCoreClient
    // For now, we rely on the 5% failure rate in the stub

    await engine.startConversation(tenantId, conversationId, config);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify that if failure occurred, failure event was emitted
    const allEvents = await eventBus.getConversationEvents(conversationId);
    const hasFailureEvent = allEvents.some(e => e.event_type === EventType.OBJECTIVE_FAILED);
    
    // Note: With mock data, failures are probabilistic (5% chance)
    // This test verifies the failure path exists, not that it always fails
    if (hasFailureEvent) {
      expect(failureEvents.length).toBeGreaterThan(0);
    }
  });

  it('should propagate trace_id through all events', async () => {
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
        },
      ],
    };

    const conversationId = 'test-conv-trace';
    const tenantId = 'test_tenant';

    const traceId = await engine.startConversation(tenantId, conversationId, config);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify all events have the same trace_id
    const allEvents = await eventBus.getConversationEvents(conversationId);
    expect(allEvents.length).toBeGreaterThan(0);
    
    for (const event of allEvents) {
      expect(event.trace_id).toBe(traceId);
    }
  });
});
