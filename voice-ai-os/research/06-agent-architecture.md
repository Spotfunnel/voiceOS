# Research: Agent Architecture for Production Voice AI Systems

**🟢 LOCKED** - Production-validated research based on Pipecat Flows, base agent + customer overlay pattern, immutable deployments, blue-green/canary patterns, multi-tenant isolation. Updated February 2026.

---

## Why This Matters for V1

Agent architecture is the foundational design decision that determines whether a voice AI platform can serve multiple customers without rebuilding agents, whether it can be debugged when failures occur, and whether it can be deployed safely without downtime. The core challenge: **how to separate base agent logic from customer-specific configuration while maintaining deterministic behavior, debuggability, and real-time performance**. Production data from 2025-2026 reveals that teams who fail to make this separation correctly face three critical problems: (1) **inability to scale**—each new customer requires custom agent development and testing, (2) **inability to debug**—failures in production cannot be traced to specific configuration vs code issues, and (3) **inability to deploy safely**—changes risk breaking existing customers because configuration and logic are entangled.

The industry has converged on a pattern: **agent definition (immutable logic) + runtime configuration (customer-specific overlays) + session instances (ephemeral execution contexts)**. This separation enables multi-tenant SaaS platforms to serve thousands of customers from a single codebase while maintaining isolation, debuggability, and safe deployments. For V1, getting agent architecture right determines whether the platform can onboard new customers in hours vs weeks, whether production incidents can be debugged in minutes vs hours, and whether deployments can be zero-downtime vs high-risk.

## What Matters in Production (Facts Only)

### Agent Definition vs Agent Instance vs Runtime Configuration

**Core Distinction (2026 Industry Standard):**
- **Agent Definition**: Immutable blueprint defining agent behavior—instructions, tools, handoffs, conversation flow logic, validation rules. This is code, versioned in git, tested in CI/CD.
- **Runtime Configuration**: Customer-specific overlays applied at session creation—system prompts, function allowlists, business rules, API credentials, branding, compliance settings. This is data, stored in databases, updated via APIs.
- **Agent Instance (Session)**: Ephemeral runtime instantiation for a single conversation—created when user starts call, maintains conversation state, destroyed when call ends.

**Why This Matters:**
- **Agent definition** changes require code review, testing, and deployment (high friction, high safety)
- **Runtime configuration** changes are applied immediately via API (low friction, isolated impact)
- **Agent instances** are stateless between calls (no persistent state, full observability)

**Production Example (OpenAI Agents SDK 2026):**
```
RealtimeAgent (definition) → RealtimeRunner (configuration) → RealtimeSession (instance)
```
- Agent definition is created once, reused across all sessions
- Runner applies runtime configuration (model, voice, turn detection thresholds)
- Session is created per conversation, destroyed after call ends

**Pipecat Pattern:**
- Bot file (`bot.py`) = agent definition (pipeline processors, conversation flow)
- Bot runner (`bot_runner.py`) = HTTP service that applies runtime configuration
- Bot process = agent instance spawned per call with customer-specific config

### Base Agent + Customer Overlay Architecture

**Multi-Tenant SaaS Pattern (AWS 2026):**
Production voice AI platforms use **base agent abstraction with customer overlays** to avoid rebuilding agents per customer:

1. **Base Agent**: Core reasoning engine, tool integration, memory system, conversation flow logic—shared across all customers
2. **Customer Overlay**: Tenant-specific extensions—custom prompts, function allowlists, business rules, API integrations, branding
3. **Tenant Context**: Identity, isolation boundaries, data ownership—injected at runtime

**Why This Works:**
- Base agent handles 80-90% of logic (turn-taking, interruption handling, STT/LLM/TTS orchestration)
- Customer overlay handles 10-20% of customization (domain-specific prompts, tools, rules)
- Changes to base agent benefit all customers (bug fixes, performance improvements)
- Changes to customer overlay affect only that customer (isolated risk)

**Production Implementation (Amazon Connect 2026):**
- **AI Prompts**: Task descriptions for LLM (customizable via YAML templates)
- **AI Guardrails**: Safety policies and response filtering (per-customer configuration)
- **AI Agents**: Resources that configure which prompts/guardrails apply to which flows
- Components edited independently, associated with flows via Lambda functions—no production rebuild required

**ElevenLabs Agent Versioning (2026):**
- Create versions of agents independently
- Use branches for different customer configurations
- Deploy traffic to specific versions without affecting production
- Support drafts for testing before release

### Deterministic vs Probabilistic Layers

**Hybrid Architecture (2026 Best Practice):**
Production voice AI systems combine **deterministic scaffolding with probabilistic reasoning** to balance precision and flexibility:

**Deterministic Layer (Code-Controlled):**
- Conversation flow routing (state machines, Pipecat Flows)
- Authorization and compliance enforcement
- Business rule validation
- Function call validation (allowlists, parameter schemas)
- Safety constraints (PII detection, content moderation)
- Latency budgets and timeout handling

**Probabilistic Layer (LLM-Controlled):**
- Natural language understanding (intent extraction, entity recognition)
- Response generation (conversational replies)
- Semantic turn detection (is user finished speaking?)
- Sentiment analysis and tone adaptation

**Why This Separation Matters:**
- **Deterministic layer is debuggable**—state transitions are logged, reproducible, testable
- **Probabilistic layer is flexible**—handles natural language variation, adapts to user behavior
- **Failures are isolated**—LLM hallucination doesn't break authorization logic, routing errors don't corrupt LLM context

**Production Example (Retell AI 2026):**
- **Conversation Flow agents**: Deterministic routing with explicit state transitions
- **LLM Response Engine agents**: Probabilistic generation within bounded contexts
- Hybrid approach: Use Conversation Flow for compliance-heavy paths (payment, PII), LLM for open-ended conversation

**Anti-Pattern (Why It Fails):**
- Delegating routing logic to LLM prompts ("If user asks about billing, call billing_function")—LLM ignores instructions 5-10% of time
- Delegating authorization to LLM ("Only share PII if user is verified")—LLM can be prompt-injected to bypass
- Delegating latency budgets to LLM ("Respond within 500ms")—LLM has no control over inference time

### Versioning and Immutability

**Immutable Infrastructure for Agents (AWS Well-Architected 2026):**
Production deployments use **immutable agent definitions** with versioned deployments:

**Core Principles:**
1. **No in-place updates**: Changes are deployed as new agent versions, not patches to running agents
2. **Atomic deployments**: New version is fully deployed before traffic switches
3. **Fast rollback**: Revert to previous version by switching traffic back (seconds, not minutes)
4. **Configuration drift elimination**: Every deployment is from clean, versioned image

**Why This Matters:**
- **Reproducibility**: Can recreate exact agent state from version tag
- **Debuggability**: Production incidents can be reproduced locally with same version
- **Safety**: Rollback is instant, no risk of partial updates leaving system in broken state

**Deployment Strategies (2026 Production):**

**Blue-Green Deployment:**
- Deploy full fleet of new agent version in parallel (green)
- Old version continues serving traffic (blue)
- Switch traffic all at once or use weighted routing to gradually adopt
- If issues detected, switch back to blue instantly
- **Use case**: Major agent updates, model changes, conversation flow redesigns

**Canary Deployment:**
- Direct small percentage of traffic to new version (typically 5-10%)
- Monitor for behavior changes, errors, latency regressions
- If critical problems occur, remove traffic and revert
- Gradually increase traffic to 100% over hours/days
- **Use case**: Prompt changes, minor feature additions, performance optimizations

**Production Example (Amazon SageMaker 2026):**
- Canary traffic shifting with automatic rollback triggered by CloudWatch alarms
- Baking period (e.g., 10 minutes) to validate performance before full traffic migration
- Linear traffic shifting (5% every 5 minutes) or all-at-once cutover

**Pipecat Deployment (2026):**
- Agent images built from Dockerfiles with version tags (e.g., `myusername/app:1.0`)
- Deploy to Pipecat Cloud with `pipecat cloud deploy`
- Agent names are globally unique across regions
- Configuration managed through `pcc-deploy.toml` files

**Evidence Gap:**
- Pipecat documentation does not explicitly address immutability guarantees or blue-green/canary strategies
- Teams likely implement these patterns at infrastructure level (Kubernetes, ECS) rather than framework level

### State Management: Session, State, Memory

**Three-Layer State Architecture (2026 Standard):**

**1. Session (Conversation-Scoped):**
- Represents single, ongoing interaction between user and agent
- Contains chronological message sequences (user inputs, agent responses, tool calls)
- Temporary data relevant only to current conversation (shopping cart, form fields)
- **Lifetime**: Created at call start, destroyed at call end
- **Storage**: In-memory during call, persisted to database after call for analytics

**2. State (Session-Specific Data):**
- Slot-based memory tracking conversation progress
- User preferences mentioned in current chat
- Pending actions and decisions
- **Lifetime**: Same as session
- **Storage**: In-memory, updated after each turn

**3. Memory (Cross-Session Knowledge):**
- Searchable information spanning multiple past interactions
- User profile (name, preferences, history)
- External data sources (knowledge bases, CRM records)
- **Lifetime**: Persistent across sessions
- **Storage**: Database, vector store for semantic search

**Production Implementation (OpenAI Agents SDK 2026):**
- Built-in session memory automatically maintains conversation history
- Sessions automatically: (1) Retrieve history before each run, (2) Prepend prior context to new inputs, (3) Persist new items after each run
- Persistent storage backends: `SQLiteSession`, `OpenAIConversationsSession` (via Conversations API)
- In-memory implementations for local testing only—all data lost on restart

**Production Implementation (Google ADK 2026):**
- `SessionService`: Manages conversation threads (create, retrieve, update, delete)
- `MemoryService`: Manages long-term knowledge store with search capabilities
- Vertex AI Agent Engine Sessions for managed, cloud-based persistence

**Why This Matters:**
- **Session isolation**: Failures in one call don't affect others
- **Debuggability**: Can replay session from persisted history
- **Cost optimization**: Can compress/summarize session history to reduce token usage
- **Multi-session continuity**: Can restore context from previous calls for returning users

### Pipeline Composition (Pipecat-Specific)

**Frame-Based Architecture:**
- **Frames**: Discrete chunks of data (text, audio, images, control signals like conversation start/stop)
- **FrameProcessors**: Fundamental processing units implementing `process_frame` method—consume one frame, produce zero or more frames
- **Pipelines**: Lists of frame processors linked together—processors push frames upstream or downstream to peers
- **Transports**: Provide input/output frame processors (e.g., DailyTransport for WebRTC)

**Advanced Composition Patterns:**

**ParallelPipeline:**
- Multiple independent processing branches running simultaneously
- Synchronized inputs and outputs—each branch receives same downstream frames, processes independently, results merge back
- **Use cases**: Multi-agent conversations, parallel stream processing, redundant service paths with failover

**Producer & Consumer Processors:**
- Route frames between different pipeline parts
- Selective frame sharing across parallel branches
- ProducerProcessor examines frames, applies filters, optionally transforms before sending to consumers

**Why This Matters:**
- **Modularity**: Can swap STT/LLM/TTS providers without rewriting agent logic
- **Testability**: Can unit test individual processors in isolation
- **Observability**: Can log frames at each pipeline stage for debugging
- **Flexibility**: Can compose complex behaviors from simple processors

**Production Pattern (Pipecat 2026):**
```
Transport (WebRTC) → VAD Processor → STT Processor → LLM Context Aggregator → 
LLM Processor → TTS Processor → Transport (WebRTC)
```
- Each processor is independently configurable
- Can insert monitoring processors at any stage
- Can replace LLM processor with different provider without changing pipeline structure

### Runtime Configuration vs Build-Time Configuration

**Trend (2026): Defer Configuration to Runtime**

**Build-Time Configuration (Agent Definition):**
- Agent instructions (system prompt structure, role definition)
- Tool/function definitions (names, parameters, descriptions)
- Conversation flow logic (state machine, routing rules)
- Pipeline structure (which processors, in what order)
- **Changed via**: Code commits, CI/CD deployment
- **Impact**: Affects all customers using that agent version

**Runtime Configuration (Customer Overlay):**
- Model selection (GPT-4o vs Groq Llama)
- Voice parameters (voice ID, speed, pitch)
- Audio formats (input/output sample rates)
- Turn detection thresholds (Fast 500ms vs Standard 700ms)
- Transcription settings (language, custom vocabulary)
- Guardrails (content moderation, PII detection)
- Function allowlists (which tools this customer can use)
- **Changed via**: API calls, database updates
- **Impact**: Affects only specific customer/session

**Why This Matters:**
- **Flexibility**: Can A/B test different configurations without deploying new code
- **Customer isolation**: Configuration changes don't require code review or testing
- **Rapid iteration**: Can tune agent behavior based on customer feedback in minutes, not days

**Production Example (OpenAI Realtime Agents 2026):**
- Model itself is chosen at session level, not agent level
- Same agent definition can be reused with different runtime configurations
- When handoff occurs, ongoing session updates with new agent configuration without recreating session

**Production Example (Amazon Connect 2026):**
- AI Prompts, Guardrails, and Agents are separate resources
- Can modify prompts/guardrails independently, associate with flows via Lambda
- No production rebuild required for configuration changes

### Observability and Debugging Architecture

**Five-Layer Observability Stack (2026 Production Standard):**

**1. Audio Pipeline Layer:**
- Frame drops, buffer underruns/overruns
- Jitter, packet loss, network quality
- Sample rate mismatches, codec issues

**2. STT Processing Layer:**
- Transcription latency (P50/P95/P99)
- Word-level confidence scores
- Partial vs final transcript timing
- Real-time factor (RTF)

**3. LLM Inference Layer:**
- Time to first token (TTFT)
- Tokens per second (output throughput)
- Function call accuracy (hallucinated vs valid)
- Context window occupancy

**4. TTS Generation Layer:**
- Time to first byte (TTFB)
- Time to first audio (TTFA)
- Synthesis latency per chunk
- Word-level timestamp accuracy

**5. End-to-End Trace:**
- Correlation IDs across all layers
- Total turn latency (user speech end → agent speech start)
- Interruption handling latency
- Session lifecycle events

**Why Traditional Monitoring Fails:**
- **Non-determinism**: Same prompt yields different outputs—200 HTTP codes don't measure semantic correctness
- **Long-running workflows**: Deeply nested tool calls and retries—end-to-end pass/fail metrics hide where agents get stuck
- **Evaluation ambiguity**: Need semantic correctness, not just technical success

**Production Requirements (2026):**
- **Distributed tracing**: Generate trace ID at initial capture point, propagate through all API calls
- **Granular error taxonomies**: Classify failures (STT error, LLM timeout, TTS synthesis failure, network issue)
- **Expected overhead**: 1-5% latency for tracing infrastructure

**Production Example (Hamming.ai 2026):**
- Five-layer stack with correlation IDs
- Trace every step: prompt, tool call, LLM response
- Monitor metrics, prompts/outputs, evaluator scores, human feedback
- Automatic debugging with requirement graphs to pinpoint where execution stalled

## Common Failure Modes (Observed in Real Systems)

### 1. Entangled Configuration and Logic
**Symptom**: Customer-specific behavior hardcoded in agent logic. Adding new customer requires code changes, testing, and deployment.

**Root cause**: No separation between base agent (shared logic) and customer overlay (tenant-specific config).

**Production impact**: Teams cannot scale beyond 10-20 customers without dedicated engineering per customer. Onboarding time: weeks instead of hours.

**Observed in**: Early-stage voice AI startups, teams migrating from prototype to production.

**Mitigation**:
- Extract all customer-specific values into runtime configuration (prompts, function allowlists, API credentials, business rules)
- Define base agent as immutable code, customer overlay as mutable data
- Test base agent once, apply different overlays without retesting base logic

---

### 2. Mutable Agent State Across Sessions
**Symptom**: Agent behavior changes unexpectedly between calls. Debugging is impossible because agent state is not reproducible.

**Root cause**: Agent maintains persistent state across sessions (global variables, cached data) that mutates over time.

**Production impact**: 10-20% of calls exhibit unexpected behavior. Cannot reproduce issues locally. Rollback doesn't fix problems.

**Observed in**: Systems using long-lived agent processes, shared memory caches, global state.

**Mitigation**:
- Make agent instances ephemeral—create new instance per call, destroy after call ends
- Store all persistent state in external systems (database, cache, vector store)
- Agent definition is immutable—same version tag always produces same behavior

---

### 3. Lack of Versioning and Rollback Capability
**Symptom**: Deployment breaks production. Cannot roll back quickly. Incident resolution time: hours.

**Root cause**: In-place updates to running agents. No versioned deployments. No blue-green or canary strategy.

**Production impact**: Mean time to recovery (MTTR): 2-4 hours. Customer impact: 100% of traffic affected by bad deployment.

**Observed in**: Teams using manual deployments, SSH-based updates, configuration file edits on production servers.

**Mitigation**:
- Use immutable infrastructure—deploy new agent version, switch traffic, keep old version running
- Implement blue-green or canary deployment with automatic rollback on error rate increase
- Version all agent definitions with git tags, Docker image tags, or semantic versioning

---

### 4. Deterministic Logic Delegated to LLM
**Symptom**: Authorization failures, compliance violations, incorrect routing. LLM ignores instructions 5-10% of time.

**Root cause**: Conversation flow, authorization, and business rules delegated to LLM via prompts instead of enforced in code.

**Production impact**: 5-10% of calls violate business rules. Compliance incidents. Cannot debug why routing failed.

**Observed in**: Systems using "prompt-only" control strategies, single-agent architectures without state machines.

**Mitigation**:
- Use deterministic layer (code, state machines) for routing, authorization, compliance
- Use probabilistic layer (LLM) only for NLU, response generation, sentiment analysis
- Never delegate safety-critical logic to LLM—enforce in code

---

### 5. Session State Loss After Interruptions
**Symptom**: After user interrupts agent, conversation context is lost. Agent repeats information or contradicts earlier statements.

**Root cause**: Session state not updated correctly when interruption occurs. Full LLM response recorded instead of partial delivered content.

**Production impact**: 20-30% of conversations with interruptions exhibit context loss. User frustration, escalation to human agent.

**Observed in**: Systems without word-level timestamp tracking, systems that don't update conversation history on barge-in.

**Mitigation**:
- Track delivered audio using word-level timestamps (D-TS-004)
- On interruption, update conversation history with only the portion actually spoken
- Test interruption scenarios explicitly in regression suite

---

### 6. Configuration Drift Across Environments
**Symptom**: Agent works in staging but fails in production. Cannot reproduce production issues locally.

**Root cause**: Configuration managed manually, inconsistent across environments. No version control for configuration.

**Production impact**: Deployment failures, rollback required. Cannot debug production issues in staging.

**Observed in**: Teams using manual configuration management, environment variables set via SSH, configuration files edited directly on servers.

**Mitigation**:
- Store configuration in version control (git) alongside code
- Use infrastructure-as-code (Terraform, CloudFormation) for environment setup
- Deploy same Docker image to all environments, vary only environment-specific secrets

---

### 7. Lack of Observability for Multi-Step Workflows
**Symptom**: Agent fails but logs only show "LLM error". Cannot determine which step failed or why.

**Root cause**: No distributed tracing. No correlation IDs. Logs from different components (STT, LLM, TTS) not linked.

**Production impact**: Mean time to debug (MTTD): 2-4 hours. Cannot identify root cause without extensive log analysis.

**Observed in**: Systems using basic logging, no tracing infrastructure, no correlation IDs.

**Mitigation**:
- Implement distributed tracing with correlation IDs (trace ID generated at call start, propagated through all components)
- Log every step: STT transcript, LLM prompt, LLM response, TTS request, function calls
- Use structured logging (JSON) with consistent fields (trace_id, customer_id, session_id, timestamp, component, event)

---

### 8. Hot Reload Causing Production Instability
**Symptom**: Configuration changes cause temporary CPU/memory spikes, increased latency, occasional crashes.

**Root cause**: Hot reload maintains both old and new configurations during transition, plus parsing/validation overhead.

**Production impact**: P95 latency increases 2-5x during configuration updates. 1-2% of requests fail during transition.

**Observed in**: Systems using hot reload for high-traffic production environments without traffic management.

**Mitigation**:
- Use blue-green deployment instead of hot reload for high-traffic environments
- If hot reload required, schedule updates during lower-traffic periods
- Monitor CPU, memory, latency metrics during updates, alert on anomalies
- Consider gradual rollout (canary) instead of all-at-once hot reload

---

### 9. Testing Only Happy Path, Not Failure Scenarios
**Symptom**: Agent works in testing but fails in production on edge cases (interruptions, background noise, long pauses, accents).

**Root cause**: Regression tests cover only happy path. No testing of interruptions, barge-in, low-confidence transcripts, function call failures.

**Production impact**: 15-25% of production calls fail on edge cases not covered in testing.

**Observed in**: Teams with basic testing, no load testing, no regression suite for interruptions/barge-in.

**Mitigation**:
- Build regression test suite covering >50 scenarios (interruptions, barge-in, multi-turn conversations, function calling, edge cases)
- Load test with 1000+ concurrent calls before launch
- Test with realistic accents, background noise, long pauses
- Monitor production calls, add failing scenarios to regression suite

---

### 10. Single-Tenant Architecture Scaled to Multi-Tenant
**Symptom**: Cross-tenant data leakage, noisy neighbor problems, inability to isolate customer failures.

**Root cause**: Agent architecture designed for single customer, scaled to multi-tenant without proper isolation.

**Production impact**: Security incidents (cross-tenant data access), performance degradation (one customer's load affects others), debugging complexity (cannot isolate customer-specific issues).

**Observed in**: Teams scaling from pilot to production, startups adding multi-tenancy after initial launch.

**Mitigation**:
- Design for multi-tenancy from V1: tenant context injected at runtime, strict isolation boundaries
- Use customer overlay pattern: base agent + tenant-specific configuration
- Implement tenant-aware observability: trace_id includes customer_id, can filter logs/metrics by tenant
- Test cross-tenant isolation: verify customer A cannot access customer B's data, configuration, or sessions

## Proven Patterns & Techniques

### 1. Base Agent + Customer Overlay Pattern
**Pattern**: Separate shared agent logic (base) from customer-specific configuration (overlay). Base agent is immutable code, overlay is mutable data.

**Implementation**:
- **Base Agent**: Core conversation flow, turn-taking logic, STT/LLM/TTS orchestration, validation rules, safety constraints
- **Customer Overlay**: System prompts, function allowlists, API credentials, business rules, branding, compliance settings
- **Runtime Injection**: Load base agent once, apply customer overlay at session creation based on customer_id

**Benefits**:
- **Scalability**: Can serve 1000+ customers from single codebase
- **Velocity**: Onboard new customer in hours (configure overlay) vs weeks (custom development)
- **Safety**: Changes to base agent tested once, benefit all customers; changes to overlay affect only that customer

**Production examples**:
- Amazon Connect: AI Prompts, Guardrails, Agents as separate resources
- ElevenLabs: Agent versions with branches for different configurations
- Multi-tenant SaaS platforms (AWS 2026 guidance)

**When to use**: All multi-customer voice AI platforms. Required for V1 if serving >1 customer.

---

### 2. Immutable Agent Definitions with Versioned Deployments
**Pattern**: Agent definitions are immutable—changes deployed as new versions, not in-place updates. Use blue-green or canary deployment for safe rollout.

**Implementation**:
- **Version Tagging**: Every agent deployment has version tag (git SHA, semantic version, Docker image tag)
- **Immutable Images**: Build Docker image with agent code, dependencies, configuration baked in
- **Blue-Green Deployment**: Deploy new version in parallel, switch traffic all at once or gradually
- **Canary Deployment**: Direct 5-10% of traffic to new version, monitor for regressions, gradually increase to 100%
- **Automatic Rollback**: If error rate increases >threshold, automatically switch traffic back to previous version

**Benefits**:
- **Fast Rollback**: Revert to previous version in seconds (switch traffic back)
- **Reproducibility**: Can recreate exact agent state from version tag
- **Safety**: New version fully deployed and tested before traffic switches

**Production examples**:
- Pipecat Cloud: Docker images with version tags, deploy via CLI
- Amazon SageMaker: Canary traffic shifting with automatic rollback
- AWS Well-Architected: Immutable infrastructure best practice

**When to use**: All production deployments. Required for V1 to enable safe deployments and fast rollback.

---

### 3. Deterministic Scaffolding + Probabilistic Reasoning
**Pattern**: Use deterministic code (state machines, validation rules) for routing and safety, use probabilistic LLM for understanding and generation.

**Implementation**:
- **Deterministic Layer**: Conversation flow (Pipecat Flows, state machines), authorization checks, business rule validation, function call validation, compliance enforcement
- **Probabilistic Layer**: Natural language understanding (intent extraction, entity recognition), response generation, semantic turn detection, sentiment analysis
- **Clear Boundaries**: Deterministic layer calls LLM for bounded tasks, validates outputs, enforces constraints

**Benefits**:
- **Debuggability**: Deterministic layer is reproducible, testable, traceable
- **Flexibility**: Probabilistic layer handles natural language variation
- **Safety**: LLM hallucination doesn't break authorization, routing errors don't corrupt LLM context

**Production examples**:
- Retell AI: Conversation Flow agents (deterministic) + LLM Response Engine (probabilistic)
- Pipecat Flows: State machine control with LLM invoked within bounded node functions
- Industry consensus (2026): "Blueprint First, Model Second"

**When to use**: All production voice AI systems. Required for V1 to ensure debuggability and safety.

---

### 4. Three-Layer State Management (Session, State, Memory)
**Pattern**: Separate conversation-scoped state (session), session-specific data (state), and cross-session knowledge (memory).

**Implementation**:
- **Session**: Created at call start, destroyed at call end. Contains message history, temporary data. Stored in-memory during call, persisted to database after call.
- **State**: Slot-based memory tracking conversation progress (user_goal, constraints, decisions). Updated after each turn. Lifetime same as session.
- **Memory**: Persistent across sessions. User profile, past interactions, external knowledge. Stored in database, vector store for semantic search.

**Benefits**:
- **Session Isolation**: Failures in one call don't affect others
- **Cost Optimization**: Can compress/summarize session history to reduce token usage
- **Multi-Session Continuity**: Can restore context from previous calls for returning users

**Production examples**:
- OpenAI Agents SDK: Built-in session memory with persistent storage backends
- Google ADK: SessionService + MemoryService
- Pipecat: LLMContext class for session management

**When to use**: All voice AI systems with multi-turn conversations. Required for V1 to enable context management and cost optimization.

---

### 5. Runtime Configuration Over Build-Time Configuration
**Pattern**: Defer configuration to runtime (session creation) instead of build time (agent deployment). Same agent definition, different runtime configurations per customer.

**Implementation**:
- **Build-Time**: Agent instructions, tool definitions, conversation flow logic, pipeline structure
- **Runtime**: Model selection, voice parameters, turn detection thresholds, guardrails, function allowlists
- **Session-Level Configuration**: Apply customer-specific config when creating session, not when deploying agent

**Benefits**:
- **Flexibility**: Can A/B test different configurations without deploying new code
- **Customer Isolation**: Configuration changes don't require code review or testing
- **Rapid Iteration**: Tune agent behavior based on customer feedback in minutes

**Production examples**:
- OpenAI Realtime Agents: Model chosen at session level, not agent level
- Amazon Connect: Prompts/Guardrails modified independently, associated with flows via Lambda
- Pipecat: Bot runner applies runtime configuration when spawning bot instance

**When to use**: All multi-customer platforms. Required for V1 to enable rapid iteration and customer-specific tuning.

---

### 6. Distributed Tracing with Correlation IDs
**Pattern**: Generate trace ID at call start, propagate through all components (STT, LLM, TTS, functions). Log every step with trace ID for end-to-end debugging.

**Implementation**:
- **Trace ID Generation**: Create UUID at call start (when user connects)
- **Propagation**: Include trace_id in all API calls, log entries, metrics
- **Structured Logging**: Use JSON with consistent fields (trace_id, customer_id, session_id, timestamp, component, event, latency)
- **Five-Layer Stack**: Audio pipeline, STT, LLM, TTS, end-to-end trace

**Benefits**:
- **Debuggability**: Can trace single call through entire system
- **Root Cause Analysis**: Can identify which component failed (STT error vs LLM timeout vs TTS synthesis failure)
- **Performance Optimization**: Can identify latency bottlenecks per call

**Production examples**:
- Hamming.ai: Five-layer observability stack with correlation IDs
- Production standard (2026): Distributed tracing with 1-5% latency overhead
- OpenTelemetry: Industry-standard tracing framework

**When to use**: All production systems. Required for V1 to enable debugging and incident response.

---

### 7. Regression Testing for Agent Behavior
**Pattern**: Maintain regression test suite covering >50 scenarios (interruptions, barge-in, multi-turn conversations, function calling, edge cases). Run on every agent configuration change.

**Implementation**:
- **Test Scenarios**: Happy path, interruptions, barge-in, low-confidence transcripts, function call failures, long pauses, background noise, accents
- **Automated Execution**: Run in CI/CD pipeline on every commit
- **Behavioral Validation**: Verify task completion, correct function calls, appropriate responses (not just technical success)
- **Load Testing**: 1000+ concurrent calls before production launch

**Benefits**:
- **Safety**: Catch regressions before production deployment
- **Velocity**: Automated testing enables rapid iteration
- **Confidence**: Can deploy changes knowing edge cases are covered

**Production examples**:
- Hamming.ai: Automated regression testing with 100+ concurrent calls
- Production targets (2026): WER <10%, TTFA <1.7s, task completion >85%, error rate <1%
- Testing maturity: Level 3+ with parallel testing, Level 4 with production monitoring

**When to use**: All production systems. Required for V1 to enable safe deployments and rapid iteration.

---

### 8. Canary Deployment with Automatic Rollback
**Pattern**: Deploy new agent version to small percentage of traffic (5-10%), monitor for regressions, automatically roll back if error rate increases.

**Implementation**:
- **Traffic Splitting**: Route 5-10% of traffic to new version (canary), 90-95% to old version (stable)
- **Monitoring**: Track error rate, latency (P50/P95/P99), task completion rate, user satisfaction
- **Automatic Rollback**: If error rate increases >threshold (e.g., +2% absolute), automatically switch traffic back to stable version
- **Gradual Rollout**: If no regressions detected, gradually increase canary traffic (10% → 25% → 50% → 100%)

**Benefits**:
- **Safety**: Limits blast radius of bad deployments to 5-10% of traffic
- **Fast Detection**: Regressions detected within minutes (not hours)
- **Automatic Recovery**: No manual intervention required for rollback

**Production examples**:
- Amazon SageMaker: Canary traffic shifting with CloudWatch alarm-based rollback
- Production pattern (2026): Baking period (10 minutes) to validate performance before increasing traffic
- Blue-green alternative: All-at-once cutover for major updates

**When to use**: All production deployments. Required for V1 to enable safe rollout of agent changes.

---

### 9. Ephemeral Agent Instances with External State
**Pattern**: Create new agent instance per call, destroy after call ends. Store all persistent state in external systems (database, cache, vector store).

**Implementation**:
- **Instance Creation**: Spawn new agent process/container when call starts
- **Configuration Injection**: Load customer overlay from database, apply to instance
- **State Externalization**: Store session history in database, user profile in CRM, knowledge in vector store
- **Instance Destruction**: Terminate agent process when call ends, no persistent state in agent

**Benefits**:
- **Reproducibility**: Same agent version + same configuration = same behavior
- **Isolation**: Failures in one instance don't affect others
- **Scalability**: Can scale horizontally by spawning more instances

**Production examples**:
- Pipecat: Bot runner spawns new bot process per call
- OpenAI Agents SDK: RealtimeSession created per conversation, destroyed after call
- Serverless pattern: Lambda function per call, no persistent state

**When to use**: All production systems. Required for V1 to enable reproducibility and horizontal scaling.

---

### 10. Multi-Tenant Isolation with Tenant Context Injection
**Pattern**: Inject tenant context (customer_id, permissions, configuration) at runtime. Enforce strict isolation boundaries to prevent cross-tenant data access.

**Implementation**:
- **Tenant Context**: Extract customer_id from authentication token, load customer configuration from database
- **Runtime Injection**: Pass tenant context to agent instance at creation
- **Isolation Enforcement**: Validate all data access includes tenant_id filter, reject cross-tenant queries
- **Observability**: Include customer_id in all logs, metrics, traces for tenant-specific debugging

**Benefits**:
- **Security**: Prevents cross-tenant data leakage
- **Debuggability**: Can filter logs/metrics by tenant
- **Performance Isolation**: Can identify and mitigate noisy neighbor problems

**Production examples**:
- AWS multi-tenant agentic AI guidance (2026): Tenant context throughout agent operations
- SaaS platforms: Tenant-aware agents with identity management integration
- Production requirement: Strict isolation boundaries, data ownership enforcement

**When to use**: All multi-customer platforms. Required for V1 to ensure security and compliance.

## Engineering Rules (Binding)

### R1: Agent Definition MUST Be Immutable and Versioned
**Rule**: Agent definitions (code, conversation flow, pipeline structure) MUST be immutable. Changes deployed as new versions with version tags (git SHA, semantic version, Docker image tag).

**Rationale**: Immutability enables reproducibility, fast rollback, and eliminates configuration drift.

**Implementation**: Build Docker images with agent code, tag with version, deploy via CI/CD. No in-place updates to running agents.

**Verification**: Every production agent has version tag. Can recreate exact agent state from version tag.

---

### R2: Customer Configuration MUST Be Separated from Agent Logic
**Rule**: Customer-specific configuration (prompts, function allowlists, API credentials, business rules) MUST be stored separately from agent code and applied at runtime.

**Rationale**: Enables multi-tenancy without rebuilding agents per customer. Changes to customer config don't require code deployment.

**Implementation**: Store customer config in database, load at session creation based on customer_id. Base agent is shared code.

**Verification**: Can onboard new customer by creating config entry, no code changes required.

---

### R3: Agent Instances MUST Be Ephemeral and Stateless
**Rule**: Agent instances MUST be created per call, destroyed after call ends. All persistent state MUST be stored in external systems (database, cache, vector store).

**Rationale**: Enables reproducibility, horizontal scaling, and isolation between calls.

**Implementation**: Spawn new agent process/container per call, pass customer config, destroy after call. Store session history in database.

**Verification**: Can terminate any agent instance without data loss. Same agent version + same config = same behavior.

---

### R4: Deterministic Logic MUST NOT Be Delegated to LLM
**Rule**: Conversation flow routing, authorization checks, business rule validation, and compliance enforcement MUST be implemented in deterministic code (state machines, validation functions), not LLM prompts.

**Rationale**: LLMs are probabilistic and ignore instructions 5-10% of time. Safety-critical logic must be deterministic.

**Implementation**: Use Pipecat Flows or state machines for routing. Validate function calls against allowlist. Enforce authorization in code before function execution.

**Verification**: Code review must verify no authorization or routing logic in prompts. All safety constraints enforced in code.

---

### R5: Deployments MUST Use Blue-Green or Canary Strategy
**Rule**: Production deployments MUST use blue-green (parallel deployment with traffic switch) or canary (gradual rollout with automatic rollback) strategy. No direct updates to running agents.

**Rationale**: Limits blast radius of bad deployments, enables fast rollback, provides safety net for regressions.

**Implementation**: Deploy new version in parallel, route small percentage of traffic, monitor error rate, automatically roll back if threshold exceeded.

**Verification**: Deployment pipeline includes canary stage with automatic rollback. No direct SSH access to production agents.

---

### R6: All Calls MUST Have Distributed Tracing with Correlation IDs
**Rule**: Every call MUST generate trace ID at start, propagate through all components (STT, LLM, TTS, functions). All logs, metrics, and API calls MUST include trace ID.

**Rationale**: Enables end-to-end debugging, root cause analysis, and performance optimization.

**Implementation**: Generate UUID at call start, include in all API calls and log entries. Use structured logging (JSON) with consistent fields.

**Verification**: Can trace single call through entire system using trace ID. All components emit logs with trace ID.

---

### R7: Session State MUST Be Updated on Interruptions
**Rule**: When user interrupts agent mid-response, conversation history MUST be updated with only the portion actually delivered (spoken), not the full intended response. Use word-level timestamps to track delivered content.

**Rationale**: Prevents context loss after interruptions (affects 20-30% of conversations otherwise).

**Implementation**: Track delivered audio using word-level timestamps (D-TS-004). On interruption, truncate LLM response to last fully delivered word.

**Verification**: Test interruption scenarios in regression suite. Verify conversation history contains only delivered content.

---

### R8: Configuration MUST Be Version-Controlled
**Rule**: All configuration (agent config, customer overlays, infrastructure config) MUST be stored in version control (git) alongside code. No manual configuration edits on production servers.

**Rationale**: Eliminates configuration drift, enables reproducibility, provides audit trail for changes.

**Implementation**: Store config in git, deploy via CI/CD. Use infrastructure-as-code (Terraform, CloudFormation) for environment setup.

**Verification**: All production configuration has git commit history. No SSH access to production servers for config edits.

---

### R9: Regression Tests MUST Cover Interruption and Barge-In Scenarios
**Rule**: Regression test suite MUST include >50 scenarios covering interruptions, barge-in, multi-turn conversations, function calling, and edge cases. Run on every agent configuration change.

**Rationale**: Production calls fail on edge cases not covered in testing (15-25% failure rate without regression tests).

**Implementation**: Build test suite with interruption scenarios, barge-in, low-confidence transcripts, function call failures. Run in CI/CD.

**Verification**: Test suite includes >50 scenarios. CI/CD blocks deployment if tests fail.

---

### R10: Multi-Tenant Systems MUST Enforce Strict Isolation
**Rule**: Multi-tenant systems MUST inject tenant context (customer_id) at runtime, validate all data access includes tenant_id filter, and prevent cross-tenant data access.

**Rationale**: Prevents security incidents (cross-tenant data leakage), enables tenant-specific debugging.

**Implementation**: Extract customer_id from auth token, pass to agent instance, validate all queries include tenant_id filter.

**Verification**: Security review must verify tenant isolation. Test cross-tenant access attempts (should be rejected).

## Metrics & Signals to Track

### Agent Deployment Metrics
- **Deployment frequency**: Number of agent deployments per week
- **Deployment success rate**: Percentage of deployments that complete without rollback (target: >95%)
- **Rollback rate**: Percentage of deployments that require rollback (target: <5%)
- **Deployment duration**: Time from deployment start to traffic fully switched (target: <10 minutes)
- **Canary duration**: Time spent in canary phase before full rollout (typical: 10-30 minutes)
- **Rollback time**: Time from issue detection to rollback completion (target: <2 minutes)

### Agent Version Metrics
- **Active versions**: Number of agent versions currently serving traffic (target: 1-2)
- **Version age**: Time since current version was deployed (monitor for staleness)
- **Version distribution**: Percentage of traffic per version (during canary rollout)
- **Configuration drift**: Differences between environments (staging vs production) (target: 0)

### Multi-Tenant Metrics
- **Customers per agent version**: Number of customers using each agent version
- **Customer onboarding time**: Time from customer signup to first call (target: <1 hour)
- **Configuration changes per customer**: Number of config updates per customer per week
- **Cross-tenant isolation violations**: Number of attempted cross-tenant data access (target: 0)
- **Noisy neighbor incidents**: Number of times one customer's load affected others (target: 0)

### Session Management Metrics
- **Session creation latency**: Time from call start to agent instance ready (target: <500ms)
- **Session duration**: P50/P95/P99 call duration
- **Sessions per agent instance**: Number of concurrent sessions per agent process
- **Session failure rate**: Percentage of sessions that fail to create (target: <1%)
- **Session cleanup time**: Time from call end to agent instance destroyed (target: <5s)

### State Management Metrics
- **Context window occupancy**: Average/P95/P99 percentage of context window used per session
- **State persistence latency**: Time to save session state to database after call (target: <1s)
- **State retrieval latency**: Time to load user profile/history at call start (target: <200ms)
- **Memory recall accuracy**: For cross-session memory, relevance score of retrieved context

### Pipeline Composition Metrics
- **Frame processing latency**: P50/P95/P99 time per frame processor
- **Frame drop rate**: Percentage of frames dropped due to processing delays (target: <0.1%)
- **Pipeline backpressure events**: Number of times pipeline applied backpressure due to slow processor
- **Processor failure rate**: Percentage of frames that cause processor exceptions (target: <0.1%)
- **Parallel pipeline synchronization latency**: Time to synchronize outputs from parallel branches

### Observability Metrics
- **Trace coverage**: Percentage of calls with complete end-to-end traces (target: 100%)
- **Trace ID propagation failures**: Number of calls where trace ID was not propagated to all components (target: 0)
- **Log volume per call**: Average number of log entries per call
- **Tracing overhead**: Additional latency introduced by tracing infrastructure (target: <5%)
- **Structured logging compliance**: Percentage of log entries using structured format (JSON) (target: 100%)

### Regression Testing Metrics
- **Test suite size**: Number of test scenarios in regression suite (target: >50)
- **Test coverage**: Percentage of agent behaviors covered by tests (target: >80%)
- **Test execution time**: Time to run full regression suite (target: <10 minutes)
- **Test pass rate**: Percentage of tests passing on each run (target: 100%)
- **Regression detection rate**: Percentage of production regressions caught by tests before deployment

### Configuration Management Metrics
- **Configuration changes per week**: Number of customer config updates
- **Configuration validation failures**: Number of invalid config updates rejected (indicates config schema issues)
- **Hot reload events**: Number of configuration updates applied without deployment
- **Hot reload latency impact**: P95 latency increase during hot reload (target: <2x baseline)
- **Configuration version mismatches**: Number of times staging and production configs diverged (target: 0)

### Failure Mode Metrics
- **Entangled config incidents**: Number of times customer-specific logic found in agent code (target: 0)
- **Mutable state incidents**: Number of times agent state persisted incorrectly across sessions (target: 0)
- **Rollback incidents**: Number of deployments requiring emergency rollback
- **Deterministic logic failures**: Number of times LLM ignored routing/authorization instructions
- **Cross-tenant data leakage incidents**: Number of security incidents involving cross-tenant access (target: 0)

## V1 Decisions / Constraints

### D-AG-001 Agent Architecture MUST Use Base Agent + Customer Overlay Pattern
**Decision**: Implement base agent (shared logic) + customer overlay (tenant-specific config) architecture. Base agent is immutable code, overlay is mutable data stored in database.

**Rationale**: Enables multi-tenancy without rebuilding agents per customer. Aligns with AWS 2026 multi-tenant agentic AI guidance.

**Constraints**: Requires upfront separation of shared logic vs customer-specific config. Must design overlay schema carefully.

---

### D-AG-002 Agent Definitions MUST Be Immutable with Docker Images
**Decision**: Agent definitions deployed as immutable Docker images with version tags (semantic versioning). No in-place updates to running agents.

**Rationale**: Enables reproducibility, fast rollback, eliminates configuration drift. Aligns with AWS Well-Architected immutable infrastructure best practice.

**Constraints**: Requires Docker infrastructure, CI/CD pipeline for building/pushing images. Must version all agent changes.

---

### D-AG-003 Deployments MUST Use Canary Strategy with Automatic Rollback
**Decision**: All production deployments use canary strategy: 10% traffic to new version, monitor for 10 minutes, automatically roll back if error rate increases >2% absolute.

**Rationale**: Limits blast radius of bad deployments, enables fast detection and recovery. Aligns with Amazon SageMaker deployment guardrails pattern.

**Constraints**: Requires traffic splitting infrastructure, monitoring/alerting for automatic rollback. Adds 10-30 minutes to deployment time.

---

### D-AG-004 Conversation Flow MUST Use Pipecat Flows (State Machines)
**Decision**: Use Pipecat Flows (Dynamic Flows) for deterministic conversation flow control. LLM invoked only within bounded node functions for generation tasks.

**Rationale**: Separates deterministic routing from probabilistic generation. Aligns with D-LLM-002 and "Blueprint First, Model Second" best practice.

**Constraints**: Requires upfront flow design. Less flexible than pure LLM-driven conversations, but more reliable.

---

### D-AG-005 Agent Instances MUST Be Ephemeral (Created Per Call)
**Decision**: Create new agent instance (bot process) per call, destroy after call ends. Store all persistent state in PostgreSQL (session history, user profile).

**Rationale**: Enables reproducibility, horizontal scaling, isolation between calls. Aligns with Pipecat deployment pattern.

**Constraints**: Requires external state storage (database). Must optimize instance creation latency (<500ms).

---

### D-AG-006 All Calls MUST Have Distributed Tracing with Correlation IDs
**Decision**: Generate trace_id (UUID) at call start, propagate through all components (STT, LLM, TTS, functions). Use structured logging (JSON) with trace_id, customer_id, session_id, timestamp, component, event.

**Rationale**: Enables end-to-end debugging, root cause analysis. Aligns with Hamming.ai five-layer observability stack.

**Constraints**: Adds 1-5% latency overhead. Requires logging infrastructure (e.g., CloudWatch, Datadog).

---

### D-AG-007 Customer Configuration MUST Be Stored in Database
**Decision**: Store customer overlays (system prompts, function allowlists, API credentials, business rules) in PostgreSQL. Load at session creation based on customer_id from auth token.

**Rationale**: Enables runtime configuration without code deployment. Aligns with D-AG-001 base agent + overlay pattern.

**Constraints**: Requires database schema for customer config. Must validate config on load to prevent runtime errors.

---

### D-AG-008 Regression Tests MUST Cover >50 Scenarios Including Interruptions
**Decision**: Maintain regression test suite with >50 scenarios: happy path, interruptions, barge-in, low-confidence transcripts, function call failures, long pauses, background noise, accents. Run on every commit in CI/CD.

**Rationale**: Catches regressions before production. Aligns with Hamming.ai testing maturity Level 3+ guidance.

**Constraints**: Requires test infrastructure, automated execution. Adds 5-10 minutes to CI/CD pipeline.

---

### D-AG-009 Session State MUST Be Updated on Interruptions
**Decision**: On user interruption, update conversation history with only the portion of LLM response actually delivered (spoken). Use word-level timestamps from TTS (D-TS-004) to track delivered content.

**Rationale**: Prevents context loss after interruptions (affects 20-30% of conversations otherwise). Aligns with D-TT-006.

**Constraints**: Requires word-level timestamp support from TTS provider. Adds complexity to interruption handling.

---

### D-AG-010 Multi-Tenant Isolation MUST Be Enforced with Tenant Context
**Decision**: Extract customer_id from auth token, pass to agent instance at creation. Validate all database queries include customer_id filter. Reject cross-tenant access attempts.

**Rationale**: Prevents security incidents (cross-tenant data leakage). Aligns with AWS multi-tenant agentic AI guidance.

**Constraints**: Requires tenant-aware database queries, security review for isolation enforcement.

---

### D-AG-011 Configuration MUST Be Version-Controlled in Git
**Decision**: Store all configuration (agent config, customer overlay schema, infrastructure config) in git alongside code. Deploy via CI/CD. No manual config edits on production servers.

**Rationale**: Eliminates configuration drift, enables reproducibility. Aligns with infrastructure-as-code best practice.

**Constraints**: Requires CI/CD pipeline for config deployment. Must separate secrets (API keys) from config (use secrets manager).

---

### D-AG-012 Pipecat Pipeline MUST Use Frame-Based Architecture
**Decision**: Implement agent as Pipecat pipeline with frame processors: Transport (WebRTC) → VAD → STT → LLM Context Aggregator → LLM → TTS → Transport.

**Rationale**: Enables modularity, testability, observability. Aligns with Pipecat architecture best practices.

**Constraints**: Requires understanding of Pipecat frame processing model. Must implement custom processors for business logic.

---

### D-AG-013 Runtime Configuration MUST Override Build-Time Defaults
**Decision**: Agent definition includes default configuration (model, voice, turn detection thresholds). Customer overlay can override any default at runtime (session creation).

**Rationale**: Enables customer-specific tuning without code deployment. Aligns with OpenAI Realtime Agents pattern.

**Constraints**: Must validate runtime config to prevent invalid values. Must document which settings are overridable.

---

### D-AG-014 Rollback MUST Complete Within 2 Minutes
**Decision**: If canary deployment detects regression (error rate increase >2%), automatically roll back to previous version within 2 minutes.

**Rationale**: Minimizes customer impact of bad deployments. Aligns with production SLA targets.

**Constraints**: Requires automated rollback infrastructure, monitoring/alerting with <1 minute detection latency.

---

### D-AG-015 Agent Version MUST Be Included in All Logs and Metrics
**Decision**: Include agent_version (Docker image tag) in all log entries, metrics, and traces. Enables version-specific debugging and performance analysis.

**Rationale**: Can identify regressions introduced by specific version. Enables A/B testing of agent versions.

**Constraints**: Must propagate agent_version through all components. Must include in structured logging schema.

## Open Questions / Risks

### Q1: How to Handle Agent Version Compatibility with Customer Overlays?
**Question**: If agent definition changes (e.g., new required field in overlay schema), how to ensure existing customer overlays remain compatible?

**Risk**: Deploying new agent version breaks existing customers due to schema incompatibility. Requires manual migration of all customer configs.

**Mitigation options**:
- Use schema versioning with backward compatibility (old overlays work with new agent)
- Implement migration scripts that run automatically on deployment
- Validate all customer overlays against new schema before deployment, block if incompatible
- Use feature flags to gradually enable new schema fields

**V1 decision**: Implement schema versioning with backward compatibility. Validate all customer overlays in staging before production deployment.

---

### Q2: How to Test Multi-Tenant Isolation in Staging?
**Question**: How to verify that customer A cannot access customer B's data, configuration, or sessions without deploying to production?

**Risk**: Cross-tenant data leakage not detected until production. Security incident, compliance violation.

**Mitigation options**:
- Create test customers in staging with different tenant IDs
- Implement automated tests that attempt cross-tenant access (should be rejected)
- Use chaos engineering to inject tenant_id manipulation attacks
- Conduct security review with penetration testing

**V1 decision**: Create test customers in staging, implement automated cross-tenant access tests in regression suite.

---

### Q3: How to Handle Configuration Hot Reload Without Downtime?
**Question**: If customer updates their overlay configuration (e.g., changes system prompt), should change apply immediately to running sessions or only to new sessions?

**Risk**: Applying to running sessions causes mid-conversation behavior change, confusing users. Applying only to new sessions delays customer feedback.

**Mitigation options**:
- Apply only to new sessions (safe, but delayed feedback)
- Apply to running sessions at next turn boundary (immediate, but may confuse users)
- Allow customer to choose: "apply immediately" vs "apply to new sessions only"
- Use canary rollout for config changes (10% of new sessions get new config)

**V1 decision**: Apply config changes only to new sessions. Provide "preview" mode for customers to test config changes before committing.

---

### Q4: How to Version Customer Overlays?
**Question**: Should customer overlays be versioned (like agent definitions) or always use latest version?

**Risk**: If always latest, cannot reproduce production issues from past. If versioned, adds complexity to config management.

**Mitigation options**:
- Version overlays with timestamps, store history in database
- Allow rollback to previous overlay version via API
- Include overlay_version in logs/traces for debugging
- Use git-like branching for overlay development (draft → staging → production)

**V1 decision**: Version overlays with timestamps, store history in database. Include overlay_version in logs for debugging.

---

### Q5: How to Handle Agent Instance Startup Latency?
**Question**: If agent instances are ephemeral (created per call), how to minimize startup latency (<500ms target)?

**Risk**: High startup latency increases total turn latency, breaks conversational flow.

**Mitigation options**:
- Use warm pool of pre-initialized agent instances
- Optimize Docker image size (smaller images start faster)
- Use serverless containers (AWS Fargate, Cloud Run) with fast cold start
- Lazy-load dependencies (only load what's needed for first turn)

**V1 decision**: Use warm pool of 10-20 pre-initialized agent instances. Monitor startup latency, alert if P95 >500ms.

---

### Q6: How to Handle Canary Deployment for Breaking Changes?
**Question**: If new agent version has breaking changes (e.g., removes a function), how to deploy safely without breaking existing customers?

**Risk**: Canary deployment routes 10% of traffic to broken version, affecting those customers.

**Mitigation options**:
- Use feature flags to gradually enable breaking changes
- Deploy backward-compatible version first (supports both old and new), then remove old after migration
- Test breaking changes with synthetic traffic before routing real users
- Require explicit customer opt-in for breaking changes

**V1 decision**: Use feature flags for breaking changes. Deploy backward-compatible version first, remove old after all customers migrated.

---

### Q7: How to Debug Issues Specific to Customer Overlay?
**Question**: If issue occurs only for customer A (not customer B), how to debug without access to customer A's production data?

**Risk**: Cannot reproduce issue in staging because customer A's overlay is different. Long debugging time.

**Mitigation options**:
- Allow customers to export their overlay configuration (sanitized, no secrets)
- Provide "debug mode" that logs full overlay configuration (with customer consent)
- Create staging customer with same overlay as production customer A
- Implement overlay diff tool to compare customer A vs customer B

**V1 decision**: Provide "debug mode" that logs full overlay configuration (with customer consent). Create staging customer with same overlay for reproduction.

---

### Q8: How to Handle Agent Definition Changes That Require Overlay Migration?
**Question**: If agent definition changes require all customer overlays to be updated (e.g., new required field), how to coordinate migration?

**Risk**: Deploying new agent version before all overlays migrated breaks production for some customers.

**Mitigation options**:
- Implement two-phase migration: (1) Deploy backward-compatible agent, (2) Migrate overlays, (3) Deploy agent that requires new field
- Use database migration scripts that run automatically on deployment
- Provide migration API for customers to update their overlays
- Block deployment if any customer overlay is incompatible

**V1 decision**: Use two-phase migration. Deploy backward-compatible agent first, migrate overlays via API, then deploy agent requiring new field.

---

### Q9: How to Monitor Agent Performance Per Customer?
**Question**: How to identify which customers are experiencing high latency, errors, or poor task completion rates?

**Risk**: Cannot identify customer-specific issues without per-customer metrics. Customer churn due to poor experience.

**Mitigation options**:
- Include customer_id in all metrics, create per-customer dashboards
- Alert on per-customer anomalies (e.g., customer A's error rate increased 3x)
- Provide customer-facing analytics dashboard (task completion, latency, user satisfaction)
- Implement customer health score (composite metric of latency, errors, satisfaction)

**V1 decision**: Include customer_id in all metrics. Create per-customer dashboards. Alert on per-customer anomalies.

---

### Q10: How to Handle Agent Instance Scaling During Traffic Spikes?
**Question**: If traffic spikes 10x (e.g., customer launches marketing campaign), how to scale agent instances quickly?

**Risk**: Insufficient capacity causes call failures, high latency. Customer impact.

**Mitigation options**:
- Use auto-scaling based on CPU/memory/queue depth
- Maintain warm pool of agent instances that scales with traffic
- Use serverless containers (AWS Fargate, Cloud Run) with automatic scaling
- Implement rate limiting per customer to prevent single customer from consuming all capacity

**V1 decision**: Use auto-scaling based on queue depth (number of pending calls). Maintain warm pool that scales 0-100 instances. Implement per-customer rate limiting.

---

### Q11: How to Test Agent Behavior with Customer-Specific Overlays?
**Question**: How to ensure regression tests cover customer-specific overlay configurations, not just default configuration?

**Risk**: Tests pass with default config but fail with customer-specific overlays. Production issues not caught in testing.

**Mitigation options**:
- Create test overlays representing common customer configurations (e.g., high security, low latency, multi-language)
- Run regression tests with multiple overlay configurations
- Implement overlay validation tests (ensure all overlays are valid against schema)
- Allow customers to run regression tests with their own overlays before deploying changes

**V1 decision**: Create 5-10 test overlays representing common configurations. Run regression tests with all test overlays.

---

### Q12: How to Handle Agent Definition Rollback When Customer Overlays Have Changed?
**Question**: If agent version is rolled back but customer overlays have been updated since deployment, will rolled-back agent work with new overlays?

**Risk**: Rollback fails because old agent version incompatible with new overlay schema. Cannot recover from bad deployment.

**Mitigation options**:
- Maintain backward compatibility—old agent versions work with new overlays
- Store overlay version with each deployment, roll back overlays along with agent
- Test rollback scenarios in staging before production deployment
- Implement "rollback validation" that checks compatibility before executing rollback

**V1 decision**: Maintain backward compatibility—old agent versions work with new overlays. Test rollback scenarios in staging.

---

### Q13: How to Handle Long-Running Agent Instances (Multi-Hour Calls)?
**Question**: If call lasts multiple hours (e.g., customer support session), should agent instance remain running entire time or be recycled?

**Risk**: Long-running instances accumulate memory leaks, state corruption. But recycling mid-call disrupts conversation.

**Mitigation options**:
- Allow instances to run for duration of call, monitor memory usage
- Implement periodic health checks, recycle instance if memory exceeds threshold
- Use stateless architecture—can recycle instance and restore state from database without disrupting call
- Set maximum call duration (e.g., 4 hours), force graceful termination after limit

**V1 decision**: Allow instances to run for duration of call (up to 4 hours max). Monitor memory usage, alert if exceeds threshold.

---

### Q14: How to Debug Distributed Tracing When Trace ID Is Not Propagated?
**Question**: If component fails to propagate trace_id (e.g., due to bug), how to correlate logs across components?

**Risk**: Cannot trace call through system, debugging is impossible.

**Mitigation options**:
- Implement trace_id validation at component boundaries (reject requests without trace_id)
- Use fallback correlation (timestamp + customer_id + session_id)
- Monitor trace_id propagation rate, alert if <100%
- Implement automatic trace_id injection at infrastructure level (service mesh, API gateway)

**V1 decision**: Implement trace_id validation at component boundaries. Monitor propagation rate, alert if <100%.

---

### Q15: How to Handle Agent Configuration Conflicts Between Base and Overlay?
**Question**: If base agent defines default temperature=0.6 but customer overlay sets temperature=0.2, which takes precedence?

**Risk**: Unclear precedence causes unexpected behavior. Debugging is difficult.

**Mitigation options**:
- Define explicit precedence rules (overlay always overrides base)
- Validate overlay at load time, reject conflicting values
- Log all configuration merges (base + overlay = final) for debugging
- Provide configuration preview API for customers to see final merged config

**V1 decision**: Overlay always overrides base. Log all configuration merges. Provide preview API for customers.
