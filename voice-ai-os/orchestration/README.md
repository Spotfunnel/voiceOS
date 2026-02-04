# Orchestration Service - Layer 2

**Production Voice AI Platform - Orchestration Layer**

This is the Orchestration Layer (Layer 2) of the three-layer Voice AI architecture. It is responsible for loading customer objective graphs, executing objectives in sequence, and managing state transitions through event sourcing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Orchestration (Stateless, Event-Sourced)         │
│ - Load customer objective graph (DAG)                      │
│ - Execute objectives in sequence                           │
│ - Manage state transitions (event-sourced)                 │
│ - Emit events for observability/workflow triggers          │
└───────────────────┬─────────────────────────────────────────┘
                    │ gRPC/HTTP control channel
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Voice Core (Immutable, Shared)                   │
│ - Primitives (capture_email_au, capture_phone_au, etc.)  │
│ - STT → LLM → TTS pipeline                                 │
└─────────────────────────────────────────────────────────────┘
```

## Key Principles

- **Stateless Execution**: All state reconstructed from events (event sourcing)
- **Declarative Configuration**: Objectives declare WHAT to capture, not HOW
- **DAG Validation**: Objective graphs must be acyclic (no cycles)
- **Event-Driven**: Emits events for Layer 3 (workflows) to consume asynchronously
- **No Business Logic**: Layer 2 only orchestrates, doesn't execute business logic

## Project Structure

```
orchestration/
├── src/
│   ├── services/
│   │   └── orchestration-engine.ts    # Main orchestration engine
│   ├── config/
│   │   └── config-service.ts          # Configuration loading & validation
│   ├── events/
│   │   └── event-bus.ts               # In-memory event bus (Kafka/Postgres later)
│   ├── api/
│   │   └── voice-core-client.ts       # gRPC/HTTP client to Voice Core
│   ├── models/
│   │   ├── config.model.ts            # Configuration types
│   │   └── objective.model.ts         # Objective types
│   ├── main.ts                        # HTTP API server (Fastify)
│   └── index.ts                       # Public API exports
├── examples/
│   └── config.example.yaml            # Example configuration
├── tests/                             # Test files (to be added)
├── package.json
├── tsconfig.json
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn

### Installation

```bash
cd orchestration
npm install
```

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

This starts the service with hot-reload using `tsx watch`.

### Production

```bash
npm run build
npm start
```

## Configuration

### Environment Variables

```bash
# Voice Core endpoint (Layer 1)
VOICE_CORE_ENDPOINT=http://localhost:8000

# Use gRPC instead of HTTP (default: false)
VOICE_CORE_USE_GRPC=false

# Server configuration
PORT=3000
HOST=0.0.0.0

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Configuration Schema

Customer configurations are declarative YAML/JSON files that define objective graphs:

```yaml
tenant_id: acme_plumbing
tenant_name: Acme Plumbing Services
locale: en-AU
schema_version: v1

objectives:
  - id: capture_email
    type: capture_email_au
    purpose: appointment_confirmation
    required: true
    max_retries: 3
    on_success: capture_phone
    on_failure: escalate_to_human
    escalation: transfer

  - id: capture_phone
    type: capture_phone_au
    purpose: callback
    required: true
    max_retries: 3
    on_success: capture_appointment_time
    escalation: transfer

  - id: capture_appointment_time
    type: capture_datetime_au
    purpose: booking
    required: true
    max_retries: 3
    on_success: end_call
    escalation: transfer

workflow_webhook_url: https://customer-n8n-instance.com/webhook/voice-ai
```

See `examples/config.example.yaml` for a complete example.

## API Endpoints

### Health Check

```bash
GET /health
```

Returns service health status and Voice Core connectivity.

### Start Conversation

```bash
POST /api/v1/conversations/start
Content-Type: application/json

{
  "tenant_id": "acme_plumbing",
  "conversation_id": "optional-uuid",
  "config": { ... }  # TenantConfig object
}
```

Starts a new conversation with the provided configuration. Returns `conversation_id`.

### Get Conversation Events

```bash
GET /api/v1/conversations/:conversation_id/events
```

Returns all events for a conversation (event sourcing).

### Load Configuration

```bash
POST /api/v1/config/load
Content-Type: application/json

{
  "file_path": "/path/to/config.yaml"
}
```

Loads and validates a configuration from file.

### Validate Configuration

```bash
POST /api/v1/config/validate
Content-Type: application/json

{
  "config": { ... }  # TenantConfig object
}
```

Validates a configuration without loading it.

## Architecture Compliance

This implementation follows the architecture laws:

- ✅ **R-ARCH-001**: Three-Layer Architecture (Orchestration only)
- ✅ **R-ARCH-003**: Objectives are Declarative (not Imperative)
- ✅ **D-ARCH-005**: Objective Graph is DAG (validated)
- ✅ **D-ARCH-006**: Configuration Schema is Versioned and Validated
- ✅ **D-ARCH-009**: Orchestration Layer is Stateless (Event-Sourced)
- ✅ **R-ARCH-009**: Events Emitted for Observability

## Event Types

The orchestration service emits the following events:

- `conversation_started` - Conversation begins
- `objective_started` - Objective execution begins
- `objective_completed` - Objective completed successfully
- `objective_failed` - Objective failed after max retries
- `objective_skipped` - Non-required objective skipped
- `conversation_ended` - Conversation ends (completed/failed/aborted)

All events follow the immutable event schema (D-ARCH-007).

## Development Status

### ✅ Completed (Day 1 - Hours 1-5)

- [x] Project setup with TypeScript
- [x] Configuration service with YAML/JSON loading
- [x] Schema validation (Zod)
- [x] DAG validation (no cycles)
- [x] Basic orchestration engine (sequential execution)
- [x] gRPC/HTTP interface to Voice Core
- [x] Event bus integration (in-memory)
- [x] HTTP API server (Fastify)
- [x] Event emission working

### 🚧 Future Enhancements

- [ ] Parallel objective execution (independent objectives)
- [ ] Conditional branching based on captured data
- [ ] Postgres/Kafka event store (replace in-memory)
- [ ] gRPC implementation (currently HTTP only)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Conversation resumption after interruption
- [ ] State snapshots for performance optimization

## Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

## Troubleshooting

### Voice Core Connection Issues

If the orchestration service cannot connect to Voice Core:

1. Check `VOICE_CORE_ENDPOINT` environment variable
2. Verify Voice Core is running: `curl http://localhost:8000/health`
3. Check network connectivity

### Configuration Validation Errors

If configuration validation fails:

1. Check schema version matches (`schema_version: v1`)
2. Verify all objectives have valid `type` (must be in `PrimitiveType` enum)
3. Ensure objective graph is acyclic (no cycles)
4. Check all `on_success`/`on_failure` references valid objective IDs

### Event Bus Issues

The current implementation uses an in-memory event bus. For production:

1. Replace `EventBus` with Kafka/Postgres implementation
2. Ensure event persistence for replay
3. Configure event retention policies

## License

MIT

## References

- Architecture Laws: `docs/ARCHITECTURE_LAWS.md`
- Three-Layer Architecture: `.cursor/skills/three-layer-architecture/SKILL.md`
- Backend Development: `.cursor/skills/backend-development/SKILL.md`
