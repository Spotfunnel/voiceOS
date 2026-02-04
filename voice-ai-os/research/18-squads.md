# Research: Multi-Agent Squads for Voice AI Systems (V2-Capable Architecture)

## Why This Matters for V1

Multi-agent squads are **not a V1 feature**—but V1 architectural decisions will either enable or permanently block squad capabilities in V2. The core challenge: voice AI systems require **sub-1000ms response times** and **continuous conversation flow**, but multi-agent handoffs introduce **200-500ms latency overhead** and **context fragmentation risks**. Production evidence from 2025-2026 reveals that naive multi-agent implementations fail catastrophically: (1) **latency explosion**—handoffs add 3-6 seconds to P95 response time (vs 800ms target), breaking conversational flow, (2) **context loss**—80% of handoffs lose critical conversation context, forcing customers to repeat information, and (3) **cost explosion**—inter-agent communication overhead consumes more tokens than actual reasoning, doubling LLM costs.

The pattern is clear: **most multi-agent systems fail due to orchestration and context-transfer issues, not individual agent capability**. Research analyzing 1,600+ multi-agent traces identified **14 unique failure modes** across system design, inter-agent misalignment, and task verification. The critical insight: multi-agent systems show **minimal performance gains** compared to single-agent frameworks despite design complexity. For V1, this means: **build a single-agent system with clean boundaries that can evolve into multi-agent in V2 without architectural rewrites**.

**V1-AWARE Requirements (Must Exist in V1):**
- **Centralized conversation state** (not agent-specific state) that can be shared across future agents
- **Explicit state machine** (not prompt-only control) that can route to different agents deterministically
- **Structured memory system** (not free-form context) with clear scoping boundaries
- **Tool gateway with permissions** (not direct tool access) that can enforce per-agent capabilities

**V2-ONLY Features (Explicitly NOT in V1):**
- Multiple agent instances with handoff logic
- Agent-to-agent communication protocols
- Supervisor/orchestrator agent
- Per-agent memory isolation

## What Matters in Production (Facts Only)

### How Agents Hand Off Responsibility Without Resetting Context

**Core Insight (2025-2026):**
Successful agent handoffs require **structured context transfer**, not free-form conversation history. Production systems that simply pass conversation logs between agents experience 80% context loss. The pattern that works: **explicit handoff messages with metadata** + **centralized state store** + **per-agent memory scopes**.

**Production Handoff Architecture (Verified 2025-2026):**

**AWS Agent Squad Pattern (7.3K GitHub stars, production-validated):**

**1. Centralized Conversation State**
- **Global context**: LLM classifier analyzes user requests alongside conversation history from **all agents** for current user_id and session_id
- **Per-agent memory**: Each agent automatically retrieves and maintains its own conversation history for current user and session
- **Automatic storage**: Orchestrator saves user inputs and agent responses to storage (in-memory or DynamoDB)
- **Configurable history limits**: Prevents context window explosion

**2. Structured Handoff Flow**
- Classification → Agent Selection → Request Routing → Processing → Storage → Response Delivery
- **Follow-up handling**: System intelligently routes follow-ups ("Tell me more", "Again") back to appropriate agent by identifying last responding agent
- **No context reset**: Conversation continues seamlessly across agent boundaries

**3. Memory Scoping**
- Each agent sees only its own conversation history (not other agents' conversations)
- Classifier sees global context (all agents) for intelligent routing
- Prevents context pollution (Agent A's conversation doesn't leak into Agent B's context)

**Microsoft Azure Logic Apps Pattern (2025):**

**1. Handoff with Chat Continuity**
- Specialized agents perform domain-specific tasks while maintaining conversation context
- Complete chat history, caller intent, account data, and recent interactions synced to agent desktop in real-time
- CRM integration ensures agents receive full customer background immediately upon transfer

**2. Intelligent Handoff Triggers**
- Sentiment and emotional analysis (detect frustration before escalation)
- Confidence thresholds (typically 60-70%, hard floor at 40%)
- Conversation loop detection (AI repeatedly fails to resolve issue)
- Explicit customer requests (ask for human)
- Complexity thresholds (human expertise adds value)

**LangGraph Pattern (21.3K GitHub stars, production at Rakuten, GitLab, Cisco):**

**1. Graph-Based State Management**
- Nodes = processing steps (agents)
- Edges = conditional routing logic
- State = shared memory (centralized state store)
- **Durable execution**: Agents automatically checkpoint at each node, resume exactly where they failed

**2. Persistent State Across Agents**
- Centralized state store that every node (agent) reads and updates
- Avoids ad-hoc memory chaos
- Supports long-running workflows (minutes, hours, days) without losing context

**Key Architectural Requirements (V1-AWARE):**

**1. Centralized State Store (MUST exist in V1)**
- Conversation state stored in central location (PostgreSQL, Redis)
- Not agent-specific state (agents read/write to shared state)
- Enables future agents to access same state without migration
- **V1 implementation**: Single agent reads/writes to central state store

**2. Structured State Schema (MUST exist in V1)**
- State is structured (JSON, not free-form text)
- Clear scoping: session state, conversation state, user state
- Enables future agents to understand state without retraining
- **V1 implementation**: Define state schema for single agent, design for multi-agent extensibility

**3. Explicit State Transitions (MUST exist in V1)**
- State machine controls conversation flow (not prompt-only)
- State transitions are explicit and logged
- Enables future routing to different agents based on state
- **V1 implementation**: Pipecat Flows for state machine (research/07-state-machines.md)

**What Breaks Without These (Observed 2025-2026):**

**No Centralized State:**
- Agent A stores conversation in its own memory
- Handoff to Agent B → Agent B has no context
- Customer must repeat information
- **Result**: 80% context loss, poor customer experience

**No Structured State:**
- Conversation state is free-form text (unstructured)
- Agent B cannot parse Agent A's context
- Must re-prompt customer for structured information
- **Result**: Context loss, increased latency, customer frustration

**No Explicit State Transitions:**
- Prompt-only control (LLM decides when to hand off)
- Non-deterministic handoffs (sometimes works, sometimes doesn't)
- Cannot debug or replay handoff decisions
- **Result**: Unreliable handoffs, cannot reproduce failures

### Deterministic vs Probabilistic Handoff Strategies

**Core Tradeoff (2026):**
Deterministic handoffs are **predictable, debuggable, and reliable** but **inflexible**. Probabilistic handoffs are **flexible and adaptive** but **unpredictable and hard to debug**. Production systems use **hybrid approach**: deterministic routing for critical paths, probabilistic for edge cases.

**Deterministic Handoff (Recommended for V1-Aware Architecture):**

**Definition**: Handoff decisions based on explicit rules and state machine transitions. No LLM involved in routing decision.

**Implementation**:
- State machine defines handoff conditions (e.g., "if state = needs_technical_support, route to technical_agent")
- Guards evaluate conditions deterministically (e.g., "if confidence < 0.4, escalate to human")
- No LLM prompt like "decide which agent should handle this"

**Benefits**:
- **Predictable**: Same input always produces same handoff decision
- **Debuggable**: Can trace exact reason for handoff (state + guard condition)
- **Testable**: Can write unit tests for handoff logic
- **Low latency**: No LLM call required for routing decision

**Drawbacks**:
- **Inflexible**: Cannot adapt to new scenarios without code changes
- **Requires upfront design**: Must anticipate all handoff scenarios
- **Maintenance burden**: Must update rules as system evolves

**Production Examples**:
- Pipecat Flows: Explicit state machine with guards for transitions
- Retell AI: Deterministic state machine for conversation flow
- Dialogflow CX: State-based routing with explicit transitions

**Probabilistic Handoff (V2-ONLY):**

**Definition**: Handoff decisions based on LLM classification. LLM analyzes conversation and decides which agent should handle request.

**Implementation**:
- LLM classifier analyzes user request + conversation history
- Returns agent selection with confidence score
- If confidence < threshold, fallback to default agent or human

**Benefits**:
- **Flexible**: Can adapt to new scenarios without code changes
- **Natural language understanding**: Can handle ambiguous requests
- **Lower maintenance**: Don't need to update rules manually

**Drawbacks**:
- **Unpredictable**: Same input may produce different handoff decisions
- **Hard to debug**: Cannot trace exact reason for handoff (LLM black box)
- **Higher latency**: LLM call adds 200-500ms to response time
- **Higher cost**: Every handoff requires LLM classification call

**Production Examples**:
- AWS Agent Squad: LLM classifier for agent selection
- AutoGen: LLM-based agent selection with handoff messages
- LangGraph: Conditional edges can use LLM for routing decisions

**Hybrid Approach (Production Recommendation 2026):**

**Pattern**: Use deterministic routing for critical paths, probabilistic for edge cases.

**Implementation**:
- **Critical paths**: Deterministic state machine (e.g., "if user says 'cancel order', route to order_management_agent")
- **Edge cases**: LLM classifier (e.g., "if user request is ambiguous, use LLM to classify intent")
- **Confidence thresholds**: If LLM confidence < 70%, fallback to deterministic routing or human escalation

**Benefits**:
- **Best of both worlds**: Predictable for common cases, flexible for edge cases
- **Lower latency**: Most requests use deterministic routing (no LLM call)
- **Lower cost**: LLM only called for ambiguous requests

**V1-AWARE Decision**:
- V1: Deterministic routing only (state machine with guards)
- V2: Add probabilistic routing for edge cases (LLM classifier)
- Architecture: Design state machine to support both (add "classify_intent" state for future LLM routing)

### Why Naive Multi-Agent Prompting Fails in Production

**Core Problem (2025-2026):**
Naive multi-agent prompting fails because **LLMs are not reliable coordinators**. Prompt-only approaches like "You are Agent A. If the user asks about X, hand off to Agent B" fail 20-40% of the time in production. The failure modes are systematic, not isolated.

**Research Evidence (2025):**
Analysis of 1,600+ multi-agent traces identified **14 unique failure modes** with high inter-annotator agreement (Cohen's Kappa 0.88). Key finding: **most agent failures stem from orchestration and context-transfer issues, not individual agent capability**.

**Failure Mode 1: Handoff Hallucination**
- LLM decides to hand off when it shouldn't (false positive)
- Example: User asks simple question, LLM hands off to specialist agent unnecessarily
- **Impact**: Increased latency (handoff overhead), increased cost (extra LLM calls)
- **Frequency**: 10-15% of handoffs in prompt-only systems

**Failure Mode 2: Handoff Omission**
- LLM fails to hand off when it should (false negative)
- Example: User asks complex question requiring specialist, LLM tries to answer itself and fails
- **Impact**: Poor task success rate, customer frustration
- **Frequency**: 15-20% of cases requiring handoff in prompt-only systems

**Failure Mode 3: Context Loss During Handoff**
- LLM generates handoff message but doesn't include critical context
- Example: "Hand off to billing agent" without including customer account number
- **Impact**: Receiving agent must re-prompt customer for information
- **Frequency**: 60-80% of handoffs in naive implementations

**Failure Mode 4: Infinite Handoff Loops**
- Agent A hands off to Agent B, Agent B hands back to Agent A, repeat
- Example: Neither agent confident in handling request, keep bouncing back and forth
- **Impact**: Timeout, customer frustration, wasted LLM calls
- **Frequency**: 5-10% of handoffs in systems without termination logic

**Failure Mode 5: Handoff to Non-Existent Agent**
- LLM hallucinates agent name that doesn't exist
- Example: "Hand off to premium_support_agent" when only "support_agent" exists
- **Impact**: Error, conversation breaks, must restart
- **Frequency**: 2-5% of handoffs in prompt-only systems

**Why Prompting Alone Fails:**

**1. LLMs Are Not Reliable Routers**
- LLM classification accuracy for agent selection: 70-85% (not 99%+)
- 15-30% error rate unacceptable for production routing
- Deterministic routing (state machine + guards) achieves 99%+ accuracy

**2. Prompt Engineering Is Unpredictable**
- Techniques like "be polite" or "output constraints" help in some cases, harm in others
- No universal formula for reliable multi-agent prompting
- Highly contingent on model, prompt, and context

**3. Context Window Limitations**
- Passing full conversation history to every agent hits context window limits
- Must summarize or truncate, losing critical context
- Structured state transfer (not full conversation history) more reliable

**4. No Failure Recovery**
- If LLM makes wrong handoff decision, no way to recover
- Deterministic routing can implement fallback logic (if Agent B fails, route to Agent C)
- Prompt-only systems have no fallback mechanism

**Production Pattern (Verified 2025-2026):**

**Don't Use Prompts for Coordination**:
- ❌ "You are Agent A. If user asks about billing, hand off to Agent B"
- ❌ "Decide which agent should handle this request: [Agent A, Agent B, Agent C]"
- ❌ "Generate a handoff message with context for the next agent"

**Use Explicit Orchestration Instead**:
- ✅ State machine with explicit transitions (deterministic routing)
- ✅ Structured handoff messages with schemas (not free-form)
- ✅ Centralized orchestrator that manages routing (not agent-to-agent)
- ✅ LLM for classification only (not coordination)

**V1-AWARE Decision**:
- V1: No multi-agent prompting (single agent only)
- V1: Explicit state machine for conversation flow (Pipecat Flows)
- V2: Add orchestrator for multi-agent routing (not prompt-based)
- Architecture: Design state machine to support future orchestrator (add routing states)

### How Shared Memory Is Scoped and Controlled

**Core Insight (2025-2026):**
Shared memory in multi-agent systems requires **explicit scoping** to prevent context pollution and security breaches. Production systems use **hierarchical scoping**: global context (all agents), namespace context (agent group), agent-specific context (single agent).

**Production Memory Architecture (Verified 2025-2026):**

**SAMEP (Secure Agent Memory Exchange Protocol) Pattern:**

**1. Multi-Layered Security with Hierarchical Access Control**
- **Public memory**: Accessible to all agents (e.g., user profile, conversation metadata)
- **Private memory**: Accessible only to specific agent (e.g., agent-specific state)
- **Namespace-scoped memory**: Accessible to agent group (e.g., all billing agents)
- **Encrypted memory**: AES-256-GCM encryption for sensitive data
- **ACL-based permissions**: Fine-grained access control per memory item

**2. Persistent Memory with Lifecycle Management**
- Memory persists across sessions (not just in-memory)
- Automatic cleanup of stale memory (TTL-based expiration)
- Audit trail for all memory access (compliance requirement)

**3. Semantic Discovery**
- Vector-based search for historical context
- Agents can query "similar conversations" without accessing raw memory
- Reduces context window size (retrieve only relevant memory)

**Benefits**:
- 73% reduction in redundant computations (agents reuse memory instead of recomputing)
- 89% improvement in context relevance (semantic search finds relevant memory)
- HIPAA compliance (audit trail, encryption, access control)

**Agentfield Shared Memory Pattern:**

**1. Zero-Config Distributed State**
- Automatic hierarchical scoping (no manual Redis setup)
- Consistency guarantees (ACID transactions)
- Durable storage across process boundaries

**2. Real-Time Change Events**
- Agents notified when shared memory changes
- Enables reactive patterns (Agent B reacts to Agent A's state change)
- Avoids polling (reduces latency and cost)

**3. Automatic Cleanup**
- Lifecycle management (memory expires after N days)
- Prevents memory bloat (unbounded growth)

**Memory Scoping Patterns (Production Standard 2026):**

**Scope 1: Session Memory (Conversation-Specific)**
- Lifetime: Duration of conversation (10-60 minutes)
- Access: All agents in current conversation
- Examples: Current conversation state, user intent, pending actions
- Storage: Redis (in-memory, fast access)

**Scope 2: User Memory (User-Specific, Cross-Session)**
- Lifetime: Duration of user relationship (months to years)
- Access: All agents for specific user
- Examples: User preferences, conversation history, account data
- Storage: PostgreSQL (durable, queryable)

**Scope 3: Agent Memory (Agent-Specific, Cross-User)**
- Lifetime: Duration of agent deployment (weeks to months)
- Access: Only specific agent
- Examples: Agent-specific state, learned patterns, optimization data
- Storage: PostgreSQL (durable, queryable)

**Scope 4: Global Memory (Platform-Wide)**
- Lifetime: Indefinite (or until explicitly deleted)
- Access: All agents (read-only for most)
- Examples: Knowledge base, policies, product catalog
- Storage: PostgreSQL or vector database (for semantic search)

**Access Control Patterns:**

**Pattern 1: Read-Only vs Read-Write**
- Most agents have read-only access to global memory
- Only specific agents can write to global memory (e.g., admin agent)
- Prevents accidental corruption of shared data

**Pattern 2: Namespace Isolation**
- Agents in different namespaces cannot access each other's memory
- Example: Billing agents cannot access technical support agents' memory
- Enforced at database level (row-level security)

**Pattern 3: Encryption for Sensitive Data**
- PII (names, phone numbers, credit cards) encrypted at rest
- Only agents with decryption keys can access
- Audit trail for all decryption attempts

**V1-AWARE Requirements:**

**1. Centralized Memory Store (MUST exist in V1)**
- Conversation state stored in PostgreSQL (not in-memory only)
- Structured schema (not free-form)
- Enables future agents to access same memory
- **V1 implementation**: Single agent stores state in PostgreSQL

**2. Memory Scoping Schema (MUST exist in V1)**
- Define scopes: session, user, agent, global
- Even though V1 has single agent, design schema for multi-agent
- Enables future agents to use same schema without migration
- **V1 implementation**: Create tables with scope columns (session_id, user_id, agent_id)

**3. Access Control Framework (MUST exist in V1)**
- Row-level security (RLS) enforces access control
- Even though V1 has single agent, design for multi-agent permissions
- Enables future agents to have different permissions
- **V1 implementation**: Enable RLS on memory tables, create policies

**V2-ONLY Features:**
- Multiple agent instances with different memory scopes
- Agent-to-agent memory sharing protocols
- Semantic memory search (vector database)
- Real-time memory change events

### How Failures in One Agent Are Contained

**Core Insight (2025-2026):**
Agent failures must be **contained** to prevent cascading failures across squad. Production systems use **circuit breakers**, **timeouts**, and **fallback agents** to isolate failures.

**Production Failure Containment Patterns (Verified 2025-2026):**

**Pattern 1: Per-Agent Circuit Breakers**

**Implementation**:
- Track error rate per agent (errors / total requests)
- If Agent A error rate >50% for >5 minutes, open circuit breaker for Agent A
- Route requests to fallback agent (Agent B) or human escalation
- After timeout (e.g., 60 seconds), enter half-open state (allow limited requests to test recovery)

**Benefits**:
- **Failure isolation**: Agent A's failures don't affect Agent B
- **Automatic recovery**: Circuit breaker closes when Agent A recovers
- **Graceful degradation**: Service continues with fallback agent

**V1-AWARE**: Design state machine to support fallback states (if Agent A fails, route to fallback)

**Pattern 2: Per-Agent Timeouts**

**Implementation**:
- Set timeout per agent (e.g., Agent A: 5 seconds, Agent B: 10 seconds)
- If agent doesn't respond within timeout, cancel request and route to fallback
- Log timeout for debugging

**Benefits**:
- **Prevents hanging**: Agent A timeout doesn't block entire conversation
- **Predictable latency**: Maximum latency known (timeout value)
- **Failure detection**: Timeouts indicate agent health issues

**V1-AWARE**: Implement timeouts for all external calls (STT, LLM, TTS) in V1

**Pattern 3: Fallback Agent Chain**

**Implementation**:
- Define fallback chain: Agent A → Agent B → Human
- If Agent A fails, route to Agent B
- If Agent B fails, escalate to human
- Log fallback reason for debugging

**Benefits**:
- **Graceful degradation**: Service continues even if multiple agents fail
- **Customer experience**: Customer doesn't see failure, just handoff
- **Debugging**: Fallback logs identify systemic issues

**V1-AWARE**: Design state machine to support fallback states (primary → fallback → human)

**Pattern 4: Agent-Specific Error Budgets**

**Implementation**:
- Set error budget per agent (e.g., Agent A: 5% error rate acceptable)
- If Agent A exceeds error budget, alert operator
- Operator investigates and fixes Agent A
- Don't automatically disable Agent A (may be temporary issue)

**Benefits**:
- **Proactive monitoring**: Detect degradation before catastrophic failure
- **Operator control**: Human decides when to disable agent
- **Avoid false positives**: Temporary spikes don't trigger automatic disablement

**V1-AWARE**: Implement error rate monitoring for single agent in V1

**Pattern 5: Agent Health Checks**

**Implementation**:
- Periodic health checks per agent (e.g., every 60 seconds)
- Health check calls simple test endpoint (e.g., "ping")
- If health check fails 3 times in a row, mark agent unhealthy
- Route requests to fallback agent until health check passes

**Benefits**:
- **Proactive failure detection**: Detect failures before customer requests
- **Automatic recovery**: Agent marked healthy when health check passes
- **Low overhead**: Simple ping doesn't consume resources

**V1-AWARE**: Implement health checks for external services (STT, LLM, TTS) in V1

**Failure Containment Anti-Patterns (Observed 2025):**

**Anti-Pattern 1: Shared Circuit Breaker**
- All agents share same circuit breaker
- Agent A fails → circuit breaker opens for all agents
- **Result**: Platform-wide outage from single agent failure

**Anti-Pattern 2: No Fallback**
- Agent A fails → conversation ends
- No fallback agent or human escalation
- **Result**: Poor customer experience, lost revenue

**Anti-Pattern 3: Infinite Retry**
- Agent A fails → retry indefinitely
- No circuit breaker or timeout
- **Result**: Wasted resources, increased latency, cost explosion

**Anti-Pattern 4: No Failure Logging**
- Agent A fails → no log
- Cannot debug or identify root cause
- **Result**: Repeated failures, cannot fix underlying issue

**V1-AWARE Requirements:**

**1. Circuit Breaker Framework (MUST exist in V1)**
- Implement circuit breakers for external services (STT, LLM, TTS)
- Track error rate per service
- Design for per-agent circuit breakers in V2
- **V1 implementation**: Global circuit breakers (research/16-multi-tenant-isolation.md)

**2. Timeout Framework (MUST exist in V1)**
- Implement timeouts for all external calls
- Configurable per service
- Design for per-agent timeouts in V2
- **V1 implementation**: Global timeouts for STT, LLM, TTS

**3. Fallback State Machine (MUST exist in V1)**
- State machine supports fallback states
- If primary path fails, route to fallback path
- Design for multi-agent fallback chains in V2
- **V1 implementation**: Primary → human escalation

**4. Error Monitoring (MUST exist in V1)**
- Track error rate per service
- Alert on error rate spikes
- Design for per-agent error monitoring in V2
- **V1 implementation**: Global error rate monitoring

**V2-ONLY Features:**
- Per-agent circuit breakers (not global)
- Agent-specific error budgets
- Multi-agent fallback chains (Agent A → Agent B → Agent C → Human)
- Agent health checks (not just service health checks)

## Common Failure Modes (Observed in Real Systems)

### 1. Context Loss During Handoff (80% of Naive Implementations)
**Symptom**: Agent A hands off to Agent B. Agent B asks customer to repeat information already provided to Agent A.

**Root cause**: Handoff passes conversation log (unstructured text) instead of structured state. Agent B cannot parse Agent A's context.

**Production impact**: Poor customer experience (must repeat information), increased call duration, customer frustration.

**Observed in**: Multi-agent systems without structured state transfer (2025 research: 80% context loss rate).

**Mitigation**:
- Use structured state transfer (JSON schema, not conversation log)
- Centralized state store (both agents read/write to same state)
- Explicit handoff messages with metadata (user_id, session_id, context_summary)
- Test handoffs: Verify Agent B has all information from Agent A

---

### 2. Latency Explosion from Handoff Overhead (3-6 Second P95)
**Symptom**: Single-agent system: P95 latency 800ms. Multi-agent system: P95 latency 3-6 seconds.

**Root cause**: Each handoff adds 200-500ms overhead (LLM classification + context transfer + agent initialization). Multiple handoffs compound latency.

**Production impact**: Breaks conversational flow (>1 second response time feels unnatural). Customer hangs up.

**Observed in**: Multi-agent systems with probabilistic routing (LLM classifier for every handoff).

**Mitigation**:
- Use deterministic routing (state machine, no LLM call) for critical paths
- Minimize handoffs (design agents to handle broader scope)
- Pre-warm agents (keep agent instances running, don't initialize on handoff)
- Monitor handoff latency, alert if >500ms

---

### 3. Infinite Handoff Loops (5-10% of Handoffs)
**Symptom**: Agent A hands off to Agent B. Agent B hands back to Agent A. Repeat until timeout.

**Root cause**: No termination logic. Neither agent confident in handling request, keep bouncing back and forth.

**Production impact**: Timeout, customer frustration, wasted LLM calls, cost explosion.

**Observed in**: Multi-agent systems without explicit termination conditions (AutoGen, LangGraph without termination logic).

**Mitigation**:
- Implement max handoff count (e.g., max 3 handoffs per conversation)
- Implement handoff loop detection (if Agent A → Agent B → Agent A, escalate to human)
- Require confidence threshold for handoff (if confidence <70%, don't hand off)
- Fallback to human escalation after N handoffs

---

### 4. Cost Explosion from Inter-Agent Communication (2x LLM Costs)
**Symptom**: Single-agent system: $0.15/call LLM cost. Multi-agent system: $0.30/call LLM cost.

**Root cause**: Inter-agent communication overhead consumes more tokens than actual reasoning. Each handoff requires LLM classification + context summarization.

**Production impact**: Margin collapse (LLM costs double). Cannot sustain multi-agent economics.

**Observed in**: Multi-agent systems with probabilistic routing and full context transfer (2025 research: communication overhead dominates token usage).

**Mitigation**:
- Use deterministic routing (no LLM classification)
- Use structured state transfer (not full conversation history)
- Minimize handoffs (design agents to handle broader scope)
- Monitor LLM token usage per agent, alert on spikes

---

### 5. Handoff Hallucination (10-15% False Positives)
**Symptom**: LLM decides to hand off when it shouldn't. Simple question routed to specialist agent unnecessarily.

**Root cause**: Prompt-only handoff logic. LLM classification accuracy 70-85%, not 99%+.

**Production impact**: Increased latency (unnecessary handoff overhead), increased cost (extra LLM calls), poor customer experience.

**Observed in**: Multi-agent systems with prompt-only coordination ("decide which agent should handle this").

**Mitigation**:
- Use deterministic routing for common cases (state machine)
- Use LLM classification only for ambiguous cases
- Require high confidence threshold for handoff (>80%)
- Monitor false positive rate, adjust prompts or routing logic

---

### 6. Handoff Omission (15-20% False Negatives)
**Symptom**: LLM fails to hand off when it should. Complex question requiring specialist handled by generalist agent, fails.

**Root cause**: Prompt-only handoff logic. LLM tries to answer itself instead of handing off.

**Production impact**: Poor task success rate, customer frustration, escalation to human.

**Observed in**: Multi-agent systems with prompt-only coordination.

**Mitigation**:
- Use deterministic routing for critical paths (state machine)
- Implement capability checks (if Agent A doesn't have required tool, must hand off)
- Monitor task success rate per agent, identify patterns requiring handoff
- Add explicit handoff triggers (e.g., "if user asks about billing, hand off to billing agent")

---

### 7. Agent Failure Cascade (Platform-Wide Outage)
**Symptom**: Agent A fails. All requests routed to Agent A fail. No fallback. Platform-wide outage.

**Root cause**: No circuit breaker or fallback logic. Agent failures not contained.

**Production impact**: Platform-wide outage from single agent failure. All customers affected.

**Observed in**: Multi-agent systems without failure containment (no circuit breakers, no fallbacks).

**Mitigation**:
- Implement per-agent circuit breakers (isolate failures)
- Implement fallback agent chain (Agent A → Agent B → Human)
- Monitor agent health, disable unhealthy agents automatically
- Test failure scenarios: Verify fallback works when Agent A fails

---

### 8. Memory Scope Pollution (Agent A Sees Agent B's Context)
**Symptom**: Agent A sees conversation history from Agent B. Responds with information from Agent B's conversation.

**Root cause**: No memory scoping. All agents share same memory without isolation.

**Production impact**: Context pollution, incorrect responses, potential data leakage (Agent A sees Agent B's sensitive data).

**Observed in**: Multi-agent systems without explicit memory scoping.

**Mitigation**:
- Implement memory scoping (session, user, agent, global)
- Use row-level security (RLS) to enforce memory isolation
- Test memory isolation: Verify Agent A cannot access Agent B's memory
- Audit memory access for compliance

---

### 9. No Handoff Observability (Cannot Debug Failures)
**Symptom**: Handoff fails. Cannot determine why (which agent failed, what was context, what was decision).

**Root cause**: No logging or tracing for handoffs. Handoff decisions not recorded.

**Production impact**: Cannot debug handoff failures. Cannot improve handoff logic. Repeated failures.

**Observed in**: Multi-agent systems without observability (no distributed tracing, no handoff logs).

**Mitigation**:
- Log all handoff decisions (from_agent, to_agent, reason, confidence, context)
- Implement distributed tracing (trace_id across all agents)
- Dashboard shows handoff metrics (handoff rate, success rate, latency)
- Alert on handoff anomalies (high failure rate, high latency)

---

### 10. Prompt Engineering Unpredictability (Works Sometimes, Fails Others)
**Symptom**: Multi-agent prompting works in testing, fails in production. Same input produces different handoff decisions.

**Root cause**: Prompt engineering is unpredictable. Techniques that work in one context fail in another.

**Production impact**: Unreliable handoffs. Cannot trust multi-agent system. Must fall back to single-agent.

**Observed in**: Multi-agent systems relying on prompt-only coordination (2025 research: prompt engineering highly contingent).

**Mitigation**:
- Don't use prompts for coordination (use explicit orchestration)
- Use deterministic routing (state machine, not LLM)
- Test extensively: 1000+ test cases covering edge cases
- Monitor handoff reliability in production, alert on degradation

## Proven Patterns & Techniques

### 1. Centralized State Store with Structured Schema (V1-AWARE)
**Pattern**: Store conversation state in centralized location (PostgreSQL) with structured schema (JSON). All agents read/write to same state.

**Implementation**:
- Define state schema: session state, user state, conversation state
- Store in PostgreSQL with row-level security (RLS)
- Agents read state at start, write state at end
- State includes: user_id, session_id, current_state, conversation_history, pending_actions

**Benefits**:
- **No context loss**: All agents access same state
- **Enables handoffs**: Agent B reads state written by Agent A
- **Durable**: State persists across agent restarts
- **Queryable**: Can analyze state for debugging

**V1 implementation**: Single agent uses centralized state store. Design schema for multi-agent extensibility.

**V2 extension**: Multiple agents read/write to same state store. Add agent_id column for per-agent state.

---

### 2. Explicit State Machine with Routing States (V1-AWARE)
**Pattern**: Use explicit state machine (Pipecat Flows) for conversation flow. Design states to support future agent routing.

**Implementation**:
- Define states: greeting, collecting_info, processing, confirming, completed
- Add routing states: classify_intent, route_to_agent, handoff_to_human
- Guards determine transitions (deterministic, not LLM-based)
- State machine logs all transitions for debugging

**Benefits**:
- **Deterministic routing**: Same input produces same transition
- **Debuggable**: Can trace exact state transitions
- **Extensible**: Can add new states for new agents without rewriting

**V1 implementation**: State machine for single agent. Include routing states (unused in V1, used in V2).

**V2 extension**: Routing states activate. classify_intent state uses LLM to determine which agent. route_to_agent state hands off to selected agent.

---

### 3. Structured Handoff Messages with Metadata (V2-ONLY)
**Pattern**: Handoffs use structured messages (JSON schema) with metadata, not free-form text.

**Implementation**:
```json
{
  "handoff_type": "agent_to_agent",
  "from_agent": "general_agent",
  "to_agent": "billing_agent",
  "user_id": "user_123",
  "session_id": "session_456",
  "timestamp": "2026-02-03T14:23:45Z",
  "reason": "user_requested_billing_info",
  "confidence": 0.95,
  "context_summary": {
    "user_intent": "check_invoice",
    "account_number": "12345",
    "invoice_id": "INV-789"
  },
  "conversation_state": {
    "current_state": "needs_billing_info",
    "pending_actions": ["retrieve_invoice"]
  }
}
```

**Benefits**:
- **No context loss**: Structured context ensures Agent B has all information
- **Parseable**: Agent B can parse handoff message programmatically
- **Auditable**: Handoff messages logged for compliance
- **Versioned**: Schema version enables evolution without breaking

**V2 implementation**: Define handoff message schema. Validate all handoffs against schema.

---

### 4. Supervisor Pattern with Centralized Orchestrator (V2-ONLY)
**Pattern**: Centralized orchestrator routes requests to specialized agents. Agents don't communicate directly.

**Implementation**:
- Orchestrator receives user request
- Orchestrator classifies intent (deterministic or LLM-based)
- Orchestrator routes to appropriate agent
- Agent processes request, returns response to orchestrator
- Orchestrator sends response to user

**Benefits**:
- **Centralized control**: All routing logic in one place
- **No agent-to-agent communication**: Simpler, more reliable
- **Easier debugging**: Orchestrator logs all routing decisions
- **Scalable**: Can add new agents without changing existing agents

**Production examples**: AWS Agent Squad, LangGraph supervisor pattern, Microsoft Agent Framework

**V2 implementation**: Add orchestrator service. Agents register with orchestrator. Orchestrator routes based on state machine + LLM classification.

---

### 5. Per-Agent Circuit Breakers with Fallback Chain (V2-ONLY)
**Pattern**: Each agent has circuit breaker. If agent fails, route to fallback agent or human.

**Implementation**:
- Track error rate per agent (errors / total requests)
- If Agent A error rate >50% for >5 minutes, open circuit breaker
- Route requests to fallback agent (Agent B) or human escalation
- After timeout (60 seconds), enter half-open state (test recovery)

**Benefits**:
- **Failure isolation**: Agent A failure doesn't affect Agent B
- **Automatic recovery**: Circuit breaker closes when Agent A recovers
- **Graceful degradation**: Service continues with fallback

**V1-AWARE**: Implement circuit breakers for external services (STT, LLM, TTS). Design for per-agent circuit breakers in V2.

**V2 implementation**: Per-agent circuit breakers. Fallback chain: Agent A → Agent B → Human.

---

### 6. Memory Scoping with Row-Level Security (V1-AWARE)
**Pattern**: Memory scoped by session, user, agent, global. Row-level security (RLS) enforces isolation.

**Implementation**:
```sql
-- Enable RLS on memory table
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can only access their own memory
CREATE POLICY agent_memory_isolation ON agent_memory
  FOR SELECT
  USING (agent_id = current_setting('app.current_agent_id')::uuid);

-- Policy: Agents can access session memory for current session
CREATE POLICY session_memory_access ON agent_memory
  FOR SELECT
  USING (scope = 'session' AND session_id = current_setting('app.current_session_id')::uuid);
```

**Benefits**:
- **Memory isolation**: Agent A cannot access Agent B's memory
- **Enforced at database level**: Cannot bypass with application code
- **Flexible scoping**: Can grant access to specific memory scopes

**V1 implementation**: Define memory table with scope columns. Enable RLS. Single agent uses session and user scopes.

**V2 extension**: Multiple agents use agent scope. RLS enforces per-agent isolation.

---

### 7. Deterministic Routing with Confidence Thresholds (V2-ONLY)
**Pattern**: Use deterministic routing for common cases. Use LLM classification only for ambiguous cases with confidence thresholds.

**Implementation**:
- State machine defines deterministic routes (e.g., "if state = needs_billing, route to billing_agent")
- For ambiguous cases, use LLM classifier
- If LLM confidence >80%, route to selected agent
- If LLM confidence <80%, route to generalist agent or human

**Benefits**:
- **Low latency**: Most requests use deterministic routing (no LLM call)
- **Low cost**: LLM only called for ambiguous cases
- **Reliable**: Deterministic routing has 99%+ accuracy

**V2 implementation**: State machine with routing states. Routing state checks confidence threshold, uses deterministic or LLM-based routing.

---

### 8. Agent Health Checks with Automatic Disablement (V2-ONLY)
**Pattern**: Periodic health checks per agent. If health check fails, mark agent unhealthy and route to fallback.

**Implementation**:
- Health check every 60 seconds per agent
- Health check calls simple test endpoint (e.g., "ping")
- If health check fails 3 times in a row, mark agent unhealthy
- Route requests to fallback agent until health check passes
- Alert operator when agent marked unhealthy

**Benefits**:
- **Proactive failure detection**: Detect failures before customer requests
- **Automatic recovery**: Agent marked healthy when health check passes
- **Low overhead**: Simple ping doesn't consume resources

**V1-AWARE**: Implement health checks for external services (STT, LLM, TTS). Design for per-agent health checks in V2.

**V2 implementation**: Per-agent health checks. Automatic disablement and fallback routing.

---

### 9. Handoff Observability with Distributed Tracing (V2-ONLY)
**Pattern**: Log all handoff decisions. Use distributed tracing (trace_id) to correlate across agents.

**Implementation**:
- Generate trace_id at conversation start
- Propagate trace_id through all agents
- Log handoff decisions with trace_id: from_agent, to_agent, reason, confidence, context
- Dashboard shows handoff metrics: handoff rate, success rate, latency, error rate
- Alert on handoff anomalies: high failure rate, high latency

**Benefits**:
- **Debuggable**: Can trace handoff decisions across agents
- **Measurable**: Can measure handoff performance
- **Alertable**: Can detect handoff degradation

**V1-AWARE**: Implement distributed tracing for single agent (research/09-event-spine.md). Design for multi-agent tracing in V2.

**V2 implementation**: Handoff logs include trace_id. Dashboard shows per-agent and cross-agent metrics.

---

### 10. Minimal Viable Squad (Start with 2 Agents, Not 10) (V2-ONLY)
**Pattern**: Start with minimal squad (2-3 agents), not complex squad (10+ agents). Validate before expanding.

**Implementation**:
- V2 Phase 1: Add 1 specialist agent (e.g., billing_agent) + generalist agent
- Measure: Handoff success rate, latency, cost, task success rate
- If metrics acceptable, add 2nd specialist agent (e.g., technical_support_agent)
- Repeat: Add agents incrementally, validate each addition

**Benefits**:
- **Lower risk**: Small changes, easy to debug
- **Faster validation**: Can measure impact of each agent
- **Avoid complexity**: Don't build complex squad before validating simple squad

**V2 implementation**: Start with generalist + 1 specialist. Expand incrementally based on metrics.

## Engineering Rules (Binding)

### R1: V1 MUST Use Centralized State Store (Not Agent-Specific State)
**Rule**: Conversation state MUST be stored in centralized location (PostgreSQL), not agent-specific memory. State MUST be structured (JSON schema).

**Rationale**: Enables future agents to access same state without migration. Agent-specific state blocks multi-agent in V2.

**Implementation**: Single agent stores state in PostgreSQL. Define schema with session_id, user_id, state columns.

**Verification**: State stored in PostgreSQL. Can query state by session_id. State is structured JSON.

---

### R2: V1 MUST Use Explicit State Machine (Not Prompt-Only Control)
**Rule**: Conversation flow MUST be controlled by explicit state machine (Pipecat Flows), not prompt-only control.

**Rationale**: Enables deterministic routing to future agents. Prompt-only control unreliable for multi-agent.

**Implementation**: Use Pipecat Flows for state machine. Define states and transitions explicitly.

**Verification**: State machine controls conversation flow. No prompt-only coordination.

---

### R3: V1 State Schema MUST Include Routing States (Unused in V1)
**Rule**: State machine MUST include routing states (classify_intent, route_to_agent, handoff_to_human) even though unused in V1.

**Rationale**: Enables V2 multi-agent without state machine rewrite. Adding states later requires migration.

**Implementation**: Define routing states in state machine. Leave transitions unimplemented (will be implemented in V2).

**Verification**: State machine includes routing states. States documented for V2 implementation.

---

### R4: V1 Memory Schema MUST Include Scope Columns (agent_id, session_id, user_id)
**Rule**: Memory tables MUST include scope columns (agent_id, session_id, user_id) even though V1 has single agent.

**Rationale**: Enables V2 per-agent memory without schema migration. Adding columns later requires migration.

**Implementation**: Create memory tables with agent_id, session_id, user_id columns. V1 uses single agent_id value.

**Verification**: Memory tables have scope columns. RLS policies defined (even if simple in V1).

---

### R5: V1 MUST Implement Circuit Breakers for External Services
**Rule**: Circuit breakers MUST be implemented for external services (STT, LLM, TTS). Track error rate, open circuit breaker if error rate >50%.

**Rationale**: Enables V2 per-agent circuit breakers. Framework exists, just extend to per-agent.

**Implementation**: Global circuit breakers for STT, LLM, TTS. Track error rate per service.

**Verification**: Circuit breakers implemented. Test: Inject errors, verify circuit breaker opens.

---

### R6: V1 MUST Implement Distributed Tracing with trace_id
**Rule**: All events MUST include trace_id for distributed tracing. Propagate trace_id through all components.

**Rationale**: Enables V2 multi-agent tracing. trace_id correlates events across agents.

**Implementation**: Generate trace_id at conversation start. Include in all events (research/09-event-spine.md).

**Verification**: All events have trace_id. Can trace conversation through all components.

---

### R7: V2 Handoffs MUST Use Structured Messages (Not Free-Form Text)
**Rule**: Handoff messages MUST use structured schema (JSON), not free-form text. Schema MUST be versioned.

**Rationale**: Prevents context loss. Enables parsing and validation. Allows schema evolution.

**Implementation**: Define handoff message schema. Validate all handoffs against schema.

**Verification**: Handoffs use structured messages. Schema validation passes.

---

### R8: V2 MUST Use Deterministic Routing for Critical Paths
**Rule**: Critical paths MUST use deterministic routing (state machine), not LLM-based routing. LLM routing only for ambiguous cases.

**Rationale**: Deterministic routing more reliable (99%+ accuracy vs 70-85% for LLM). Lower latency, lower cost.

**Implementation**: State machine defines deterministic routes. LLM classification only for ambiguous cases.

**Verification**: Critical paths use deterministic routing. Measure routing accuracy (>99%).

---

### R9: V2 MUST Implement Per-Agent Circuit Breakers
**Rule**: Each agent MUST have circuit breaker. If agent error rate >50%, open circuit breaker and route to fallback.

**Rationale**: Isolates agent failures. Prevents cascading failures across squad.

**Implementation**: Track error rate per agent. Open circuit breaker if threshold exceeded. Route to fallback agent.

**Verification**: Per-agent circuit breakers implemented. Test: Agent A fails, verify Agent B unaffected.

---

### R10: V2 MUST Limit Handoffs Per Conversation (Max 3)
**Rule**: Maximum 3 handoffs per conversation. If 3 handoffs reached, escalate to human (no more agent handoffs).

**Rationale**: Prevents infinite handoff loops. Limits latency and cost from excessive handoffs.

**Implementation**: Track handoff count per conversation. If count >=3, route to human escalation.

**Verification**: Handoff count tracked. Test: 4th handoff attempt routes to human.

## Metrics & Signals to Track

### Handoff Metrics (V2-ONLY)

**Handoff Rate:**
- Handoffs per conversation
- Percentage of conversations with handoffs
- Handoffs per agent (which agents hand off most)

**Handoff Success Rate:**
- Successful handoffs (Agent B successfully handles request)
- Failed handoffs (Agent B cannot handle, must hand off again or escalate)
- Target: >90% success rate

**Handoff Latency:**
- Time from handoff decision to Agent B response
- P50/P95/P99 handoff latency
- Target: P95 <500ms

**Handoff Loop Detection:**
- Conversations with >1 handoff to same agent (loop detected)
- Conversations with >3 total handoffs (excessive handoffs)
- Alert: Handoff loop detected

### Agent Performance Metrics (V2-ONLY)

**Per-Agent Task Success Rate:**
- Task success rate per agent
- Compare: Which agents have highest success rate
- Alert: Agent success rate <80%

**Per-Agent Error Rate:**
- Error rate per agent (errors / total requests)
- Alert: Agent error rate >5%

**Per-Agent Latency:**
- P50/P95/P99 latency per agent
- Compare: Which agents are slowest
- Alert: Agent P95 latency >2 seconds

**Per-Agent Cost:**
- LLM token usage per agent
- Cost per request per agent
- Compare: Which agents are most expensive

### Memory Metrics (V2-ONLY)

**Memory Scope Usage:**
- Memory items per scope (session, user, agent, global)
- Memory size per scope (bytes)
- Alert: Memory size >1GB per scope

**Memory Access Patterns:**
- Memory reads per agent
- Memory writes per agent
- Memory access latency (P50/P95/P99)

**Memory Isolation Violations:**
- Attempts to access memory outside scope
- RLS policy violations
- Alert: Isolation violation detected (security incident)

### Circuit Breaker Metrics (V2-ONLY)

**Circuit Breaker State:**
- Circuit breakers open per agent
- Time circuit breaker open per agent
- Alert: Circuit breaker open >5 minutes

**Circuit Breaker Triggers:**
- Number of times circuit breaker opened per agent
- Reason for circuit breaker opening (error rate, timeout, health check failure)
- Alert: Circuit breaker opened >3 times in 1 hour

### Context Transfer Metrics (V2-ONLY)

**Context Loss Rate:**
- Handoffs where Agent B must re-prompt for information
- Percentage of handoffs with context loss
- Target: <10% context loss rate

**Context Transfer Size:**
- Size of context transferred per handoff (bytes, tokens)
- Alert: Context transfer >10KB (indicates full conversation history transfer, not structured state)

## V1 Decisions / Constraints

### D-SQUAD-001 V1 MUST Use Centralized State Store in PostgreSQL
**Decision**: Conversation state stored in PostgreSQL with structured schema (JSON). Single agent reads/writes to central state store.

**Rationale**: Enables V2 multi-agent without migration. Centralized state allows future agents to access same state.

**Constraints**: Must define state schema with session_id, user_id, agent_id columns (even though V1 has single agent).

---

### D-SQUAD-002 V1 MUST Use Pipecat Flows for State Machine
**Decision**: Conversation flow controlled by Pipecat Flows (explicit state machine), not prompt-only control.

**Rationale**: Enables V2 deterministic routing to agents. Prompt-only control unreliable for multi-agent.

**Constraints**: Must define routing states (classify_intent, route_to_agent, handoff_to_human) even though unused in V1.

---

### D-SQUAD-003 V1 State Machine MUST Include Routing States (Unused in V1)
**Decision**: State machine includes routing states for V2 multi-agent. States defined but transitions unimplemented in V1.

**Rationale**: Prevents state machine rewrite in V2. Adding states later requires migration.

**Constraints**: Document routing states for V2 implementation. Do not implement transitions in V1.

---

### D-SQUAD-004 V1 Memory Tables MUST Include Scope Columns
**Decision**: Memory tables include agent_id, session_id, user_id columns. V1 uses single agent_id value.

**Rationale**: Enables V2 per-agent memory without schema migration.

**Constraints**: Enable row-level security (RLS) on memory tables. Define policies for V2 per-agent isolation.

---

### D-SQUAD-005 V1 MUST Implement Circuit Breakers for External Services
**Decision**: Global circuit breakers for STT, LLM, TTS. Track error rate per service, open circuit breaker if >50%.

**Rationale**: Framework exists for V2 per-agent circuit breakers. Just extend to per-agent.

**Constraints**: Monitor error rate per service. Alert if circuit breaker opens.

---

### D-SQUAD-006 V1 MUST Implement Distributed Tracing with trace_id
**Decision**: Generate trace_id at conversation start. Include in all events for distributed tracing.

**Rationale**: Enables V2 multi-agent tracing. trace_id correlates events across agents.

**Constraints**: Propagate trace_id through all components (research/09-event-spine.md).

---

### D-SQUAD-007 V2 Multi-Agent Explicitly NOT in V1
**Decision**: V1 has single agent only. No multi-agent, no handoffs, no agent-to-agent communication.

**Rationale**: Simplicity. Multi-agent adds complexity without validated need. Build foundation first.

**Constraints**: Do not implement multi-agent features in V1. Focus on single-agent reliability.

---

### D-SQUAD-008 V2 MUST Use Structured Handoff Messages (JSON Schema)
**Decision**: V2 handoffs use structured messages with JSON schema, not free-form text. Schema versioned.

**Rationale**: Prevents context loss. Enables parsing and validation.

**Constraints**: Define handoff message schema in V2. Validate all handoffs against schema.

---

### D-SQUAD-009 V2 MUST Use Deterministic Routing for Critical Paths
**Decision**: V2 critical paths use deterministic routing (state machine). LLM classification only for ambiguous cases.

**Rationale**: Deterministic routing more reliable (99%+ vs 70-85% LLM). Lower latency, lower cost.

**Constraints**: State machine defines deterministic routes. Measure routing accuracy (>99%).

---

### D-SQUAD-010 V2 MUST Implement Per-Agent Circuit Breakers
**Decision**: V2 has circuit breaker per agent. If agent error rate >50%, open circuit breaker and route to fallback.

**Rationale**: Isolates agent failures. Prevents cascading failures.

**Constraints**: Track error rate per agent. Implement fallback agent chain.

---

### D-SQUAD-011 V2 MUST Limit Handoffs to Max 3 Per Conversation
**Decision**: V2 allows maximum 3 handoffs per conversation. 4th handoff attempt escalates to human.

**Rationale**: Prevents infinite handoff loops. Limits latency and cost.

**Constraints**: Track handoff count per conversation. Enforce limit.

---

### D-SQUAD-012 V2 MUST Start with Minimal Squad (2-3 Agents)
**Decision**: V2 starts with generalist agent + 1-2 specialist agents. Expand incrementally based on metrics.

**Rationale**: Lower risk. Easier to debug. Validate before expanding.

**Constraints**: Add agents one at a time. Measure impact of each addition.

---

### D-SQUAD-013 V2 MUST Implement Handoff Observability
**Decision**: V2 logs all handoff decisions with trace_id. Dashboard shows handoff metrics.

**Rationale**: Enables debugging and optimization. Can measure handoff performance.

**Constraints**: Log: from_agent, to_agent, reason, confidence, context. Dashboard: handoff rate, success rate, latency.

---

### D-SQUAD-014 V2 MUST Implement Memory Scoping with RLS
**Decision**: V2 memory scoped by session, user, agent, global. Row-level security (RLS) enforces isolation.

**Rationale**: Prevents memory pollution. Enforces security at database level.

**Constraints**: Define RLS policies per scope. Test memory isolation.

---

### D-SQUAD-015 V2 Supervisor Pattern Preferred Over Agent-to-Agent
**Decision**: V2 uses supervisor pattern (centralized orchestrator), not agent-to-agent communication.

**Rationale**: Simpler, more reliable. Centralized control easier to debug.

**Constraints**: Implement orchestrator service. Agents register with orchestrator.

## Open Questions / Risks

### Q1: How Many Agents Are Optimal for Voice AI?
**Question**: What's the optimal number of agents in squad? 2-3 specialists or 10+ specialists?

**Risk**: Too few agents → generalist agent overloaded. Too many agents → excessive handoffs, complexity.

**Mitigation options**:
- Start with 2-3 agents (generalist + 1-2 specialists)
- Measure task success rate, handoff rate, latency
- Add agents incrementally based on metrics
- Industry pattern: 4-6 agents optimal for most use cases

**V2 decision**: Start with 2-3 agents. Expand to 4-6 based on validated need.

---

### Q2: How to Handle Agent Versioning and Rollback?
**Question**: If Agent A updated, breaks, how to rollback? Does rollback affect other agents?

**Risk**: Agent update breaks squad. Cannot rollback without affecting other agents.

**Mitigation options**:
- Independent versioning per agent (Agent A v1.2, Agent B v1.0)
- Blue-green deployment per agent (run old and new versions, switch traffic)
- Canary deployment per agent (route 10% traffic to new version, monitor)
- Rollback affects only single agent (other agents unaffected)

**V2 decision**: Independent versioning per agent. Blue-green deployment per agent.

---

### Q3: How to Handle Cross-Agent Tool Access?
**Question**: Should Agent A be able to call tools registered by Agent B? Or each agent has own tools?

**Risk**: Shared tools → security risk (Agent A calls Agent B's sensitive tool). Separate tools → duplication.

**Mitigation options**:
- Shared tool registry with per-agent permissions (Agent A can call tool_X, Agent B cannot)
- Separate tools per agent (Agent A has tools_A, Agent B has tools_B)
- Hybrid: Common tools shared, sensitive tools per-agent

**V2 decision**: Shared tool registry with per-agent permissions (research/08-tool-gateway-design.md).

---

### Q4: How to Handle Agent-Specific Prompt Tuning?
**Question**: If Agent A prompt tuned, does it affect Agent B? Or each agent has own prompt?

**Risk**: Shared prompt → tuning Agent A breaks Agent B. Separate prompts → duplication.

**Mitigation options**:
- Separate prompts per agent (Agent A has prompt_A, Agent B has prompt_B)
- Shared base prompt + agent-specific overrides
- Prompt versioning per agent (Agent A uses prompt v1.2, Agent B uses prompt v1.0)

**V2 decision**: Separate prompts per agent. Shared base prompt for common instructions.

---

### Q5: How to Handle Agent Discovery and Registration?
**Question**: How do agents register with orchestrator? Static configuration or dynamic discovery?

**Risk**: Static configuration → must redeploy orchestrator to add agent. Dynamic discovery → complexity.

**Mitigation options**:
- Static configuration (agents defined in config file, loaded at startup)
- Dynamic registration (agents register with orchestrator via API at startup)
- Service discovery (orchestrator discovers agents via service registry)

**V2 decision**: Static configuration for V2. Dynamic registration deferred to V3.

---

### Q6: How to Handle Agent Load Balancing?
**Question**: If multiple instances of Agent A, how to load balance requests across instances?

**Risk**: All requests to single instance → overload. Uneven distribution → some instances idle.

**Mitigation options**:
- Round-robin load balancing (distribute evenly across instances)
- Least-connections load balancing (route to instance with fewest active requests)
- Sticky sessions (route same user to same instance for session continuity)

**V2 decision**: Round-robin for stateless agents. Sticky sessions for stateful agents.

---

### Q7: How to Handle Agent Failure During Handoff?
**Question**: If Agent A hands off to Agent B, but Agent B fails to initialize, what happens?

**Risk**: Handoff fails, conversation stuck. Customer must restart.

**Mitigation options**:
- Retry handoff (try Agent B again after delay)
- Fallback to Agent C (if Agent B fails, try Agent C)
- Fallback to human (if all agents fail, escalate to human)
- Return to Agent A (if Agent B fails, Agent A continues handling)

**V2 decision**: Fallback chain: Agent B → Agent C → Human. No return to Agent A (avoid loops).

---

### Q8: How to Handle Partial Context Transfer?
**Question**: Should handoff transfer full context or summary? Full context hits token limits, summary loses information.

**Risk**: Full context → token limit exceeded, high cost. Summary → context loss, poor task success.

**Mitigation options**:
- Structured state transfer (not full conversation history)
- Semantic summarization (LLM summarizes relevant context only)
- Sliding window (transfer last N turns only)
- Hybrid: Structured state + recent conversation history

**V2 decision**: Structured state transfer + last 5 turns of conversation history.

---

### Q9: How to Handle Agent-Specific Memory Cleanup?
**Question**: When Agent A no longer used, how to clean up its memory? Manual or automatic?

**Risk**: Manual cleanup → forgotten, memory bloat. Automatic cleanup → may delete needed memory.

**Mitigation options**:
- TTL-based expiration (memory expires after N days of inactivity)
- Reference counting (delete memory when no agents reference it)
- Manual cleanup (operator explicitly deletes agent memory)
- Archival (move old memory to cold storage instead of deleting)

**V2 decision**: TTL-based expiration (30 days). Archival for compliance (1 year).

---

### Q10: How to Measure Squad Effectiveness vs Single Agent?
**Question**: How to determine if squad provides value over single agent? What metrics prove ROI?

**Risk**: Squad adds complexity without improving metrics. Cannot justify cost/complexity.

**Mitigation options**:
- A/B test: 50% traffic to single agent, 50% to squad
- Measure: Task success rate, customer satisfaction, cost per call, latency
- Compare: Squad must show >10% improvement to justify complexity
- If no improvement, revert to single agent

**V2 decision**: A/B test squad vs single agent. Require >10% improvement in task success rate to justify.
