# Voice AI Monitoring & Observability

Production monitoring and observability system for Voice AI platform.

## Features

- **Metrics Collection**: Collects metrics from event stream (latency, cost, health)
- **Latency Tracking**: P50/P95/P99 percentiles for end-to-end and component-level latency
- **Cost Tracking**: Per-call, per-tenant, per-provider cost tracking
- **Health Monitoring**: Worker health, circuit breaker status, provider health
- **Alerting**: Slack webhook integration with deduplication
- **Metrics API**: REST API + WebSocket for real-time metrics
- **Grafana Dashboards**: Pre-built dashboards for visualization

## Architecture

```
Event Bus → Metrics Service → Collectors → TimescaleDB
                              ↓
                         Alerting Service → Slack
                              ↓
                         Metrics API → Grafana
```

## Setup

### 1. Install Dependencies

```bash
cd monitoring
npm install
```

### 2. Setup TimescaleDB

```bash
# Run schema migration
psql -U spotfunnel -d spotfunnel -f schema/metrics.sql
```

### 3. Configure Environment Variables

```bash
export DATABASE_URL="postgresql://spotfunnel:dev@localhost:5432/spotfunnel"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export METRICS_API_PORT=3001
```

### 4. Build and Run

```bash
npm run build
npm start
```

## API Endpoints

### REST API

- `GET /metrics/latency?tenant_id=xxx&component=turn_e2e&start_time=...&end_time=...`
  - Returns P50/P95/P99 latency percentiles

- `GET /metrics/cost?trace_id=xxx` or `?tenant_id=xxx&month=...`
  - Returns cost per call or monthly cost per tenant

- `GET /metrics/health?component=worker|circuit_breaker|provider`
  - Returns health metrics

- `GET /metrics/calls?tenant_id=xxx&start_time=...&end_time=...`
  - Returns call metrics (total, success rate, failure reasons)

### WebSocket

Connect to `ws://localhost:3001` for real-time metrics updates.

## Alert Rules

Default alert rules:

1. **P95 Latency > 800ms** (Critical)
   - Component: `turn_e2e`
   - Threshold: 800ms

2. **Cost per Call > $0.20** (Warning)
   - Threshold: $0.20/min

3. **Circuit Breaker Open > 5 minutes** (Critical)
   - Threshold: 5 minutes

4. **Worker Memory > 80%** (Warning)
   - Threshold: 80%

5. **Provider Downtime > 2 minutes** (Critical)
   - Threshold: 2 minutes

## Grafana Dashboards

Import dashboards from `dashboards/` directory:

1. **voice-core-latency.json**: P50/P95/P99 latency over time
2. **cost-tracking.json**: Cost per call, per tenant, per provider
3. **system-health.json**: Worker health, circuit breakers, providers
4. **call-quality.json**: Success rate, failure reasons, call duration

## Database Schema

### TimescaleDB Hypertables

- `metrics_latency`: Component-level latency metrics
- `metrics_cost`: Cost metrics per provider/service
- `metrics_health`: Health metrics (workers, circuit breakers, providers)
- `metrics_calls`: Aggregated call-level metrics
- `alert_history`: Alert firing history

### Continuous Aggregates

- `latency_percentiles_5m`: Pre-calculated P50/P95/P99 percentiles (5-minute buckets)
- `cost_per_call`: Cost breakdown per call
- `cost_per_tenant_monthly`: Monthly cost per tenant

## Integration with Event Bus

The monitoring service subscribes to events from the event bus:

```typescript
import { MonitoringService } from './monitoring/src/index.js';
import { eventBus } from './orchestration/src/events/event-bus.js';

const monitoringService = new MonitoringService(
  process.env.DATABASE_URL!,
  process.env.SLACK_WEBHOOK_URL
);

// Subscribe to events
eventBus.on('*', async (event) => {
  await monitoringService.processEvent(event);
});
```

## Metrics Collected

### Latency Metrics

- End-to-end turn latency (user stops → agent starts)
- STT latency (audio → transcript)
- LLM TTFT (Time to First Token)
- TTS TTFB (Time to First Byte)
- Network latency

### Cost Metrics

- STT cost (per minute): Deepgram, AssemblyAI, GPT-4o-audio
- LLM cost (per token): GPT-4o input/output
- TTS cost (per character): Cartesia, ElevenLabs
- Total cost per call
- Monthly cost per tenant

### Health Metrics

- Worker memory/CPU usage
- Active calls per worker
- Circuit breaker status (open/closed/half-open)
- Provider uptime and error rates
- Database connection pool status
- Redis cache hit rate

## Alert Deduplication

Alerts are deduplicated within a 5-minute window to prevent spam. Same alert type for the same component/tenant will only fire once per window.

## Production Considerations

1. **TimescaleDB**: Required for efficient time-series queries. Install TimescaleDB extension in PostgreSQL.

2. **Buffer Size**: Metrics are buffered and flushed every 5 seconds or when buffer reaches 100 items.

3. **Alert Thresholds**: Adjust thresholds based on your SLA requirements.

4. **Retention**: Configure data retention policies in TimescaleDB for cost optimization.

5. **Scaling**: Run multiple instances behind a load balancer for high-volume deployments.

## Development

```bash
# Run in development mode (watch mode)
npm run dev

# Run tests
npm test

# Build
npm run build
```

## License

MIT
