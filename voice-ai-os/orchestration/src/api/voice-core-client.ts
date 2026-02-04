/**
 * Voice Core Client - Layer 2: Orchestration
 * 
 * gRPC client for communicating with Voice Core (Layer 1).
 * Following D-ARCH-002: Voice Core is Python (Pipecat), Orchestration is TypeScript (Node.js)
 */

import type { PrimitiveType } from '../models/objective.model.js';
import { GrpcClient } from './grpc-client.js';

/**
 * Primitive execution request
 */
export interface PrimitiveExecutionRequest {
  conversation_id: string;
  trace_id: string; // Correlation ID propagated from orchestration
  purpose: string;
  metadata?: Record<string, unknown>;
}

/**
 * Primitive execution result
 */
export interface PrimitiveExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Voice Core Client Configuration
 */
export interface VoiceCoreClientConfig {
  /** Voice Core gRPC endpoint */
  endpoint: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Voice Core Client
 * 
 * Communicates with Layer 1 (Voice Core) to execute primitives.
 * gRPC-only for V1.
 */
export class VoiceCoreClient {
  private config: VoiceCoreClientConfig;
  private grpcClient?: GrpcClient;

  constructor(config?: Partial<VoiceCoreClientConfig>) {
    this.config = {
      endpoint: config?.endpoint || process.env.VOICE_CORE_ENDPOINT || 'http://localhost:8000',
      timeout: config?.timeout || 30000, // 30 seconds
    };

    // Initialize gRPC client (required)
    const grpcEndpoint = this.config.endpoint
      .replace(/^https?:\/\//, '')
      .replace(/^http:\/\//, '');
    
    this.grpcClient = new GrpcClient(grpcEndpoint);
  }

  /**
   * Execute a primitive via gRPC
   */
  async executePrimitive(
    primitiveType: PrimitiveType,
    request: PrimitiveExecutionRequest
  ): Promise<PrimitiveExecutionResult> {
    return this.executePrimitiveGrpc(primitiveType, request);
  }

  /**
   * Execute primitive via gRPC
   */
  private async executePrimitiveGrpc(
    primitiveType: PrimitiveType,
    request: PrimitiveExecutionRequest
  ): Promise<PrimitiveExecutionResult> {
    if (!this.grpcClient) {
      throw new Error('gRPC client not initialized.');
    }

    try {
      // Convert metadata to params map
      const params: Record<string, string> = {};
      if (request.metadata) {
        for (const [key, value] of Object.entries(request.metadata)) {
          params[key] = String(value);
        }
      }

      // Execute via gRPC
      const timeoutSeconds = Math.floor(this.config.timeout! / 1000);
      const response = await this.grpcClient.executePrimitive(
        primitiveType,
        params,
        request.conversation_id,
        request.trace_id,
        request.purpose,
        timeoutSeconds
      );

      // Convert response to PrimitiveExecutionResult
      return {
        success: response.success,
        data: response.data ? Object.fromEntries(
          Object.entries(response.data).map(([k, v]) => [k, v])
        ) : undefined,
        error: response.error,
      };
    } catch (error: any) {
      // Handle circuit breaker or connection errors
      if (error.message?.includes('Circuit breaker')) {
        return {
          success: false,
          error: {
            code: 'CIRCUIT_BREAKER_OPEN',
            message: 'Voice Core service is temporarily unavailable (circuit breaker open)',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'GRPC_ERROR',
          message: error.message || 'Unknown gRPC error',
        },
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (this.config.useGrpc && this.grpcClient) {
      return this.grpcClient.healthCheck();
    }

    // HTTP health check
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get circuit breaker state (gRPC only)
   */
  getCircuitState(): string | null {
    if (this.grpcClient) {
      return this.grpcClient.getCircuitState();
    }
    return null;
  }
}
