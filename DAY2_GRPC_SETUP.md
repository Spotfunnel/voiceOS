# Day 2: gRPC Communication Setup

## Overview

This document describes the gRPC communication setup between Voice Core (Python) and Orchestration (TypeScript).

## Architecture

- **Voice Core (Layer 1)**: Python gRPC server serving primitives
- **Orchestration (Layer 2)**: TypeScript gRPC client calling Voice Core
- **Protocol**: gRPC with Protocol Buffers

## Components

### 1. Proto Definition (`proto/voice_core.proto`)

Defines the gRPC service interface:
- `ExecutePrimitive` RPC - Execute capture primitives
- `StreamEvents` RPC - Server-side event streaming
- `HealthCheck` RPC - Health check endpoint

### 2. Voice Core gRPC Server (`voice-core/src/grpc/server.py`)

- Serves ExecutePrimitive requests
- Routes to correct primitive via `PrimitiveRegistry`
- Streams events back to orchestration
- Handles timeouts (30s default)
- Propagates trace_id through metadata

### 3. Orchestration gRPC Client (`orchestration/src/api/grpc-client.ts`)

- gRPC client with circuit breaker
- Handles failures gracefully
- Propagates trace_id
- Supports event streaming

### 4. Integration Test (`tests/integration/test_grpc_flow.py`)

End-to-end test verifying:
- Email capture execution
- Event streaming
- Trace ID propagation
- Timeout handling
- Error handling

## Setup Instructions

### 1. Install Dependencies

**Python (Voice Core):**
```bash
cd voice-core
poetry install
```

**TypeScript (Orchestration):**
```bash
cd voice-ai-os/orchestration
npm install
```

### 2. Generate gRPC Stubs (Python)

```bash
cd voice-core
python scripts/generate_grpc_stubs.py
```

This generates:
- `src/grpc/voice_core_pb2.py`
- `src/grpc/voice_core_pb2_grpc.py`

### 3. Run Voice Core gRPC Server

```bash
cd voice-core
python scripts/run_grpc_server.py --port 50051
```

### 4. Configure Orchestration

Set environment variable to use gRPC:

```bash
export VOICE_CORE_ENDPOINT=localhost:50051
export VOICE_CORE_USE_GRPC=true
```

### 5. Run Integration Tests

```bash
# From project root
pytest tests/integration/test_grpc_flow.py -v
```

## Features

### ✅ Trace ID Propagation

Trace IDs are propagated through gRPC metadata:
- Request: `trace_id` field in `ExecutePrimitiveRequest`
- Metadata: `trace-id` header in gRPC metadata
- Events: Included in all streamed events

### ✅ Timeout Handling

- Default: 30 seconds per primitive
- Configurable via `timeout_seconds` in request
- Returns `TIMEOUT` error if exceeded

### ✅ Circuit Breaker

TypeScript client implements circuit breaker:
- Opens after 5 consecutive failures
- Closes after 2 successful requests in half-open state
- Prevents cascading failures

### ✅ Graceful Degradation

If Voice Core is down:
- Circuit breaker opens
- Requests fail fast with `CIRCUIT_BREAKER_OPEN` error
- Orchestration can handle gracefully

## Testing

### Manual Test

1. Start Voice Core server:
```bash
cd voice-core
python scripts/run_grpc_server.py
```

2. Test with curl (using grpcurl):
```bash
grpcurl -plaintext -d '{
  "objective_type": "capture_email_au",
  "conversation_id": "test-001",
  "trace_id": "trace-001",
  "purpose": "Test",
  "params": {
    "transcription": "jane@gmail.com",
    "confidence": "0.85",
    "confirmation": "yes"
  }
}' localhost:50051 voice_core.VoiceCoreService/ExecutePrimitive
```

### Integration Test

```bash
pytest tests/integration/test_grpc_flow.py -v
```

## Latency Metrics

The gRPC server tracks execution metadata:
- `duration_ms` - Total execution time
- `retry_count` - Number of retries
- `confidence` - ASR confidence score
- `state` - Final state machine state

## Next Steps

1. Generate proto stubs for Python
2. Test end-to-end email capture flow
3. Verify event streaming works
4. Measure latency metrics
5. Test circuit breaker behavior

## Troubleshooting

### Proto stubs not found

Run: `python voice-core/scripts/generate_grpc_stubs.py`

### Connection refused

Ensure Voice Core server is running on port 50051

### Circuit breaker stuck open

Reset: `client.resetCircuitBreaker()` (for testing)
