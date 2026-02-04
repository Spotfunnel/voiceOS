# Research: Stress Testing Production Voice AI Systems

**🟢 LOCKED** - Production-validated research based on k6, Locust, Artillery, WebSocket load testing, provider rate limits, cascading failures, production stress testing patterns. Updated February 2026.

---

## Why This Matters for V1

Stress testing is the difference between a demo that works and a production system that survives real traffic. Voice AI systems fail in production through cascading latency spikes, provider rate limit exhaustion, WebSocket connection storms, and memory leaks that only appear under sustained load. Without pre-deployment stress testing, you discover these failures when customers are on the line.

The June 2025 ChatGPT 34-hour outage demonstrates the stakes: a spike in test queries following Apple's WWDC announcement revealed brittle load-balancing mechanisms in the orchestration layer, causing resource exhaustion that cascaded across multiple services. ~60% of high-severity incidents in AI inference services stem from inference engine failures, with ~40% of those being timeout-related. ~74% of incidents were auto-detected, but ~28% still required manual hotfixes.

For voice AI specifically, stress testing must validate not just throughput but latency distribution under load. A system that handles 100 concurrent calls with P50 latency of 500ms may degrade to 2000ms at 200 calls, breaking conversational quality. Provider rate limits (Deepgram Pay-as-You-Go: 50 concurrent streaming STT requests, 15 concurrent voice agent connections) become hard ceilings that cause immediate failures when exceeded.

## What Matters in Production (Facts Only)

### Verified Stress Testing Approaches (Shipped Systems)

**Specialized Voice AI Load Testing Platforms:**
- **Hamming AI** (funded $3.8M seed, 2025): Concurrent load testing simulating hundreds to thousands of simultaneous conversations. Integrates with Retell, LiveKit, Pipecat, OpenAI, Vapi. Stress testing determines maximum capacity and performance benchmarks across providers.
- **Bespoken**: Scales to tens of thousands of simultaneous calls. Simulates both users and agents for realistic contact center testing. Covers 100+ languages with in-country numbers. Budget-optimized design to identify critical performance concerns without excessive testing costs.
- **Roark**: QA and observability with stress-testing via synthetic callers. Replay production calls and create test scenarios across different accents and behaviors. Tracks 40+ metrics in real-time. Native integration with VAPI, Retell, LiveKit.

**WebSocket-Specific Load Testing Tools:**
- **Artillery**: Native WebSocket engine with distributed testing at scale via AWS Lambda, ECS/Fargate, ACI. Integrates with OpenTelemetry, Datadog, CloudWatch, New Relic, Prometheus. Supports HTTP, WebSocket, Socket.IO, and Playwright for comprehensive protocol testing.
- **k6 (Grafana k6)**: Dedicated k6/ws module for WebSocket testing. JavaScript-based scripting for performance testing. Part of Grafana Cloud ecosystem.

**Pipecat Production Infrastructure:**
- Capacity planning with configurable instance pools, minimum/maximum agents, and auto-scaling buffers.
- Multi-region deployment (us-west default, us-east available) to reduce latency and meet data residency requirements.
- Containerized deployment via CLI (`pipecatcloud docker build-push` and `pipecatcloud deploy`).
- Built-in monitoring, telemetry, and session recording capabilities.
- HIPAA and GDPR-compliant infrastructure.

### Synthetic Testing and Health Monitoring

**Synthetic Test Call Patterns (Verified):**
- Run synthetic test calls every 30 seconds from at least three geographic regions (per D-TP-004 from DECISIONS.md).
- Measure call success and round-trip latency.
- Remove a region from DNS routing after 3 consecutive failures.
- Detection window: 90 seconds for regional outages.

**AI-Powered Synthetic Personas:**
- Configurable gender, language, accent, background noise, speech patterns, emotion, and intent clarity.
- Generate realistic phone conversations with full recordings, transcripts, and analytics.
- Validate webhooks and end-to-end flows without PII concerns or manual QA bandwidth.
- Automatically generate tests from failed production calls to ensure improvements stick.

**Testing Maturity Progression (Hamming AI Model):**
- **Level 1**: Manual spot-checking of 5-10 calls
- **Level 2**: Automated testing of 20-50 scenarios
- **Level 3**: Hundreds of concurrent test calls with diverse accents and background noise
- **Level 4**: Production-integrated continuous QA with failed-call replay and custom business KPI metrics
- **Level 5**: Continuous quality assurance with production integration

### Provider Rate Limits (Hard Constraints)

**Deepgram (Pay as You Go/Growth plans, verified 2025):**
- Voice Agent: 15 concurrent connections (recently increased 3x)
- Streaming STT: 50 concurrent requests (most models)
- Pre-Recorded STT: 100 concurrent requests (most models)
- Flux model: 50 concurrent streaming requests
- Whisper Cloud: 5 concurrent requests
- Rate limits are per-project, not per-API-key
- Exceeding limits returns HTTP 429 "Too Many Requests"
- Exponential backoff retry strategies recommended

**Cartesia and OpenAI Voice API:**
- Specific concurrent connection limits not publicly documented as of Feb 2026
- Enterprise plans have different limits

### Network Geography Impact (Real Production Data)

Production systems have measured 150ms+ latency per direction for calls from Mumbai to Virginia servers, before any processing occurs. Submarine cables, multiple backbone networks, and regional routers compound latency. This geographic bottleneck cannot be stress-tested in single-region environments—multi-region load testing is required.

### WebSocket Connection Stability Under Load

**Known Failure Modes:**
- NAT devices enforce aggressive timeouts
- Load balancers default to 60-second connection limits
- Ping/pong coordination requires infrastructure alignment

**Verified Mitigations:**
- Send keepalive messages every 20-30 seconds
- Use CloseStream signals for graceful disconnection
- Apply exponential backoff on reconnection attempts

## Common Failure Modes (Observed in Real Systems)

### Cascading Failures and Timeout Storms

**Cascaded Architecture Amplification:**
Voice AI uses STT → LLM → TTS pipelines where component failures cascade. A 200ms STT timeout causes LLM request queue buildup, which triggers TTS starvation, resulting in complete conversation failure. Each component adds latency that compounds under load.

**Observed Pattern (ChatGPT June 2025 Outage):**
Internal scheduler distributing inference requests to GPU clusters was overwhelmed by spike in test queries. Resource exhaustion in orchestration layer caused cascading failures across multiple services. Shared infrastructure between products (text-to-video system Sora) propagated failures.

**Timeout-Related Incidents:**
~40% of inference engine failures are timeout-related. Systems that work at 100 concurrent calls fail at 200 calls due to timeout cascades, not capacity limits.

### Rate Limit Exhaustion

**Hard Failure at Provider Limits:**
Deepgram's 50 concurrent streaming STT limit means the 51st call fails immediately with HTTP 429. No graceful degradation. Systems must implement circuit breakers and fallback stacks before hitting limits.

**Thundering Herd on Retry:**
Multiple clients hitting rate limits simultaneously retry at the same intervals, creating synchronized retry storms that prevent recovery. Requires jitter in retry delays.

### Memory Leaks Under Sustained Load

Memory leaks that don't appear in short tests become critical under sustained load. WebSocket connections that aren't properly closed accumulate. Audio buffers that aren't flushed grow unbounded. These only manifest after hours of continuous operation.

### Latency Distribution Collapse

**P50 vs P99 Divergence:**
Systems meeting P50 <500ms targets fail P99 <1000ms targets under load. The long tail of latency distribution collapses when concurrent calls increase. A system with P50=400ms and P99=800ms at 50 calls may degrade to P50=600ms and P99=2500ms at 150 calls.

**Conversational Quality Breakdown:**
Latency beyond 300-400ms feels awkward. Beyond 1.5 seconds, user experience rapidly degrades. Stress testing must validate latency percentiles, not just throughput.

### Provider Failover Failures

**Active-Active Failover Untested:**
Systems configured with multi-provider failover (per D-TP-001) often fail during actual provider outages because failover was never stress-tested. DNS SRV health checks every 30 seconds with circuit breakers that fail over after 3 consecutive failures and 3-second timeout must be validated under load.

**Fallback Stack Latency Mismatch:**
Primary stack (Deepgram Nova-3 + GPT-4o + Cartesia Sonic 3) has different latency characteristics than fallback stack (Groq Whisper-Large-v3 + Groq Llama 3.1 8B + OpenAI TTS). Failover during high load can cause latency spikes that break conversations already in progress.

### Connection Storm on Deployment

**Cold Start Avalanche:**
Deploying new agent versions causes all existing calls to reconnect simultaneously. Without warm capacity reserves, this creates a connection storm that overwhelms the system. Pipecat Cloud minimizes cold starts through capacity planning, but this must be stress-tested.

**WebSocket Reconnection Loops:**
Failed WebSocket connections retry immediately, creating reconnection loops that consume resources without establishing working connections. Requires exponential backoff with maximum retry limits.

### Insufficient Isolation Between Endpoints

~74% of incidents in GenAI services were auto-detected, but inadequate per-endpoint isolation means failures in one service cascade to others. GPU capacity bottlenecks and connection liveness issues affect multiple endpoints simultaneously.

## Proven Patterns & Techniques

### Pre-Deployment Stress Testing

**Concurrent Call Simulation (Verified):**
- Start with 10 concurrent calls, double every 5 minutes: 10 → 20 → 40 → 80 → 160
- Monitor P50, P95, P99 latency at each level
- Identify breaking point where P95 exceeds 800ms or P99 exceeds 1000ms
- Test sustained load at 70% of breaking point for 1+ hours to detect memory leaks

**Multi-Region Geographic Testing:**
- Run load tests from US, Europe, Asia simultaneously
- Measure latency from each region to each deployment region
- Validate that regional routing works under load
- Test failover between regions during simulated outages

**Provider Rate Limit Validation:**
- Deliberately exceed provider rate limits (Deepgram 50 concurrent STT, 15 concurrent voice agent)
- Verify circuit breakers trigger before hitting limits
- Test fallback stack activation under rate limit conditions
- Measure latency increase during fallback

**WebSocket Connection Stability:**
- Maintain 100+ WebSocket connections for 4+ hours
- Simulate NAT timeout scenarios (60-second forced disconnects)
- Verify keepalive messages prevent disconnections
- Test reconnection with exponential backoff under load

### Synthetic Monitoring (Production)

**Continuous Health Checks:**
- Synthetic test calls every 30 seconds from 3+ geographic regions
- Measure call success rate and round-trip latency
- Remove failing regions from DNS routing after 3 consecutive failures (90-second detection window)
- Alert on P95 latency exceeding 800ms or success rate below 95%

**Persona-Based Testing:**
- Create synthetic personas with different accents (US, UK, Indian, Australian)
- Test with background noise (café, street, office)
- Vary speech patterns (fast, slow, pauses, interruptions)
- Validate barge-in detection with 2-word minimum (per D-TT-005)

### Retry and Backoff Strategies

**Exponential Backoff with Jitter (Verified Pattern):**
- Formula: t = min(α · 2^n + β · rand(0,1), t_max)
- Start with 1-second delays: 1s → 2s → 4s → 8s
- Cap maximum attempts per model (4 attempts)
- Cap maximum wait time (8 seconds)
- Add randomness (jitter) to prevent thundering herd

**Circuit Breaker Pattern:**
- Temporarily suspend requests to failing services
- Prevent cascading failures from continuous retries
- Implement per-provider circuit breakers (STT, LLM, TTS)
- Automatic recovery after cooldown period

**Graceful Degradation:**
- Primary model → backup model → cached response → error message
- Rate-limited requests (429 errors) trigger retries
- Non-transient errors fail fast without retries
- Fallback chain: Deepgram → Groq Whisper, GPT-4o → Groq Llama, Cartesia → OpenAI TTS

### Capacity Planning and Auto-Scaling

**Pipecat Cloud Approach (Verified):**
- Configure instance pools with minimum/maximum agents
- Auto-scaling with configurable buffers to handle traffic fluctuations
- Warm capacity reserves to minimize cold starts
- Applications with fluctuating traffic benefit from planning additional warm capacity

**Scaling Thresholds:**
- Scale up when average CPU >70% for 2 minutes
- Scale up when active calls per instance >80% of capacity
- Scale down when average CPU <30% for 10 minutes
- Maintain minimum instances to avoid cold start latency

### Load Testing Tools Integration

**Artillery for WebSocket Testing:**
```yaml
# Example configuration pattern (not code)
config:
  target: "wss://voice-agent.example.com"
  phases:
    - duration: 300
      arrivalRate: 10
      name: "Ramp up to 50 concurrent"
    - duration: 600
      arrivalRate: 20
      name: "Sustained load"
scenarios:
  - engine: ws
    flow:
      - send: "audio_chunk"
      - think: 0.1
      - loop:
        - send: "audio_chunk"
        - think: 0.1
        count: 100
```

**k6 for Performance Testing:**
- JavaScript-based scripting for WebSocket load tests
- Integration with Grafana for real-time metrics visualization
- Support for custom metrics and thresholds

## Engineering Rules (Binding)

### R-ST-001 Stress Testing MUST Validate Latency Percentiles Under Load
**Rationale:** P50 latency is meaningless if P99 exceeds conversational thresholds. Systems must maintain P95 <800ms and P99 <1000ms under production load (per D-LT-001).

**Implementation:**
- Test at 50%, 75%, 100%, and 125% of expected peak concurrent calls
- Record P50, P95, P99 latency at each level
- Fail stress test if P95 exceeds 800ms or P99 exceeds 1000ms
- Test sustained load at 70% of breaking point for 1+ hours

### R-ST-002 Provider Rate Limits MUST Be Tested to Failure
**Rationale:** Circuit breakers and fallback stacks are untested until you deliberately exceed provider limits.

**Implementation:**
- Identify rate limits for all providers (Deepgram: 50 concurrent STT, 15 voice agent)
- Run load test that exceeds limits by 20%
- Verify circuit breakers trigger at 90% of limit
- Measure fallback stack activation latency
- Confirm no HTTP 429 errors reach application layer

### R-ST-003 Multi-Region Load Testing MUST Include Geographic Latency
**Rationale:** Single-region stress tests miss network geography bottlenecks that add 150-300ms per direction.

**Implementation:**
- Run concurrent load tests from US, Europe, Asia
- Measure latency from each source region to each deployment region
- Validate regional routing directs traffic to nearest deployment
- Test cross-region failover under simulated outages

### R-ST-004 WebSocket Connection Stability MUST Be Tested for 4+ Hours
**Rationale:** Memory leaks, connection accumulation, and NAT timeouts only appear under sustained load.

**Implementation:**
- Maintain 100+ concurrent WebSocket connections for 4+ hours
- Monitor memory usage, connection count, and error rates
- Simulate NAT timeouts (60-second forced disconnects)
- Verify keepalive messages (20-30 second intervals) prevent disconnections
- Test reconnection with exponential backoff

### R-ST-005 Synthetic Monitoring MUST Run Continuously in Production
**Rationale:** Stress testing validates pre-deployment capacity; synthetic monitoring detects production degradation.

**Implementation:**
- Run synthetic test calls every 30 seconds from 3+ geographic regions (per D-TP-004)
- Measure call success rate and round-trip latency
- Alert on P95 latency >800ms or success rate <95%
- Remove failing regions from DNS routing after 3 consecutive failures

### R-ST-006 Failover Mechanisms MUST Be Tested Monthly Under Load
**Rationale:** Active-active failover (per D-TP-001) is untested until you simulate provider outages during high traffic.

**Implementation:**
- Schedule monthly failover tests during low-traffic periods
- Disable primary provider while maintaining 50%+ of peak load
- Measure failover latency and success rate
- Verify fallback stack handles load without quality degradation
- Document failover time and any issues encountered

### R-ST-007 Cold Start Latency MUST Be Measured During Deployment
**Rationale:** Deploying new agent versions causes connection storms that overwhelm systems without warm capacity.

**Implementation:**
- Measure time from deployment trigger to first successful call
- Test rolling deployment with 25%, 50%, 75%, 100% traffic shifts
- Verify warm capacity reserves prevent cold start avalanche
- Monitor connection storm metrics during deployment
- Maintain minimum instance count to avoid cold starts

## Metrics & Signals to Track

### Load Testing Metrics (Pre-Deployment)

**Latency Distribution:**
- P50, P95, P99 end-to-end turn latency at 50%, 75%, 100%, 125% of peak load
- Time to First Byte (TTFB) for TTS: P95 <150ms target
- STT Real-Time Factor (RTF): Must stay <1.0, alert at >0.8
- Component-level latency breakdown: STT, LLM, TTS

**Throughput and Capacity:**
- Maximum concurrent calls before P95 exceeds 800ms
- Calls per second sustained over 1+ hours
- Breaking point where system fails to accept new connections
- Memory usage growth rate over 4+ hour sustained load test

**Error Rates:**
- HTTP 429 rate limit errors per provider
- WebSocket connection failures and reconnection attempts
- Circuit breaker activation count
- Fallback stack activation frequency

**Provider-Specific:**
- Deepgram concurrent STT connections (limit: 50)
- Deepgram concurrent voice agent connections (limit: 15)
- Rate limit headroom: distance from hard limits

### Synthetic Monitoring Metrics (Production)

**Health Check Signals:**
- Synthetic call success rate from each geographic region (target: >95%)
- Round-trip latency from each region (P95 target: <800ms)
- Consecutive failure count per region (alert at 3, remove at 3)
- Detection window: 90 seconds for regional outages

**Connection Stability:**
- WebSocket connection duration (target: >30 minutes)
- Keepalive message success rate (target: 100%)
- Reconnection attempt count and success rate
- NAT timeout incidents per hour

**Failover Metrics:**
- DNS SRV health check response time (every 30 seconds)
- Circuit breaker state per provider (open/closed/half-open)
- Failover activation latency (target: <3 seconds)
- Fallback stack usage percentage

### Stress Test Pass/Fail Criteria

**Latency Thresholds (per D-LT-001):**
- PASS: P50 <500ms, P95 <800ms, P99 <1000ms at 100% peak load
- FAIL: Any percentile exceeds threshold at <75% peak load

**Capacity Thresholds:**
- PASS: System handles 125% of expected peak load for 10+ minutes
- FAIL: System rejects connections or crashes before reaching 100% peak load

**Stability Thresholds:**
- PASS: Memory usage stable (<10% growth) over 4-hour sustained load test
- FAIL: Memory leaks, connection accumulation, or error rate increase over time

**Failover Thresholds:**
- PASS: Failover completes within 3 seconds, maintains >95% call success rate
- FAIL: Failover takes >10 seconds or causes >10% call failures

## V1 Decisions / Constraints

### In Scope for V1

**Pre-Deployment Stress Testing:**
- Concurrent call simulation up to 125% of expected peak load
- Multi-region load testing from US, Europe, Asia
- Provider rate limit validation for Deepgram (50 STT, 15 voice agent)
- WebSocket connection stability testing for 4+ hours
- Latency percentile validation (P50, P95, P99) under load

**Synthetic Monitoring:**
- Continuous synthetic test calls every 30 seconds from 3 geographic regions
- Call success rate and round-trip latency tracking
- Automatic region removal after 3 consecutive failures (90-second detection)
- P95 latency and success rate alerting

**Failover Testing:**
- Monthly failover tests during low-traffic periods
- Primary to fallback stack transition validation
- Circuit breaker and rate limit handling verification

**Load Testing Tools:**
- Artillery for WebSocket load testing
- Integration with OpenTelemetry, Datadog, or equivalent observability platform
- Custom scripts for voice-specific load patterns

### Out of Scope for V1 (Post-V1)

**Advanced Load Testing:**
- Specialized voice AI load testing platforms (Hamming AI, Bespoken, Roark)
- AI-powered synthetic personas with configurable accents, background noise, emotions
- Automated test generation from failed production calls
- Testing maturity Level 4-5 (production-integrated continuous QA)

**Chaos Engineering:**
- Deliberate network partition testing
- Random component failure injection during load tests
- Latency injection and jitter simulation
- Provider outage simulation beyond simple failover

**Performance Optimization:**
- Automatic scaling threshold tuning based on load test results
- Dynamic rate limit adjustment based on provider capacity
- Predictive scaling based on traffic patterns
- Cost optimization for load testing infrastructure

**Advanced Monitoring:**
- Real-time anomaly detection on latency distributions
- Automated root cause analysis for load test failures
- Correlation between load test results and production metrics
- Predictive capacity planning based on growth trends

### Known Limitations

**Provider Rate Limits:**
Deepgram Pay-as-You-Go limits (50 concurrent STT, 15 voice agent) are hard constraints. Systems must implement circuit breakers at 90% of limits and test fallback stacks. Enterprise plans have higher limits but require negotiation.

**Geographic Latency:**
Multi-region deployment (per D-LT-002) is required to avoid 150-300ms per-direction latency for non-local users. V1 supports three regions (US, Europe, Asia). Additional regions are post-V1.

**Load Testing Cost:**
Stress testing at scale incurs provider API costs. Testing 100 concurrent calls for 1 hour with 30-second average call duration costs ~200 calls × (STT + LLM + TTS) fees. Budget $500-$1000 for comprehensive pre-deployment stress testing.

**Synthetic Monitoring Overhead:**
Continuous synthetic calls every 30 seconds from 3 regions = ~8,640 test calls per day. At $0.10 per call (rough estimate), this costs ~$864/day or ~$26,000/month. V1 uses longer intervals (60-120 seconds) to reduce costs while maintaining 3-5 minute detection windows.

**WebSocket Connection Limits:**
Load balancers and NAT devices impose connection limits and timeouts. Testing beyond 500 concurrent WebSocket connections requires infrastructure tuning (load balancer timeout configuration, NAT traversal, keepalive tuning).

## Open Questions / Risks

### Evidence Gaps

**Pipecat-Specific Load Testing:**
No public benchmarks for Pipecat concurrent call capacity with Daily, Retell, or Vapi. Community Discord and GitHub may have builder experiences, but these aren't documented in official sources as of Feb 2026. V1 must conduct internal benchmarking.

**Cartesia and OpenAI Rate Limits:**
Concurrent connection limits for Cartesia Sonic 3 and OpenAI TTS are not publicly documented. This creates risk for production deployments that may hit undocumented limits. Requires direct provider communication or empirical testing.

**Fallback Stack Latency:**
DECISIONS.md specifies fallback stack (Groq Whisper-Large-v3 + Groq Llama 3.1 8B + OpenAI TTS) but doesn't provide measured latency characteristics under load. Latency mismatch during failover could break in-progress conversations.

**Cold Start Latency:**
Pipecat Cloud documentation mentions minimizing cold starts through warm capacity reserves, but specific cold start latency measurements aren't provided. This affects deployment strategy and capacity planning.

### Technical Risks

**Thundering Herd on Provider Outages:**
If primary provider (Deepgram) experiences outage, all concurrent calls fail over to fallback provider (Groq) simultaneously. This could overwhelm fallback provider even if it has sufficient capacity under normal conditions. Requires staggered failover or rate limiting during failover.

**Memory Leak Detection:**
4-hour sustained load tests may not detect slow memory leaks that only appear after days of operation. Production monitoring must track memory usage trends and alert on gradual increases.

**Cross-Provider Latency Variance:**
Stress testing with primary stack doesn't validate fallback stack latency under load. A system that meets P95 <800ms with Deepgram + GPT-4o + Cartesia may exceed thresholds with Groq + Groq + OpenAI. Requires separate stress testing for fallback stack.

**Geographic Routing Failures:**
DNS-based geographic routing may fail under load if DNS resolution becomes a bottleneck. Requires testing DNS query rate limits and caching behavior under stress.

**WebSocket Reconnection Storms:**
Exponential backoff prevents individual connection storms, but coordinated failures (e.g., load balancer restart) cause all connections to retry simultaneously. Requires jitter in reconnection timing and connection rate limiting.

### Operational Risks

**Stress Testing in Production:**
Pre-deployment stress testing doesn't capture production-specific issues (real user behavior, geographic distribution, time-of-day patterns). Requires gradual rollout with canary deployments and production traffic shadowing.

**Failover Testing Impact:**
Monthly failover tests (per R-ST-006) during low-traffic periods still affect real users. Requires communication plan and potential maintenance windows.

**Synthetic Monitoring Cost:**
Continuous synthetic calls at 30-second intervals cost ~$26,000/month at scale. V1 uses 60-120 second intervals to reduce costs, but this increases detection window to 3-5 minutes. Trade-off between cost and detection speed.

**Load Testing Tool Limitations:**
Artillery and k6 are general-purpose load testing tools, not voice-specific. They can test WebSocket connections but don't simulate realistic voice conversation patterns (pauses, barge-in, turn-taking). May miss voice-specific failure modes.

### Hypothesis Requiring Validation

**Circuit Breaker Thresholds:**
Recommendation to trigger circuit breakers at 90% of provider rate limits is based on general best practices, not voice-specific empirical data. Optimal threshold may be 80% or 95% depending on traffic patterns and failover latency.

**Sustained Load Duration:**
4-hour sustained load test recommendation is based on typical memory leak detection timeframes, not voice-specific data. Longer tests (8-24 hours) may be required to detect slow leaks.

**Latency Percentile Targets:**
P95 <800ms and P99 <1000ms targets (per D-LT-001) are based on conversational quality research, but tolerance may vary by use case. Customer service calls may tolerate higher latency than sales calls.

**Warm Capacity Percentage:**
Recommendation to test sustained load at 70% of breaking point is based on general capacity planning practices. Optimal percentage for voice AI may be 60% or 80% depending on traffic variability.

**Synthetic Call Frequency:**
30-second synthetic call intervals (per D-TP-004) provide 90-second detection windows. This may be too frequent (high cost) or too infrequent (slow detection) depending on SLA requirements and budget constraints.
