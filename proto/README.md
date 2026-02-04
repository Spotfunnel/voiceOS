# gRPC Proto Definitions

This directory contains the Protocol Buffer definitions for Voice Core gRPC service.

## Files

- `voice_core.proto` - Main proto definition for Voice Core service

## Generating gRPC Stubs

### Python (Voice Core)

From the `voice-core` directory:

```bash
# Install dependencies first
cd voice-core
poetry install

# Generate Python stubs
python scripts/generate_grpc_stubs.py
```

This will generate:
- `voice-core/src/grpc/voice_core_pb2.py` - Message classes
- `voice-core/src/grpc/voice_core_pb2_grpc.py` - Service stubs

### TypeScript (Orchestration)

The TypeScript client loads the proto file dynamically at runtime using `@grpc/proto-loader`.

No code generation is needed - the proto file is loaded directly.

## Proto Service Definition

The `VoiceCoreService` provides:

1. **ExecutePrimitive** - Execute a capture primitive (e.g., capture_email_au)
2. **StreamEvents** - Stream events from primitive execution (server-side streaming)
3. **HealthCheck** - Health check endpoint

## Usage

### Python Server

```python
from src.grpc.server import serve

# Start server on port 50051
asyncio.run(serve(port=50051))
```

### TypeScript Client

```typescript
import { GrpcClient } from './api/grpc-client';

const client = new GrpcClient('localhost:50051');

// Execute primitive
const result = await client.executePrimitive(
  'capture_email_au',
  { transcription: 'jane@gmail.com', confidence: '0.85' },
  'conv-001',
  'trace-001',
  'Collect email'
);
```

## Testing

Run integration tests:

```bash
# From project root
pytest tests/integration/test_grpc_flow.py -v
```
