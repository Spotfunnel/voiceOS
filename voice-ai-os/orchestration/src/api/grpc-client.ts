/**
 * gRPC Client for Voice Core
 * 
 * Handles gRPC communication with Voice Core (Layer 1) including:
 * - ExecutePrimitive RPC calls
 * - Event streaming
 * - Circuit breaker for failure handling
 * - Trace ID propagation
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load proto file - try multiple possible paths
const possibleProtoPaths = [
  join(__dirname, '../../../proto/voice_core.proto'),  // From orchestration/src/api
  join(__dirname, '../../../../proto/voice_core.proto'),  // Alternative path
  join(process.cwd(), 'proto/voice_core.proto'),  // From project root
];

let PROTO_PATH: string | null = null;
for (const path of possibleProtoPaths) {
  if (existsSync(path)) {
    PROTO_PATH = path;
    break;
  }
}

if (!PROTO_PATH) {
  throw new Error(
    `Proto file not found. Tried: ${possibleProtoPaths.join(', ')}. ` +
    'Please ensure proto/voice_core.proto exists.'
  );
}

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const voiceCoreProto = grpc.loadPackageDefinition(packageDefinition) as any;

// Circuit breaker state
enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening circuit
  successThreshold: number;       // Successes before closing circuit
  timeout: number;                // Time before trying half-open (ms)
  resetTimeout: number;           // Time before resetting failure count (ms)
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,  // 30 seconds
  resetTimeout: 60000,  // 1 minute
};

export class GrpcClient {
  private client: any;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private circuitBreakerConfig: CircuitBreakerConfig;

  constructor(
    private endpoint: string,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.circuitBreakerConfig = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...circuitBreakerConfig,
    };

    // Create gRPC client
    const VoiceCoreService = voiceCoreProto.voice_core.VoiceCoreService;
    this.client = new VoiceCoreService(
      endpoint,
      grpc.credentials.createInsecure()
    );
  }

  /**
   * Execute primitive via gRPC
   */
  async executePrimitive(
    objectiveType: string,
    params: Record<string, string>,
    conversationId: string,
    traceId: string,
    purpose: string,
    timeoutSeconds: number = 30
  ): Promise<{
    success: boolean;
    data?: Record<string, string>;
    error?: { code: string; message: string; details?: string };
    metadata?: {
      duration_ms: number;
      retry_count: number;
      confidence: number;
      state: string;
    };
  }> {
    // Check circuit breaker
    if (this.circuitState === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.circuitBreakerConfig.timeout) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
      // Transition to half-open
      this.circuitState = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const request = {
        objective_type: objectiveType,
        params,
        conversation_id: conversationId,
        trace_id: traceId,
        purpose,
        timeout_seconds: timeoutSeconds,
      };

      // Create metadata with trace_id
      const metadata = new grpc.Metadata();
      metadata.add('trace-id', traceId);
      metadata.add('x-trace-id', traceId);

      // Execute RPC with timeout
      const response = await new Promise((resolve, reject) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + timeoutSeconds);

        this.client.ExecutePrimitive(
          request,
          metadata,
          { deadline },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(response);
            }
          }
        );
      });

      // Record success
      this.recordSuccess();

      return {
        success: response.success,
        data: response.data || {},
        error: response.error
          ? {
              code: response.error.code,
              message: response.error.message,
              details: response.error.details,
            }
          : undefined,
        metadata: response.metadata
          ? {
              duration_ms: response.metadata.duration_ms,
              retry_count: response.metadata.retry_count,
              confidence: response.metadata.confidence,
              state: response.metadata.state,
            }
          : undefined,
      };
    } catch (error: any) {
      // Record failure
      this.recordFailure();

      // Convert gRPC error to standard format
      if (error.code === grpc.status.DEADLINE_EXCEEDED) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: `Request timeout after ${timeoutSeconds}s`,
          },
        };
      }

      if (error.code === grpc.status.UNAVAILABLE) {
        return {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Voice Core service is unavailable',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'GRPC_ERROR',
          message: error.message || 'Unknown gRPC error',
          details: error.details,
        },
      };
    }
  }

  /**
   * Stream events from Voice Core
   */
  streamEvents(
    conversationId: string,
    traceId: string,
    eventTypes?: string[]
  ): AsyncIterable<{
    event_type: string;
    timestamp: string;
    conversation_id: string;
    trace_id: string;
    data: Record<string, unknown>;
    metadata: Record<string, string>;
  }> {
    const request = {
      conversation_id: conversationId,
      trace_id: traceId,
      event_types: eventTypes || [],
    };

    const metadata = new grpc.Metadata();
    metadata.add('trace-id', traceId);

    const call = this.client.StreamEvents(request, metadata);

    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const event of call) {
            yield {
              event_type: event.event_type,
              timestamp: event.timestamp,
              conversation_id: event.conversation_id,
              trace_id: event.trace_id,
              data: JSON.parse(event.data || '{}'),
              metadata: event.metadata || {},
            };
          }
        } catch (error) {
          console.error('Error streaming events:', error);
          throw error;
        }
      },
    };
  }

  /**
   * Health check via gRPC
   */
  async healthCheck(): Promise<boolean> {
    try {
      const request = {};
      const metadata = new grpc.Metadata();

      const response = await new Promise((resolve, reject) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 5); // 5 second timeout

        this.client.HealthCheck(
          request,
          metadata,
          { deadline },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(response);
            }
          }
        );
      });

      return (response as any).status === 1; // SERVING = 1
    } catch {
      return false;
    }
  }

  /**
   * Record successful request
   */
  private recordSuccess(): void {
    this.failureCount = 0;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.circuitBreakerConfig.successThreshold) {
        // Close circuit
        this.circuitState = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Record failed request
   */
  private recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (this.circuitState === CircuitState.CLOSED) {
      if (this.failureCount >= this.circuitBreakerConfig.failureThreshold) {
        // Open circuit
        this.circuitState = CircuitState.OPEN;
      }
    } else if (this.circuitState === CircuitState.HALF_OPEN) {
      // Failed during half-open, go back to open
      this.circuitState = CircuitState.OPEN;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}
