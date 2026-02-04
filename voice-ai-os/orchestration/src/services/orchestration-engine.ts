/**
 * Orchestration Engine - Layer 2: Orchestration
 * 
 * Stateless orchestration engine that executes objectives in sequence.
 * Following D-ARCH-009: Orchestration Layer is Stateless (Event-Sourced)
 * Following R-ARCH-002: Voice Core MUST Be Immutable Across Customers
 */

import { v4 as uuidv4 } from 'uuid';
import type { TenantConfig, ObjectiveGraph } from '../models/config.model.js';
import { EventType } from '../models/config.model.js';
import type { Objective, ObjectiveInstance } from '../models/objective.model.js';
import { ObjectiveState } from '../models/objective.model.js';
import { VoiceCoreClient } from '../api/voice-core-client.js';
import { eventBus as defaultEventBus } from '../events/event-bus.js';
import type { EventBus } from '../events/event-bus.js';
import { ConfigService } from '../config/config-service.js';

/**
 * Conversation state (reconstructed from events)
 * Stateless: All state comes from event stream
 */
export interface ConversationState {
  conversation_id: string;
  tenant_id: string;
  trace_id: string; // Correlation ID for entire conversation
  current_objective_id?: string;
  completed_objectives: Set<string>;
  failed_objectives: Set<string>;
  skipped_objectives: Set<string>;
  objective_instances: Map<string, ObjectiveInstance>;
  started_at: Date;
  ended_at?: Date;
}

/**
 * Orchestration Engine
 * 
 * Executes objectives in sequence based on customer configuration.
 * All state is event-sourced (no in-memory state persisted).
 */
export class OrchestrationEngine {
  private voiceCoreClient: VoiceCoreClient;
  private configService: ConfigService;
  private eventBus: EventBus;
  private activeConversations: Map<string, ConversationState> = new Map();

  constructor(
    voiceCoreClient: VoiceCoreClient,
    configService?: ConfigService,
    eventBusInstance?: EventBus
  ) {
    this.voiceCoreClient = voiceCoreClient;
    this.configService = configService || new ConfigService();
    this.eventBus = eventBusInstance || defaultEventBus;
  }

  /**
   * Start a new conversation
   * 
   * Loads objective graph and begins execution.
   * Generates trace_id for correlation across all events.
   */
  async startConversation(
    tenantId: string,
    conversationId: string,
    config: TenantConfig,
    traceId?: string
  ): Promise<string> {
    // Generate trace_id if not provided
    const trace_id = traceId || uuidv4();

    // Build objective graph
    const graph = this.configService.buildObjectiveGraph(config);

    // Initialize conversation state
    const state: ConversationState = {
      conversation_id: conversationId,
      tenant_id: tenantId,
      trace_id,
      completed_objectives: new Set(),
      failed_objectives: new Set(),
      skipped_objectives: new Set(),
      objective_instances: new Map(),
      started_at: new Date(),
    };

    this.activeConversations.set(conversationId, state);

    // Emit conversation started event (with trace_id)
    await this.eventBus.emit(
      EventType.CONVERSATION_STARTED,
      tenantId,
      conversationId,
      {
        config_version: config.schema_version,
        locale: config.locale,
        objective_count: config.objectives.length,
      },
      trace_id,
      {
        component: 'orchestration-engine',
        agent_version: 'v1.0.0',
      }
    );

    // Start executing objectives
    await this.executeObjectiveGraph(conversationId, graph, config);

    return trace_id;
  }

  /**
   * Execute objective graph (hardcoded sequential flow for now)
   * 
   * TODO: Support parallel execution for independent objectives
   * TODO: Support conditional branching based on captured data
   */
  private async executeObjectiveGraph(
    conversationId: string,
    graph: ObjectiveGraph,
    config: TenantConfig
  ): Promise<void> {
    const state = this.activeConversations.get(conversationId);
    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Start from root objective
    let currentObjectiveId: string | undefined = graph.root;
    const visited = new Set<string>();

    while (currentObjectiveId) {
      // Prevent infinite loops (safety check)
      if (visited.has(currentObjectiveId)) {
        console.error(`Cycle detected in objective graph at ${currentObjectiveId}`);
        break;
      }
      visited.add(currentObjectiveId);

      const objective = graph.objectives[currentObjectiveId];
      if (!objective) {
        console.error(`Objective ${currentObjectiveId} not found in graph`);
        break;
      }

      // Execute objective
      const result = await this.executeObjective(
        conversationId,
        objective,
        config
      );

      // Update state
      state.current_objective_id = currentObjectiveId;

      if (result.success) {
        state.completed_objectives.add(currentObjectiveId);
        currentObjectiveId = objective.on_success || undefined;
      } else {
        // Handle failure
        if (objective.required) {
          state.failed_objectives.add(currentObjectiveId);
          
          // Emit failure event (with trace_id)
          await this.eventBus.emit(
            EventType.OBJECTIVE_FAILED,
            state.tenant_id,
            conversationId,
            {
              objective_id: currentObjectiveId,
              objective_type: objective.type,
              error_code: result.error?.code || 'UNKNOWN',
              error_message: result.error?.message || 'Objective failed',
              attempts: result.attempts || 1,
            },
            state.trace_id,
            {
              component: 'orchestration-engine',
            }
          );

          // Handle escalation
          if (objective.escalation === 'transfer' || objective.escalation === 'abort') {
            // Stop execution
            await this.endConversation(conversationId, 'failed');
            break;
          } else if (objective.escalation === 'skip') {
            state.skipped_objectives.add(currentObjectiveId);
            currentObjectiveId = objective.on_failure || undefined;
          } else {
            // Retry or continue based on on_failure
            currentObjectiveId = objective.on_failure || undefined;
          }
        } else {
          // Non-required objective failed, skip it
          state.skipped_objectives.add(currentObjectiveId);
          await this.eventBus.emit(
            EventType.OBJECTIVE_SKIPPED,
            state.tenant_id,
            conversationId,
            {
              objective_id: currentObjectiveId,
              objective_type: objective.type,
              reason: 'non_required_failed',
            },
            state.trace_id,
            {
              component: 'orchestration-engine',
            }
          );
          currentObjectiveId = objective.on_success || objective.on_failure || undefined;
        }
      }

      // Check for end condition
      if (currentObjectiveId === 'end_call' || currentObjectiveId === undefined) {
        await this.endConversation(conversationId, 'completed');
        break;
      }
    }
  }

  /**
   * Execute a single objective
   */
  private async executeObjective(
    conversationId: string,
    objective: Objective,
    config: TenantConfig
  ): Promise<{ success: boolean; attempts: number; error?: { code: string; message: string } }> {
    const state = this.activeConversations.get(conversationId);
    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get or create objective instance
    let instance = state.objective_instances.get(objective.id);
    if (!instance) {
      instance = {
        objective_id: objective.id,
        state: ObjectiveState.PENDING,
        attempts: 0,
        started_at: new Date(),
      };
      state.objective_instances.set(objective.id, instance);
    }

    // Emit objective started event (with trace_id)
    await this.eventBus.emit(
      EventType.OBJECTIVE_STARTED,
      state.tenant_id,
      conversationId,
      {
        objective_id: objective.id,
        objective_type: objective.type,
        purpose: objective.purpose,
        required: objective.required,
      },
      state.trace_id,
      {
        component: 'orchestration-engine',
      }
    );

    instance.state = ObjectiveState.IN_PROGRESS;
    instance.attempts += 1;

    const maxRetries = objective.max_retries || 3;

    // Retry loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Call Voice Core primitive (with trace_id)
        const result = await this.voiceCoreClient.executePrimitive(
          objective.type,
          {
            conversation_id: conversationId,
            trace_id: state.trace_id,
            purpose: objective.purpose,
            metadata: {
              objective_id: objective.id,
              attempt,
              max_retries: maxRetries,
            },
          }
        );

        if (result.success) {
          // Objective completed successfully
          instance.state = ObjectiveState.COMPLETED;
          instance.completed_at = new Date();
          instance.data = result.data;

          // Emit objective completed event (with trace_id)
          await this.eventBus.emit(
            EventType.OBJECTIVE_COMPLETED,
            state.tenant_id,
            conversationId,
            {
              objective_id: objective.id,
              objective_type: objective.type,
              captured_data: result.data || {},
              attempts: instance.attempts,
            },
            state.trace_id,
            {
              component: 'orchestration-engine',
            }
          );

          return { success: true, attempts: instance.attempts };
        } else {
          // Objective failed, will retry if attempts remaining
          if (attempt < maxRetries) {
            console.warn(
              `Objective ${objective.id} failed (attempt ${attempt}/${maxRetries}), retrying...`
            );
            continue;
          } else {
            // Max retries exhausted
            instance.state = ObjectiveState.FAILED;
            instance.failed_at = new Date();
            instance.error = {
              code: result.error?.code || 'EXECUTION_FAILED',
              message: result.error?.message || 'Objective execution failed',
            };

            return {
              success: false,
              attempts: instance.attempts,
              error: instance.error,
            };
          }
        }
      } catch (error) {
        // Network or unexpected error
        if (attempt < maxRetries) {
          console.warn(
            `Objective ${objective.id} error (attempt ${attempt}/${maxRetries}):`,
            error
          );
          continue;
        } else {
          instance.state = ObjectiveState.FAILED;
          instance.failed_at = new Date();
          instance.error = {
            code: 'UNEXPECTED_ERROR',
            message: error instanceof Error ? error.message : String(error),
          };

          return {
            success: false,
            attempts: instance.attempts,
            error: instance.error,
          };
        }
      }
    }

    // Should not reach here, but TypeScript needs it
    return {
      success: false,
      attempts: instance.attempts,
      error: { code: 'MAX_RETRIES_EXCEEDED', message: 'Maximum retries exceeded' },
    };
  }

  /**
   * End conversation
   */
  private async endConversation(
    conversationId: string,
    reason: 'completed' | 'failed' | 'aborted'
  ): Promise<void> {
    const state = this.activeConversations.get(conversationId);
    if (!state) {
      return;
    }

    state.ended_at = new Date();

    // Emit conversation ended event (with trace_id)
    await this.eventBus.emit(
      EventType.CONVERSATION_ENDED,
      state.tenant_id,
      conversationId,
      {
        reason,
        completed_objectives: Array.from(state.completed_objectives),
        failed_objectives: Array.from(state.failed_objectives),
        skipped_objectives: Array.from(state.skipped_objectives),
        duration_ms: state.ended_at.getTime() - state.started_at.getTime(),
      },
      state.trace_id,
      {
        component: 'orchestration-engine',
      }
    );

    // Clean up (optional - could keep for debugging)
    // this.activeConversations.delete(conversationId);
  }

  /**
   * Get conversation state (for debugging/monitoring)
   */
  getConversationState(conversationId: string): ConversationState | undefined {
    return this.activeConversations.get(conversationId);
  }

  /**
   * Reconstruct conversation state from events (event sourcing)
   * 
   * This demonstrates how state can be reconstructed from event stream.
   * In production, this would read from event store (Kafka, Postgres).
   */
  async reconstructStateFromEvents(
    conversationId: string,
    events: Array<{ event_type: string; data: Record<string, unknown> }>
  ): Promise<ConversationState> {
    // This is a simplified version - in production, would fully replay events
    const state: ConversationState = {
      conversation_id: conversationId,
      tenant_id: events[0]?.data.tenant_id as string || '',
      completed_objectives: new Set(),
      failed_objectives: new Set(),
      skipped_objectives: new Set(),
      objective_instances: new Map(),
      started_at: new Date(),
    };

    // Replay events to reconstruct state
    for (const event of events) {
      if (event.event_type === EventType.OBJECTIVE_COMPLETED) {
        state.completed_objectives.add(event.data.objective_id as string);
      } else if (event.event_type === EventType.OBJECTIVE_FAILED) {
        state.failed_objectives.add(event.data.objective_id as string);
      } else if (event.event_type === EventType.OBJECTIVE_SKIPPED) {
        state.skipped_objectives.add(event.data.objective_id as string);
      }
    }

    return state;
  }
}
