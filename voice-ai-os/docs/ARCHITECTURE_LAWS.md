# Platform Constitution: Architecture Laws

If a proposal violates these laws, the proposal is invalid—not the law.

This document is the canonical, binding source of truth for platform architecture.
All other documents (including decisions) must conform to these laws.

## Table of Contents
- [Why This Matters for V1](#why-this-matters-for-v1)
- [What Matters in Production (Facts Only)](#what-matters-in-production-facts-only)
  - [Layer 1: Voice Core (Invariant Runtime)](#layer-1-voice-core-invariant-runtime)
  - [Layer 2: Objective & Orchestration Layer](#layer-2-objective--orchestration-layer)
  - [Layer 3: Workflow / Automation Layer](#layer-3-workflow--automation-layer)
- [Common Failure Modes (Observed in Real Systems)](#common-failure-modes-observed-in-real-systems)
  - [FM-1: Workflow Controls Conversation Sequencing](#fm-1-workflow-controls-conversation-sequencing)
  - [FM-2: Capture Logic Embedded in Prompts](#fm-2-capture-logic-embedded-in-prompts)
  - [FM-3: Per-Customer Prompt Engineering](#fm-3-per-customer-prompt-engineering)
  - [FM-4: Workflows Block Conversation](#fm-4-workflows-block-conversation)
  - [FM-5: Workflow Failures Break Conversation](#fm-5-workflow-failures-break-conversation)
- [Proven Patterns & Techniques](#proven-patterns--techniques)
  - [P-1: Immutable Voice Core with Versioned Primitives](#p-1-immutable-voice-core-with-versioned-primitives)
  - [P-2: Declarative Objective Configuration](#p-2-declarative-objective-configuration)
  - [P-3: Event-Driven Workflow Triggering](#p-3-event-driven-workflow-triggering)
  - [P-4: Locale-Aware Primitive Library](#p-4-locale-aware-primitive-library)
  - [P-5: State Machine for Objective Execution](#p-5-state-machine-for-objective-execution)
- [Engineering Rules (Binding)](#engineering-rules-binding)
  - [R-ARCH-001: Three-Layer Architecture is Mandatory (No Exceptions)](#r-arch-001-three-layer-architecture-is-mandatory-no-exceptions)
  - [R-ARCH-002: Voice Core MUST Be Immutable Across Customers](#r-arch-002-voice-core-must-be-immutable-across-customers)
  - [R-ARCH-003: Objectives MUST Be Declarative (Not Imperative)](#r-arch-003-objectives-must-be-declarative-not-imperative)
  - [R-ARCH-004: Workflows MUST Be Asynchronous to Conversation](#r-arch-004-workflows-must-be-asynchronous-to-conversation)
  - [R-ARCH-005: Workflows MUST NOT Control Conversation Sequencing](#r-arch-005-workflows-must-not-control-conversation-sequencing)
  - [R-ARCH-006: Critical Data MUST Always Be Confirmed (Layer 1 Enforcement)](#r-arch-006-critical-data-must-always-be-confirmed-layer-1-enforcement)
  - [R-ARCH-007: Primitive Behavior MUST NOT Be Prompt-Configurable](#r-arch-007-primitive-behavior-must-not-be-prompt-configurable)
  - [R-ARCH-008: Locale MUST Be Customer-Configurable, Primitive Behavior Per Locale Immutable](#r-arch-008-locale-must-be-customer-configurable-primitive-behavior-per-locale-immutable)
  - [R-ARCH-009: Voice Core MUST Emit Events for Observability](#r-arch-009-voice-core-must-emit-events-for-observability)
  - [R-ARCH-010: Onboarding MUST Be Configuration-Only (No Code Changes)](#r-arch-010-onboarding-must-be-configuration-only-no-code-changes)
- [Metrics & Signals to Track](#metrics--signals-to-track)
  - [M-ARCH-001: Voice Core Stability](#m-arch-001-voice-core-stability)
  - [M-ARCH-002: Onboarding Time](#m-arch-002-onboarding-time)
  - [M-ARCH-003: Per-Customer Prompt Engineering Hours](#m-arch-003-per-customer-prompt-engineering-hours)
  - [M-ARCH-004: Workflow Failure Impact on Conversation](#m-arch-004-workflow-failure-impact-on-conversation)
  - [M-ARCH-005: Objective Completion Rate](#m-arch-005-objective-completion-rate)
  - [M-ARCH-006: Configuration Error Rate](#m-arch-006-configuration-error-rate)
  - [M-ARCH-007: Voice Core Code Churn](#m-arch-007-voice-core-code-churn)
  - [M-ARCH-008: Primitive Reuse Rate](#m-arch-008-primitive-reuse-rate)
  - [M-ARCH-009: Event Bus Latency](#m-arch-009-event-bus-latency)
  - [M-ARCH-010: Conversation Replay Success Rate](#m-arch-010-conversation-replay-success-rate)
- [V1 Decisions / Constraints](#v1-decisions--constraints)
  - [D-ARCH-001: Three Layers Only (No Hybrid, No Merge)](#d-arch-001-three-layers-only-no-hybrid-no-merge)
  - [D-ARCH-002: Voice Core is Python (Pipecat), Orchestration is TypeScript (Node.js)](#d-arch-002-voice-core-is-python-pipecat-orchestration-is-typescript-nodejs)
  - [D-ARCH-003: Primitive Library is V1-Scoped (Australian-First)](#d-arch-003-primitive-library-is-v1-scoped-australian-first)
  - [D-ARCH-004: Workflow Engine is Customer-Provided (n8n, Temporal, Custom)](#d-arch-004-workflow-engine-is-customer-provided-n8n-temporal-custom)
  - [D-ARCH-005: Objective Graph is Directed Acyclic Graph (DAG)](#d-arch-005-objective-graph-is-directed-acyclic-graph-dag)
  - [D-ARCH-006: Configuration Schema is Versioned and Validated](#d-arch-006-configuration-schema-is-versioned-and-validated)
  - [D-ARCH-007: Event Schema is Immutable (Append-Only)](#d-arch-007-event-schema-is-immutable-append-only)
  - [D-ARCH-008: Voice Core Versioning Follows Semantic Versioning](#d-arch-008-voice-core-versioning-follows-semantic-versioning)
  - [D-ARCH-009: Orchestration Layer is Stateless (Event-Sourced)](#d-arch-009-orchestration-layer-is-stateless-event-sourced)
  - [D-ARCH-010: <1 Hour Onboarding is Non-Negotiable SLA](#d-arch-010-1-hour-onboarding-is-non-negotiable-sla)
- [Why This Architecture Enables <1 Hour Onboarding](#why-this-architecture-enables-1-hour-onboarding)
- [Open Questions / Risks](#open-questions--risks)
  - [Q-ARCH-001: What If 10-20 Core Primitives Don't Cover 80% of Use Cases?](#q-arch-001-what-if-10-20-core-primitives-dont-cover-80-of-use-cases)
  - [Q-ARCH-002: How to Handle Conversation Resumption After Interruption?](#q-arch-002-how-to-handle-conversation-resumption-after-interruption)
  - [Q-ARCH-003: How to Version Objective Configurations?](#q-arch-003-how-to-version-objective-configurations)
  - [Q-ARCH-004: How to Handle LLM Provider Outages?](#q-arch-004-how-to-handle-llm-provider-outages)
  - [Q-ARCH-005: How to Handle Workflow Engine Outages?](#q-arch-005-how-to-handle-workflow-engine-outages)
  - [Q-ARCH-006: How to Prevent Configuration Drift Between Environments?](#q-arch-006-how-to-prevent-configuration-drift-between-environments)
  - [Q-ARCH-007: How to Handle Multi-Turn Objectives?](#q-arch-007-how-to-handle-multi-turn-objectives)
  - [Q-ARCH-008: How to Handle Conditional Objectives?](#q-arch-008-how-to-handle-conditional-objectives)
  - [Q-ARCH-009: How to Debug Multi-ASR Voting Failures?](#q-arch-009-how-to-debug-multi-asr-voting-failures)
  - [Q-ARCH-010: How to Handle Objective Dependencies?](#q-arch-010-how-to-handle-objective-dependencies)

---

## Why This Matters for V1

**Without This Architecture, the Platform Cannot Scale**

Production evidence (2025-2026) proves that conflating layers causes:
- **10-40 hour onboarding** per customer (prompt engineering, testing, debugging)
- **Customer-specific code branches** (unmaintainable at 100+ customers)
- **Cascading failures** (workflow bugs break conversation)
- **No deterministic debugging** (cannot replay or reason about failures)
- **Quadratic complexity** (N customers × M features = N×M custom implementations)

**The Three-Layer Architecture Is Non-Negotiable For**:
1. **Onboarding speed**: Configuration-only onboarding (not code)
2. **Operational safety**: Immutable voice core prevents customer-induced failures
3. **Debuggability**: Clear failure boundaries enable root-cause analysis
4. **Scalability**: Reusable primitives eliminate per-customer engineering

**V1 Success Criteria**:
- New customer onboarded in <1 hour (configuration only, no code changes)
- Voice core unchanged across first 100 customers
- Zero per-customer prompt rewrites
- Workflow failures never break conversation

---

## What Matters in Production (Facts Only)

### Layer 1: Voice Core (Invariant Runtime)

**Production Reality (2025-2026)**:
- **68% of production agents execute ≤10 steps** before requiring boundaries/human intervention
- **74% rely on human evaluation**, not fully autonomous decision-making
- **Pure LLM control fails** in production due to: multi-step reasoning drift, latent inconsistency, context-boundary degradation, incorrect tool invocation
- **Hybrid architectures win**: Bounded LLM control within deterministic guardrails

**What Lives in Voice Core (Immutable Across Customers)**:
1. **Turn-taking logic** (VAD, end-of-turn detection, barge-in handling)
2. **Capture primitives** (email, phone, address, name - with validation, confirmation, repair)
3. **Confirmation strategies** (contextual, implicit, spell-by-word escalation)
4. **Repair loops** (incremental component-level repair, not full restart)
5. **Multi-ASR orchestration** (3+ ASR systems, LLM ranking for Australian accent)
6. **Confidence thresholds** (critical data always confirmed, non-critical confidence-based)
7. **State machine transitions** (objective → elicit → capture → confirm → repair → complete)
8. **Audio pipeline** (STT → LLM → TTS frame processing)

**What MUST NEVER Be Customer-Configurable**:
- How confirmation works (strategy is fixed, only which fields to confirm is configurable)
- How repair loops execute (incremental repair logic is immutable)
- How turn-taking detects interruptions (VAD thresholds, Smart Turn logic is fixed)
- How multi-ASR ranking works (voting algorithm immutable)
- How critical data is always confirmed (non-negotiable rule)

**Production Evidence**:
- **Genie framework (2025)**: Declarative policies with algorithmic runtime achieved **82.8% goal completion** vs 21.8% with imperative function calling
- **Pipecat frame-based architecture**: Immutable frame processors (STT, LLM, TTS) with configurable pipelines
- **Amazon Bedrock AgentCore**: Immutable versioning - each config change creates new immutable version
- **Semantic Kernel**: Reusable, pluggable primitives with centralized configuration

**Why This Layer Must Be Immutable**:
- **Onboarding speed**: No per-customer testing of capture logic (already proven)
- **Reliability**: 99.9% uptime impossible if customers modify core conversation logic
- **Debuggability**: Cannot replay conversations if capture logic varies per customer
- **Compliance**: Cannot audit if validation rules change per customer (GDPR, OAIC, CCPA)

---

### Layer 2: Objective & Orchestration Layer

**Production Reality (2025-2026)**:
- **Declarative objectives outperform imperative scripts** (Genie: 82.8% vs 21.8% success rate)
- **Objectives declare WHAT, not HOW**: "Capture email for confirmation purpose" (not "Ask for email, then spell-check, then confirm")
- **Orchestration manages objective sequencing**, pausing, resumption, failure handling
- **Configuration-driven**: Customer defines which objectives, in what order, with what requirements

**What an Objective IS (Formal Definition)**:
```
Objective = {
  type: PrimitiveReference,        // e.g., "capture_email_au"
  purpose: String,                  // e.g., "appointment confirmation"
  required: Boolean,                // Blocks progress if fails
  timeout: Integer,                 // Max attempts before escalation
  on_success: NextObjective,        // Explicit sequencing
  on_failure: EscalationStrategy,   // Transfer, skip, retry
  locale: String                    // e.g., "en-AU"
}
```

**How Objectives Differ From Workflows**:
| Aspect | Objectives (Layer 2) | Workflows (Layer 3) |
|--------|---------------------|---------------------|
| **Scope** | Conversational goals | Business automation |
| **Execution** | Synchronous (blocks conversation) | Asynchronous (background) |
| **State** | Affects conversation state | Cannot affect conversation state |
| **Failure** | Blocks progress, triggers repair | Logs error, does not block conversation |
| **Example** | "Capture email", "Confirm appointment" | "Send confirmation email", "Update CRM" |

**Orchestration Responsibilities**:
1. **Load customer's objective sequence** from configuration
2. **Execute objectives in order** (or parallel if independent)
3. **Manage objective state** (pending → in_progress → completed → failed)
4. **Handle failures** (retry, skip, escalate based on objective config)
5. **Pause/resume** objectives when conversation interrupted
6. **Emit events** (objective_started, objective_completed, objective_failed)

**What Layer 2 Enables**:
- **Fast onboarding**: Customer configures objectives (JSON/YAML), no code
- **Reusable primitives**: 10-20 core primitives cover 80% of use cases
- **Deterministic sequencing**: Objective graph is inspectable, testable
- **Flexible composition**: Same primitive reused across customers with different purposes

**Production Evidence**:
- **LiveKit workflows**: Explicit task/agent separation prevents state coupling
- **Rasa CALM flows**: Declarative + autonomous steps balance structure and flexibility
- **Temporal workflows**: Durable state management with signals/queries for async control
- **Microsoft declarative agents**: Clarity, reusability, maintainability through declarations

**Why This Layer Enables <1 Hour Onboarding**:
- **No prompt engineering**: Customer declares objectives, primitives handle elicitation
- **No testing required**: Primitives pre-tested, only configuration validated
- **No code changes**: Objective composition is pure configuration
- **Visual configuration**: Objective graph can be configured via UI (drag-and-drop)

**Example Configuration (Customer Onboarding)**:
```yaml
objectives:
  - id: capture_contact
    type: capture_email_au
    purpose: appointment_confirmation
    required: true
    on_success: next
    
  - id: capture_phone
    type: capture_phone_au
    purpose: callback
    required: true
    on_success: next
    
  - id: capture_appointment_time
    type: capture_datetime_au
    purpose: booking
    required: true
    on_success: trigger_workflow_create_booking
```

**Onboarding time**: 10-20 minutes (configure objectives) vs 10-40 hours (write prompts, test, debug).

---

### Layer 3: Workflow / Automation Layer

**Production Reality (2025-2026)**:
- **Workflows MUST be asynchronous** to conversation (LiveKit, Temporal pattern)
- **Workflow failures MUST NOT break conversation** (isolation principle)
- **Workflows triggered by events**, not embedded in conversation flow
- **Workflows handle business logic**, not conversation logic

**What Workflows Are Allowed To Do**:
1. **External API calls** (CRM updates, appointment booking, payment processing)
2. **Database writes** (save captured information)
3. **Email/SMS sending** (confirmation messages)
4. **Long-running tasks** (background processing, data enrichment)
5. **Event emission** (analytics, logging, monitoring)

**What Workflows MUST NEVER Do**:
1. ❌ **Decide what to ask next** (conversation sequencing is Layer 2)
2. ❌ **Modify conversation state** (cannot change objective status)
3. ❌ **Block conversation** (all workflow execution is async)
4. ❌ **Validate user input** (validation is Layer 1)
5. ❌ **Control turn-taking** (barge-in/interruption is Layer 1)
6. ❌ **Trigger re-elicitation** (repair loops are Layer 1)

**Architecture Pattern (Non-Negotiable)**:
```
Conversation (Layer 1 + 2)  →  [Event Bus]  →  Workflow Engine (Layer 3)
                              
Conversation emits:           Workflow consumes:
- objective_completed         - Create booking (async)
- information_captured        - Update CRM (async)
- conversation_ended          - Send confirmation (async)

Conversation NEVER waits for workflow response.
Workflow failures logged, never block conversation.
```

**Production Evidence**:
- **Temporal workflows**: Signals (fire-and-forget async messages), queries (read-only state), updates (sync tracked writes)
- **LangGraph state separation**: Typed state dictionaries flow through nodes, isolated from external workflows
- **LiveKit task groups**: Short-lived tasks return results, agents maintain long-lived control
- **AWS Bedrock AgentCore**: Session isolation - each session in dedicated microVM, workflows cannot affect conversation state

**Why Workflows Must Be Async**:
- **Latency**: External API calls (200-1000ms) break conversational flow (<300ms target)
- **Reliability**: Workflow failures (network timeout, API errors) cannot crash conversation
- **Testability**: Conversation testing isolated from workflow testing
- **Scalability**: Workflows scaled independently from voice runtime

**Common Anti-Patterns (DO NOT IMPLEMENT)**:

| Anti-Pattern | Why It Fails | Production Impact |
|--------------|--------------|-------------------|
| **Workflow decides what to ask next** | Conversation logic scattered across workflow and voice core | Cannot debug, cannot replay, 10-40 hour onboarding |
| **Conversation waits for workflow** | External API latency (500ms+) breaks flow | User perceives agent as "slow" or "stuck" |
| **Workflow validates input** | Validation logic duplicated in workflow and voice core | Inconsistent behavior, cannot reuse primitives |
| **Workflow controls confirmation** | Confirmation strategy varies per customer | Cannot guarantee critical data confirmation |

**Production Failure Example (Vapi-Style Architecture)**:
- **Symptom**: Customer wants to change "confirmation question wording"
- **Impact**: Must rewrite prompt, test across all conversation paths, redeploy
- **Time**: 2-4 hours per change
- **At scale**: 2000 customers × 5 changes/year = 10,000-20,000 hours/year
- **Root cause**: Confirmation logic embedded in customer-specific prompts (Layer 3 controlling Layer 1)

**Correct Architecture (Three-Layer Separation)**:
- **Layer 1**: Confirmation strategy immutable (contextual, spell-by-word escalation)
- **Layer 2**: Customer configures WHICH fields to confirm (objectives declare `is_critical: true`)
- **Layer 3**: Workflow triggered AFTER confirmation complete (send email with confirmed data)
- **Onboarding time**: 5 minutes (toggle `is_critical` flag in config)

---

## Common Failure Modes (Observed in Real Systems)

### FM-1: Workflow Controls Conversation Sequencing

**Symptom**: n8n workflow decides "if email captured, ask for phone; if phone captured, ask for address"

**Root cause**: Conversation sequencing logic moved to Layer 3 (workflow) instead of Layer 2 (orchestration).

**Production impact**:
- **Debugging impossible**: Conversation flow hidden in workflow logic, cannot inspect objective graph
- **Latency**: Every decision requires workflow round-trip (200-500ms per turn)
- **Brittle**: Workflow changes break conversation (e.g., n8n node reordering changes conversation behavior)
- **Onboarding**: Must rebuild workflow per customer (10-40 hours)

**Observed in**: Vapi, Voiceflow, Retell (prompt-centric architectures)

**Production evidence**: 
- Voiceflow addressed this by improving JavaScript step performance (70-94% faster), but architectural problem remains
- Latency in async steps where platform "waits for long-running actions" breaks conversational flow

**Why it happens**:
- **No objective layer**: Platforms only have voice core + workflow, no orchestration layer
- **Configuration = workflow**: Customer "configures" agent by building workflow (not declaring objectives)

**Mitigation (Mandatory Architecture)**:
- **Layer 2 owns sequencing**: Objective graph defines "capture email → capture phone → capture address"
- **Layer 3 triggered by events**: Workflow receives `objective_completed` event, executes async business logic
- **Zero conversation blocking**: Workflow never in critical path of conversation

---

### FM-2: Capture Logic Embedded in Prompts

**Symptom**: Customer prompt includes: "Ask for email. If user gives email, spell it back letter-by-letter. If confidence low, ask them to spell it."

**Root cause**: Capture logic (elicitation, confirmation, repair) encoded in LLM prompt instead of Layer 1 primitives.

**Production impact**:
- **Inconsistent behavior**: LLM may skip confirmation, may not escalate to spelling, may accept invalid emails
- **Cannot guarantee critical data confirmation**: Prompt-based confirmation can be "hallucinated away" by LLM
- **Onboarding**: Every customer rewrites capture logic (10-40 hours per customer)
- **Compliance risk**: Cannot prove critical data was confirmed (audit trail unreliable)

**Observed in**: All prompt-centric platforms (Vapi, Retell, Voiceflow)

**Production evidence**:
- **LLM failure modes (2025)**: Multi-step reasoning drift, latent inconsistency, incorrect tool invocation
- **68% of production agents execute ≤10 steps**: Suggests bounded, deterministic control preferred over open-ended LLM autonomy
- **Genie framework success**: Algorithmic runtime (deterministic) outperforms pure LLM control (82.8% vs 21.8%)

**Why it happens**:
- **No primitive library**: Platform lacks reusable capture primitives
- **Prompt is API**: Only customization is prompt rewriting

**Mitigation (Mandatory Architecture)**:
- **Layer 1 primitives**: `capture_email_au` primitive handles elicitation, validation, confirmation, repair
- **Layer 2 configuration**: Customer declares `{type: capture_email_au, required: true}`
- **Zero prompt engineering**: Primitive behavior immutable, only WHICH primitives and WHEN is configured

---

### FM-3: Per-Customer Prompt Engineering

**Symptom**: Each new customer requires 10-40 hours of prompt writing, testing, debugging.

**Root cause**: No reusable primitives. Every customer's capture logic written from scratch in prompts.

**Production impact**:
- **Onboarding time**: 10-40 hours per customer (vs <1 hour with primitives)
- **Scalability**: Cannot scale to 2,000 customers (20,000-80,000 hours = 10-40 person-years)
- **Quality inconsistency**: Capture quality varies per customer (some get robust email validation, others don't)
- **Technical debt**: 2,000 custom prompts to maintain, update, debug

**Observed in**: Vapi, Retell, Voiceflow (all prompt-centric)

**Production evidence**:
- **Vapi positioning**: "Try in minutes. Deploy in days" - but "deploy" means prompt engineering
- **Layercode positioning**: "More control than Vapi or Retell, simpler than LiveKit or Pipecat" - acknowledges prompt-centric complexity

**Why it happens**:
- **No separation of concerns**: Voice core + orchestration + workflow all conflated in prompt
- **Prompt = product**: Platform sells "flexibility" via prompt rewriting (not reusable primitives)

**Mitigation (Mandatory Architecture)**:
- **10-20 core primitives cover 80% of use cases**: email, phone, address, name, date, time, yes/no, number
- **Configuration-only onboarding**: Customer selects primitives, declares sequence, no code
- **Immutable primitive behavior**: Validation, confirmation, repair pre-tested, production-proven

---

### FM-4: Workflows Block Conversation

**Symptom**: Agent says "Let me check your appointment availability..." (5 second silence while workflow runs API call)

**Root cause**: Conversation waits for synchronous workflow execution (e.g., CRM lookup, payment processing).

**Production impact**:
- **Perceived latency**: User experiences awkward silence (300ms+ feels unnatural)
- **Reliability**: Workflow failures (network timeout, API error) crash conversation
- **Cannot interrupt**: User cannot barge-in during workflow execution (conversation frozen)

**Observed in**: Systems with tight workflow-conversation coupling

**Production evidence**:
- **<300ms latency target**: Production systems require sub-300ms response time for natural conversation
- **Sequential pipeline latency**: ~200ms STT + 500ms LLM + 300ms TTS = 1000ms cumulative (already at limit without workflow)
- **LiveKit architecture**: Explicit task/agent separation prevents workflow blocking

**Why it happens**:
- **No event bus**: Conversation directly calls workflow (synchronous RPC)
- **No async pattern**: Platform lacks signals/events for fire-and-forget messaging

**Mitigation (Mandatory Architecture)**:
- **Event bus**: Conversation emits `objective_completed`, workflow consumes async
- **Conversation never waits**: All workflow execution in background
- **Progressive disclosure**: If workflow result needed in conversation, conversation continues ("I'll check that and let you know")

---

### FM-5: Workflow Failures Break Conversation

**Symptom**: User provides all information correctly. Workflow fails (CRM timeout). Conversation crashes or agent says "Something went wrong, please call back."

**Root cause**: Workflow failures propagate to conversation layer (no isolation).

**Production impact**:
- **Poor UX**: User completes conversation successfully, but system fails (user blames agent, not backend)
- **No recovery**: Conversation cannot continue after workflow failure
- **Data loss**: Captured information lost if workflow crashes conversation

**Observed in**: Tightly coupled workflow-conversation systems

**Production evidence**:
- **Temporal workflows**: Session isolation - microVM per session, workflow failures cannot affect conversation
- **Bedrock AgentCore**: Dedicated microVM with isolated CPU, memory, filesystem

**Why it happens**:
- **No isolation boundary**: Workflow and conversation run in same execution context
- **No error handling**: Workflow exceptions not caught, crash conversation

**Mitigation (Mandatory Architecture)**:
- **Isolation boundary**: Workflow runs in separate process/container from conversation
- **Error handling**: Workflow failures logged, conversation continues
- **Graceful degradation**: Conversation captures data, logs "workflow pending", user never knows workflow failed

---

## Proven Patterns & Techniques

### P-1: Immutable Voice Core with Versioned Primitives

**Pattern**: Voice core is immutable across customers. Primitives versioned (v1, v2, v3). Configuration references primitive version.

**Implementation**:
```
Primitive: capture_email_au@v1
- Validation: RFC 5322 + DNS MX check
- Confirmation: Contextual ("jane at gmail dot com")
- Repair: Incremental (component-level)

Primitive: capture_email_au@v2  (Enhanced)
- Validation: RFC 5322 + DNS MX check + disposable email detection
- Confirmation: Contextual + Australian pronunciation
- Repair: Incremental + multi-ASR for critical components
```

**Customer configuration**:
```yaml
objectives:
  - type: capture_email_au@v2  # Explicit version reference
```

**Benefits**:
- **Immutability**: v1 never changes, customers on v1 unaffected by v2 improvements
- **Opt-in upgrades**: Customer chooses when to upgrade to v2
- **Rollback safety**: Can revert to v1 if v2 has issues
- **Testing isolation**: v2 tested independently, v1 customers unaffected

**Production evidence**:
- **Amazon Bedrock AgentCore**: Immutable versions, "DEFAULT" endpoint auto-updates to latest
- **Semantic Kernel**: Versioned plugins, centralized dependency injection

---

### P-2: Declarative Objective Configuration

**Pattern**: Customer declares objectives (WHAT to capture), not dialogue flow (HOW to ask).

**Implementation**:
```yaml
# Declarative (WHAT) - Correct
objectives:
  - type: capture_email_au
    purpose: appointment_confirmation
    required: true

# Imperative (HOW) - Incorrect, DO NOT USE
dialogue:
  - say: "What's your email?"
  - capture_email:
      if_low_confidence: ask_to_spell
      if_high_confidence: skip_confirmation
```

**Benefits**:
- **Reusable primitives**: Same `capture_email_au` primitive works for all customers
- **Fast onboarding**: Declare objectives, no scripting
- **Testable**: Objective graph inspectable, primitives pre-tested

**Production evidence**:
- **Genie framework**: Declarative worksheets achieve 82.8% success vs 21.8% imperative
- **Microsoft declarative agents**: Clarity, reusability, maintainability

---

### P-3: Event-Driven Workflow Triggering

**Pattern**: Conversation emits events. Workflows subscribe to events. Zero synchronous calls.

**Implementation**:
```
[Conversation]  --emit-->  [Event Bus]  --subscribe-->  [Workflow Engine]

Events:
- objective_completed(objective_id, captured_data)
- conversation_ended(conversation_id, summary)
- escalation_requested(reason, context)

Workflows:
- on_objective_completed("capture_email"): send_confirmation_email(data)
- on_conversation_ended: update_crm(summary)
```

**Benefits**:
- **Zero conversation blocking**: Workflows async, never block conversation
- **Workflow failures isolated**: Email sending fails, conversation unaffected
- **Scalable**: Workflow engine scales independently from voice runtime

**Production evidence**:
- **Temporal**: Signals (async fire-and-forget), queries (read-only), updates (sync tracked writes)
- **LangGraph**: State flows through nodes, external workflows isolated
- **LiveKit**: Task groups coordinate multi-step operations, agent handoffs explicit

---

### P-4: Locale-Aware Primitive Library

**Pattern**: Primitives organized by locale. Customer configuration includes locale parameter. System selects correct primitive variant.

**Implementation**:
```
Primitives:
  capture_phone:
    en-AU: capture_phone_au  (04xx mobile, Australia Post validation)
    en-US: capture_phone_us  ((XXX) XXX-XXXX, USPS validation)
    en-GB: capture_phone_uk  (07XXX mobile, Royal Mail validation)

Customer config:
  locale: en-AU
  objectives:
    - type: capture_phone  # System auto-selects capture_phone_au
```

**Benefits**:
- **International expansion**: Add locales without rewriting core
- **Locale isolation**: US primitive bugs don't affect AU customers
- **Compliance**: Locale-specific privacy rules (GDPR, CCPA, OAIC) enforced per locale

**Production evidence**:
- **Research from 21-objectives-and-information-capture.md**: Locale architecture enables 40-80 hour expansion vs 200-400 hours without

---

### P-5: State Machine for Objective Execution

**Pattern**: Each objective executes through deterministic state machine. LLM bounded within states.

**Implementation**:
```
Objective State Machine:
  PENDING → ELICITING → CAPTURED → CONFIRMING → CONFIRMED → COMPLETED
               ↓           ↓            ↓
             FAILED     RE_ELICIT    REPAIRING

Transitions:
- PENDING → ELICITING: Objective starts
- ELICITING → CAPTURED: User provides value, confidence ≥0.4
- ELICITING → RE_ELICIT: User provides value, confidence <0.4 (3 max retries)
- CAPTURED → CONFIRMING: Critical data OR confidence 0.4-0.7
- CAPTURED → CONFIRMED: Non-critical data AND confidence ≥0.7
- CONFIRMING → CONFIRMED: User affirms
- CONFIRMING → REPAIRING: User corrects
- CONFIRMED → COMPLETED: Validation passes
- RE_ELICIT → FAILED: 3 retries exhausted, escalate
```

**Benefits**:
- **Deterministic**: Objective execution always follows same state machine
- **Debuggable**: Can inspect state at any point, replay state transitions
- **Bounded LLM**: LLM only generates responses within current state, cannot skip states
- **Resumable**: Interruption stores state, resumes from same state

**Production evidence**:
- **Research from 07-state-machines.md**: Explicit FSMs are production-critical for predictable, debuggable voice AI
- **68% of production agents execute ≤10 steps**: State machines enforce step limits

---

## Engineering Rules (Binding)

### R-ARCH-001: Three-Layer Architecture is Mandatory (No Exceptions)
**Rule**: System MUST be architected as exactly three layers: Voice Core (Layer 1), Objective & Orchestration (Layer 2), Workflow / Automation (Layer 3). NO additional layers. NO layer merging.

**Rationale**: Separation of concerns enables fast onboarding, immutable core, workflow isolation.

**Implementation**: 
- Voice Core: Immutable primitives (capture, confirmation, repair, turn-taking)
- Orchestration: Customer-configurable objective sequencing
- Workflow: Async business logic triggered by events

**Verification**: 
- Voice core unchanged across first 100 customers
- Onboarding achievable in <1 hour (configuration only)
- Workflow failures never crash conversation

---

### R-ARCH-002: Voice Core MUST Be Immutable Across Customers
**Rule**: Capture primitives, confirmation strategies, repair loops, turn-taking logic MUST be identical across all customers. NO per-customer voice core customization.

**Nuance (Allowed Global Tuning)**:
- ✅ Allowed: **process-level deployment config** that applies equally to all tenants in that runtime (e.g., env-configured model/voice/VAD set once at startup).
- ✅ Allowed: **versioned Voice Core defaults** chosen at deployment time.
- ❌ Not allowed: per-tenant or per-request overrides of Voice Core behavior.
- ❌ Not allowed: runtime knobs exposed to Layer 2 that change Layer 1 behavior mid-call.

**Rationale**: 
- Onboarding speed: No per-customer testing of voice core
- Reliability: Cannot guarantee 99.9% uptime if core varies per customer
- Compliance: Cannot audit if validation rules differ per customer

**Implementation**:
- Primitives versioned (v1, v2, v3), customers reference version
- Configuration selects primitives, does not modify primitive behavior
- Locale parameter controls locale-specific variants (en-AU, en-US, en-GB)

**Verification**:
- Voice core code identical across all production deployments
- Primitive behavior testable once, reused across all customers
- Configuration validation prevents voice core modification

---

### R-ARCH-003: Objectives MUST Be Declarative (Not Imperative)
**Rule**: Customer configuration MUST declare WHAT to capture (objectives), NOT HOW to capture it (dialogue flow, prompts, confirmation wording).

**Rationale**: 
- Fast onboarding: Declarative objectives configured in minutes (vs imperative scripts in hours)
- Reusable primitives: Same primitive reused across customers
- Production evidence: Declarative approaches achieve 82.8% success vs 21.8% imperative (Genie framework)

**Implementation**:
```yaml
# Correct (Declarative)
objectives:
  - type: capture_email_au
    purpose: confirmation
    required: true

# Incorrect (Imperative) - DO NOT ALLOW
dialogue:
  - say: "What's your email?"
  - if_low_confidence: ask_to_spell
```

**Verification**:
- Configuration schema enforces declarative structure
- No customer prompt injection allowed
- Objective graph inspectable, testable

---

### R-ARCH-004: Workflows MUST Be Asynchronous to Conversation
**Rule**: Workflows MUST execute asynchronously. Conversation MUST NEVER wait for workflow completion. Workflows triggered by events, not synchronous calls.

**Rationale**:
- Latency: External API calls (200-1000ms) break conversational flow (<300ms target)
- Reliability: Workflow failures cannot crash conversation
- Scalability: Workflow engine scales independently from voice runtime

**Implementation**:
- Conversation emits events (`objective_completed`, `conversation_ended`)
- Workflows subscribe to events (n8n, Temporal, custom)
- Zero synchronous RPC from conversation to workflow

**Verification**:
- No synchronous HTTP calls from voice runtime to workflow engine
- Conversation latency unaffected by workflow execution time
- Workflow failures logged, conversation unaffected

---

### R-ARCH-005: Workflows MUST NOT Control Conversation Sequencing
**Rule**: Workflows MUST NOT decide what to ask next, when to confirm, or how to repair. Conversation sequencing is Layer 2 (orchestration), NOT Layer 3 (workflow).

**Rationale**:
- Debuggability: Conversation flow hidden in workflow = cannot inspect, cannot replay
- Onboarding: Workflow-controlled sequencing requires per-customer workflow rebuild (10-40 hours)
- Latency: Every decision requires workflow round-trip (200-500ms)

**Implementation**:
- Objective sequencing defined in Layer 2 configuration (objective graph)
- Workflows receive events AFTER objectives complete
- Workflows cannot emit events that modify objective sequencing

**Verification**:
- Objective graph fully defines conversation flow (no workflow dependencies)
- Workflows can be disabled, conversation still functional
- Conversation replay possible without workflow engine

---

### R-ARCH-006: Critical Data MUST Always Be Confirmed (Layer 1 Enforcement)
**Rule**: Email, phone, address, payment, appointment datetime MUST receive explicit user confirmation, regardless of ASR confidence score. This rule MUST be enforced in Layer 1 (voice core), NOT Layer 2 or 3.

**Rationale**:
- Production evidence: ASR confidence scores unreliable (overconfidence bias, 5-15% false positive rate)
- Cost of error: Wrong email = customer never receives service (business failure)
- Layer 1 enforcement: Cannot be accidentally disabled by customer configuration

**Implementation**:
- Layer 1 primitives check `is_critical` flag
- If `is_critical: true`, confirmation mandatory (bypass confidence thresholds)
- Layer 2 configuration can only declare which primitives are critical, cannot skip confirmation

**Verification**:
- All critical primitives (`capture_email_au`, `capture_phone_au`, `capture_address_au`) ALWAYS confirm
- Confirmation strategy immutable (contextual, 3-5 seconds, not robotic)
- Configuration cannot override critical data confirmation

---

### R-ARCH-007: Primitive Behavior MUST NOT Be Prompt-Configurable
**Rule**: Customer prompts MUST NOT control primitive behavior (confirmation strategy, repair logic, validation rules). Primitives are code, not prompts.

**Rationale**:
- Reliability: Prompt-based control allows LLM to skip validation, skip confirmation, accept invalid data
- Compliance: Cannot audit if validation behavior varies based on LLM output
- Production evidence: LLM failure modes include multi-step reasoning drift, incorrect tool invocation

**Implementation**:
- Primitives implemented in code (Python/TypeScript), not LLM prompts
- LLM generates natural language responses WITHIN primitive constraints
- Customer prompts can customize phrasing, cannot bypass validation/confirmation

**Verification**:
- Primitive validation always executes (e.g., Australian phone regex, Australia Post API)
- Primitive confirmation always executes for critical data (regardless of LLM output)
- Primitive repair always follows incremental repair logic (component-level, not restart)

---

### R-ARCH-008: Locale MUST Be Customer-Configurable, Primitive Behavior Per Locale Immutable
**Rule**: Customer configuration MUST specify locale (`en-AU`, `en-US`, `en-GB`). System selects locale-specific primitive variant. Primitive behavior per locale is immutable.

**Rationale**:
- International expansion: Add locales without rewriting core (40-80 hours vs 200-400 hours)
- Compliance: Locale-specific privacy rules (GDPR, CCPA, OAIC) enforced per locale
- Scalability: Same platform serves AU, US, UK customers without code changes

**Implementation**:
- Customer config: `locale: "en-AU"`
- System selects: `capture_phone_au` (04xx mobile, +61 normalization, Australia Post validation)
- Primitive behavior per locale immutable (only locale selection configurable)

**Verification**:
- Locale parameter propagates through entire conversation flow
- Locale-specific primitives enforce locale-specific validation (phone format, date format, address format)
- Adding new locale requires no changes to orchestration or workflow layers

---

### R-ARCH-009: Voice Core MUST Emit Events for Observability
**Rule**: Voice core MUST emit events for every significant action (objective started, objective completed, validation failed, confirmation received, repair attempted). Events MUST NOT affect conversation behavior.

**Rationale**:
- Debuggability: Event stream enables conversation replay, root-cause analysis
- Analytics: Event stream feeds dashboards, cost tracking, quality metrics
- Workflow triggering: Workflows subscribe to events (async)

**Implementation**:
- Event schema: `{event_type, timestamp, conversation_id, objective_id, data, metadata}`
- Event bus: Kafka, AWS EventBridge, RabbitMQ
- Events append-only (immutable, never deleted)

**Verification**:
- Every objective transition emits event
- Event stream sufficient to reconstruct conversation state
- Disabling event bus does not affect conversation (only observability)

---

### R-ARCH-010: Onboarding MUST Be Configuration-Only (No Code Changes)
**Rule**: Onboarding new customer MUST NOT require code changes, prompt engineering, or custom primitive development. 100% configuration.

**Rationale**:
- Scalability: 2,000 customers × 10-40 hours onboarding = 20,000-80,000 hours (10-40 person-years)
- <1 hour target: Configuration-only onboarding achievable in <1 hour
- Production evidence: Primitive library covers 80% of use cases

**Implementation**:
- Customer configuration: YAML/JSON declaring objectives, locale, workflow webhooks
- Configuration validation: Schema validation prevents invalid configurations
- No code deployment: Configuration stored in database, loaded at runtime

**Verification**:
- First 100 customers onboarded with zero voice core changes
- Onboarding SLA: <1 hour (configuration + testing)
- No per-customer code branches in repository

---

## Metrics & Signals to Track

### M-ARCH-001: Voice Core Stability
**Metric**: Number of voice core changes per 100 new customers

**Target**: 0 changes per 100 customers (voice core immutable)

**Measurement**: Git commits to voice core (Layer 1) code

**Alert**: >1 change per 100 customers = architecture violation (primitive missing or incorrectly designed)

---

### M-ARCH-002: Onboarding Time
**Metric**: Time from customer signup to first successful test call

**Target**: <1 hour (95th percentile)

**Measurement**: Timestamp(customer_created) → Timestamp(first_successful_call)

**Alert**: >2 hours = configuration complexity too high OR primitives insufficient

---

### M-ARCH-003: Per-Customer Prompt Engineering Hours
**Metric**: Hours spent writing/modifying prompts per customer

**Target**: 0 hours (no per-customer prompt engineering)

**Measurement**: Engineering time logged to customer onboarding tasks

**Alert**: >1 hour per customer = prompt-centric architecture violation

---

### M-ARCH-004: Workflow Failure Impact on Conversation
**Metric**: Percentage of conversations crashed by workflow failures

**Target**: 0% (workflow failures never crash conversation)

**Measurement**: `conversation_failed(reason=workflow_error)` / `total_conversations`

**Alert**: >0.1% = isolation boundary broken

---

### M-ARCH-005: Objective Completion Rate
**Metric**: Percentage of objectives completed successfully (without escalation)

**Target**: >85% (industry benchmark from Genie framework)

**Measurement**: `objective_completed` / (`objective_completed` + `objective_failed`)

**Alert**: <75% = primitives insufficient OR objectives poorly designed

---

### M-ARCH-006: Configuration Error Rate
**Metric**: Percentage of customer configurations rejected by schema validation

**Target**: <5% (most configurations valid on first submission)

**Measurement**: `configuration_rejected` / `configuration_submitted`

**Alert**: >10% = configuration schema too complex OR documentation insufficient

---

### M-ARCH-007: Voice Core Code Churn
**Metric**: Lines of code changed in voice core per month

**Target**: <100 lines/month (voice core should be stable after V1)

**Measurement**: Git diff on Layer 1 code

**Alert**: >500 lines/month = architecture instability (customer requirements leaking into core)

---

### M-ARCH-008: Primitive Reuse Rate
**Metric**: Percentage of objectives using standard primitives (vs custom primitives)

**Target**: >80% (standard primitives cover most use cases)

**Measurement**: `objectives_using_standard_primitives` / `total_objectives`

**Alert**: <70% = primitive library insufficient, customers requesting too many custom primitives

---

### M-ARCH-009: Event Bus Latency
**Metric**: P95 latency from conversation event emission to workflow receipt

**Target**: <100ms (workflows triggered near-real-time)

**Measurement**: Timestamp(event_emitted) → Timestamp(event_received)

**Alert**: >500ms = event bus overloaded OR workflow subscriptions slow

---

### M-ARCH-010: Conversation Replay Success Rate
**Metric**: Percentage of conversations successfully replayed from event stream

**Target**: 100% (all conversations replayable)

**Measurement**: `replay_successful` / `replay_attempted`

**Alert**: <95% = event stream incomplete OR conversation state not fully captured

---

## V1 Decisions / Constraints

### D-ARCH-001: Three Layers Only (No Hybrid, No Merge)
**Decision**: V1 architecture is EXACTLY three layers: Voice Core, Orchestration, Workflow. No additional layers. No layer merging.

**Rationale**: 
- Simplicity: Three layers easier to understand, enforce, debug than four or five
- Clear boundaries: Each layer has single responsibility
- Production validation: Proven pattern (Pipecat frame architecture, LiveKit task/agent separation, Temporal workflows)

**Constraints**:
- Voice Core (Layer 1): Immutable primitives, turn-taking, audio pipeline
- Orchestration (Layer 2): Customer-configurable objective sequencing
- Workflow (Layer 3): Async business logic triggered by events
- No "orchestration-workflow hybrid" layer
- No "voice core configuration" layer

---

### D-ARCH-002: Voice Core is Python (Pipecat), Orchestration is TypeScript (Node.js)
**Decision**: Voice Core (Layer 1) implemented in Python using Pipecat. Orchestration (Layer 2) implemented in TypeScript (Node.js).

**Rationale**:
- **Python for voice core**: Pipecat ecosystem, STT/LLM/TTS integrations, production-proven
- **TypeScript for orchestration**: Type safety for objective graphs, fast iteration, familiar to web developers
- **Language boundary enforces layer separation**: Cannot accidentally import voice core into orchestration

**Constraints**:
- Voice Core: Python 3.10+, Pipecat framework
- Orchestration: Node.js 20+, TypeScript 5+
- Communication: Event bus (Kafka/EventBridge), gRPC for synchronous control
- No shared code between layers (except event schemas)

---

### D-ARCH-003: Primitive Library is V1-Scoped (Australian-First)
**Decision**: V1 primitive library includes ONLY Australian locale primitives (`en-AU`). US/UK primitives deferred to V2.

**Rationale**:
- **Focus**: Platform serves Australian businesses first (80% operational impact)
- **Validation**: Australian-specific validation (Australia Post API, 04xx phone format, DD/MM/YYYY dates)
- **Scalability**: Locale architecture proven in V1, V2 expansion low-risk

**Constraints**:
- V1 primitives: `capture_email_au`, `capture_phone_au`, `capture_address_au`, `capture_name_au`, `capture_date_au`, `capture_time_au`, `capture_yes_no`, `capture_number`
- V2 primitives: `capture_phone_us`, `capture_address_us`, `capture_phone_uk`, `capture_address_uk`
- Locale parameter architecture implemented in V1 (even though only `en-AU` exists)

---

### D-ARCH-004: Workflow Engine is Customer-Provided (n8n, Temporal, Custom)
**Decision**: Platform does NOT provide workflow engine. Customer brings their own (n8n, Temporal, Zapier, custom).

**Rationale**:
- **Separation**: Workflow is business logic, not platform responsibility
- **Flexibility**: Customer chooses workflow tool (no vendor lock-in)
- **Simplicity**: Platform provides event bus, workflows subscribe

**Constraints**:
- Platform emits events to webhook URL (customer-configured)
- Platform does NOT execute workflows
- Platform does NOT guarantee workflow delivery (at-least-once delivery, customer handles idempotency)
- Workflow failures never crash conversation (isolation guaranteed)

---

### D-ARCH-005: Objective Graph is Directed Acyclic Graph (DAG)
**Decision**: Objective sequencing MUST form Directed Acyclic Graph (no cycles, no loops).

**Rationale**:
- **Termination**: DAG guarantees conversation terminates (no infinite loops)
- **Debuggability**: DAG is inspectable, visualizable
- **Determinism**: Given same user inputs, conversation follows same path

**Constraints**:
- Objective `on_success` and `on_failure` edges form DAG
- Configuration validation rejects cyclic graphs
- If customer needs "loop" (e.g., "ask up to 3 times"), objective has `max_retries` parameter (bounded loop)

**Exception**: Conversation-level restart (user says "start over") resets to root objective.

---

### D-ARCH-006: Configuration Schema is Versioned and Validated
**Decision**: Customer configuration has explicit schema version. Schema validation rejects invalid configurations.

**Rationale**:
- **Safety**: Invalid configurations rejected before deployment (cannot crash production)
- **Migration**: Schema version allows breaking changes with migration path
- **Documentation**: Schema is self-documenting API

**Constraints**:
- Configuration schema: JSON Schema or TypeScript types
- Schema version: `schema_version: "v1"`
- Validation: Pre-deployment validation rejects invalid configs
- Breaking changes: New schema version (v2), v1 supported for 12 months

---

### D-ARCH-007: Event Schema is Immutable (Append-Only)
**Decision**: Event schemas are immutable (never change). New event types added (append-only), old events never modified.

**Rationale**:
- **Replay**: Old events must be replayable years later
- **Analytics**: Event schema changes break analytics queries
- **Compatibility**: Workflows subscribed to old events continue working

**Constraints**:
- Event schema version: `event_version: "v1"`
- Breaking changes: New event type (e.g., `objective_completed_v2`), old event deprecated
- Deprecation: Old events supported for 24 months (long enough for all workflows to migrate)

---

### D-ARCH-008: Voice Core Versioning Follows Semantic Versioning
**Decision**: Voice core primitives follow semantic versioning (v1.0.0, v1.1.0, v2.0.0). Breaking changes increment major version.

**Rationale**:
- **Stability**: Customers on v1.x.x guaranteed no breaking changes
- **Opt-in upgrades**: Customer explicitly upgrades to v2.x.x (not forced)
- **Rollback**: If v2 has issues, customer reverts to v1

**Constraints**:
- Major version (v2.0.0): Breaking changes (validation rules, confirmation strategy)
- Minor version (v1.1.0): Backwards-compatible enhancements (new optional parameters)
- Patch version (v1.0.1): Bug fixes (no behavior changes)
- Customer config references major version: `capture_email_au@v1`

---

### D-ARCH-009: Orchestration Layer is Stateless (Event-Sourced)
**Decision**: Orchestration layer stores NO state in memory. All state reconstructed from event stream (event sourcing).

**Rationale**:
- **Scalability**: Stateless orchestration scales horizontally (any instance can handle any conversation)
- **Reliability**: Orchestration crashes don't lose conversation state (replay from events)
- **Debuggability**: Event stream is authoritative source of truth

**Constraints**:
- Conversation state: Reconstructed from event stream
- Event store: Kafka, EventBridge, PostgreSQL with event table
- Orchestration instances: Stateless, interchangeable
- State snapshots: Optional optimization (cache state, invalidate on new events)

---

### D-ARCH-010: <1 Hour Onboarding is Non-Negotiable SLA
**Decision**: V1 platform MUST support <1 hour onboarding (95th percentile) for new customers. This is non-negotiable SLA.

**Critical Clarification**:
- **Onboarding is performed by operators** (SpotFunnel team), NOT end customers.
- Customers receive a configured, working voice agent — they do NOT configure it themselves.
- The <1 hour SLA is for **operator efficiency** (you and your co-founder), not customer self-service.

**Rationale**:
- **Business model**: 2,000+ customers requires low onboarding cost
- **Competitive**: Vapi/Retell require 10-40 hours (prompt engineering)
- **Scalability**: <1 hour = 2,000 customers = 2,000 hours (vs 20,000-80,000 hours with prompt-centric)

**Constraints**:
- Onboarding = configuration only (no code, no prompt engineering)
- Configuration UI: Drag-and-drop objective graph builder (for operators)
- Testing: Automated test call validates configuration
- SLA: 95% of customers onboarded in <1 hour, 99% in <2 hours

---

## Why This Architecture Enables <1 Hour Onboarding

### The Math

**Prompt-Centric Architecture (Vapi, Retell, Voiceflow)**:
- Prompt engineering: 4-8 hours (write prompts for all conversation paths)
- Testing: 2-4 hours (test across conversation paths, fix edge cases)
- Debugging: 4-8 hours (fix prompt bugs, LLM inconsistencies)
- **Total**: 10-40 hours per customer

**At scale (2,000 customers)**:
- 10-40 hours × 2,000 customers = **20,000-80,000 hours**
- **Cost**: 10-40 person-years of engineering time
- **Time to 2,000 customers**: 5-10 years (with small team)

**Three-Layer Architecture (This Platform)**:
- Configuration: 10-20 minutes (select primitives, declare objective sequence)
- Testing: 10-20 minutes (automated test call)
- Debugging: 10-20 minutes (fix configuration errors via schema validation feedback)
- **Total**: 30-60 minutes per customer

**At scale (2,000 customers)**:
- 0.5-1 hours × 2,000 customers = **1,000-2,000 hours**
- **Cost**: 0.5-1 person-years of engineering time
- **Time to 2,000 customers**: 3-6 months (with small team)

### Why It Works

**1. Reusable Primitives Eliminate Redundant Work**
- **Prompt-centric**: Every customer rewrites email capture logic (2-4 hours per customer)
- **Primitive-based**: `capture_email_au` primitive reused across all customers (0 hours per customer)
- **Savings**: 2-4 hours × 2,000 customers = **4,000-8,000 hours saved**

**2. Declarative Configuration Eliminates Testing**
- **Prompt-centric**: Must test all conversation paths (20-50 paths), find/fix LLM inconsistencies
- **Primitive-based**: Primitives pre-tested (once), only test objective sequencing (5-10 paths)
- **Savings**: 2-4 hours testing × 2,000 customers = **4,000-8,000 hours saved**

**3. Schema Validation Eliminates Debugging**
- **Prompt-centric**: Debugging is trial-and-error (change prompt, test, repeat)
- **Configuration-based**: Schema validation rejects invalid configs immediately (10-20 minutes)
- **Savings**: 4-8 hours debugging × 2,000 customers = **8,000-16,000 hours saved**

**4. Immutable Voice Core Eliminates Regressions**
- **Prompt-centric**: Customer A's prompt changes break Customer B (unpredictable)
- **Immutable core**: Voice core unchanged, Customer A's config cannot affect Customer B
- **Savings**: 2-4 hours regression testing × 2,000 customers = **4,000-8,000 hours saved**

### Total Savings

**20,000-40,000 hours saved** (10-20 person-years)

**ROI**: 20-40× faster onboarding enables platform to scale to 2,000+ customers.

---

## Open Questions / Risks

### Q-ARCH-001: What If 10-20 Core Primitives Don't Cover 80% of Use Cases?
**Question**: Hypothesis is 10-20 primitives cover 80% of use cases. What if it's only 50%?

**Risk**: Customer requests exceed primitive library. Must build custom primitives (onboarding time increases to 4-8 hours).

**Mitigation**:
1. **V1 validation**: Track primitive coverage during first 100 customers. Alert if <75%.
2. **Generic primitives**: Build `capture_alphanumeric(regex, length)` generic primitive for uncommon cases.
3. **Custom primitive SLA**: If customer needs custom primitive, build in <4 hours (still better than 10-40 hour prompt engineering).

**V1 decision**: Accept risk. If primitive coverage <75%, add generic primitives in V1.1.

---

### Q-ARCH-002: How to Handle Conversation Resumption After Interruption?
**Question**: User interrupts mid-objective. How does system resume?

**Risk**: Resumption logic complex (must store partial state, resume from correct point).

**Mitigation**:
1. **Event sourcing**: All state in event stream. Resumption replays events, reconstructs state.
2. **Objective state machine**: Objective state (ELICITING, CAPTURED, CONFIRMING) persisted. Resumption continues from current state.
3. **Graceful degradation**: If resumption fails, restart objective (user re-provides information).

**V1 decision**: Implement event-sourced resumption. Test with interruption scenarios (user says "wait", "hold on", "let me check").

---

### Q-ARCH-003: How to Version Objective Configurations?
**Question**: Customer has 100 active conversations. Wants to deploy new objective config. How to handle in-flight conversations?

**Risk**: In-flight conversations crash if objective config changes mid-conversation.

**Mitigation**:
1. **Immutable conversation config**: Each conversation locks config version at start. Runs to completion with that version.
2. **Blue-green deployment**: New conversations use new config. Old conversations complete with old config.
3. **Graceful migration**: After 24 hours (max conversation duration), all conversations on new config.

**V1 decision**: Immutable conversation config. In-flight conversations unaffected by config changes.

---

### Q-ARCH-004: How to Handle LLM Provider Outages?
**Question**: OpenAI outage. Conversations crash. How to handle?

**Risk**: LLM provider outage = platform outage (unacceptable for 99.9% uptime SLA).

**Mitigation**:
1. **Multi-LLM fallback**: Primary LLM (GPT-4o), fallback LLM (Claude 3.5 Sonnet), tertiary LLM (Groq Llama 3.1)
2. **Provider-agnostic primitives**: Primitives work with any LLM provider (no provider-specific logic)
3. **Automatic retry**: LLM call fails → retry 3x with exponential backoff → fallback to secondary provider

**V1 decision**: Implement multi-LLM fallback. Test with simulated provider outages.

---

### Q-ARCH-005: How to Handle Workflow Engine Outages?
**Question**: Customer's n8n instance down. Workflows fail. How does conversation handle?

**Risk**: Conversation blocks waiting for workflow (violates async architecture).

**Mitigation**:
1. **Fire-and-forget events**: Conversation emits events, never waits for acknowledgment
2. **Event retry**: Platform retries event delivery 3x, then logs failure
3. **Conversation continues**: Workflow failures logged, conversation unaffected

**V1 decision**: Conversation never waits for workflow. Workflow failures customer's responsibility.

---

### Q-ARCH-006: How to Prevent Configuration Drift Between Environments?
**Question**: Customer tests config in staging. Deploys to production. Configs drift. How to prevent?

**Risk**: Production config different from staging config. Production bugs not caught in staging.

**Mitigation**:
1. **Config version control**: Customer config stored in Git. Deploy from Git.
2. **Immutable deployments**: Config deployment creates immutable version (like Bedrock AgentCore)
3. **Diff visualization**: Platform shows diff between staging and production configs before deployment

**V1 decision**: Config version control + immutable deployments. Enforce in onboarding process.

---

### Q-ARCH-007: How to Handle Multi-Turn Objectives?
**Question**: Some objectives require multi-turn conversation (e.g., "capture full address" = street, suburb, state, postcode). How to model?

**Risk**: Objective graph becomes too granular (1 objective per field) OR too coarse (1 objective for entire address).

**Mitigation**:
1. **Composite primitives**: `capture_address_au` primitive handles multi-turn internally (captures components, validates, confirms)
2. **Objective state machine**: Objective has internal sub-states (ELICIT_STREET → ELICIT_SUBURB → ELICIT_STATE → ELICIT_POSTCODE → CONFIRM)
3. **Single event**: Objective emits single `objective_completed` event after all components captured

**V1 decision**: Composite primitives for multi-turn objectives. Objective graph remains high-level.

---

### Q-ARCH-008: How to Handle Conditional Objectives?
**Question**: Some objectives conditional (e.g., "if user says 'callback', capture phone; else skip phone"). How to model?

**Risk**: Objective graph becomes imperative (if/else logic) instead of declarative.

**Mitigation**:
1. **Conditional edges**: Objective graph supports conditional edges (`on_success_if: user_said_callback`)
2. **LLM classification**: LLM classifies user intent, orchestration follows conditional edge
3. **Declarative guards**: Guards are declarative predicates (`user_said_callback: true/false`), not imperative code

**V1 decision**: Conditional edges with declarative guards. LLM classifies, orchestration routes.

---

### Q-ARCH-009: How to Debug Multi-ASR Voting Failures?
**Question**: Multi-ASR systems disagree (Deepgram says "jane", Groq says "jain", AssemblyAI says "jen"). LLM ranks incorrectly. How to debug?

**Risk**: Cannot debug why LLM chose wrong transcription.

**Mitigation**:
1. **Event logging**: Log all ASR outputs + LLM ranking decision
2. **Replay with alternative ranking**: Replay conversation with "what if LLM chose different transcription"
3. **Human-in-the-loop**: If confidence low, escalate to human (transfer call)

**V1 decision**: Event logging for multi-ASR decisions. Human escalation for low-confidence critical data.

---

### Q-ARCH-010: How to Handle Objective Dependencies?
**Question**: Some objectives depend on others (e.g., "capture appointment time" depends on "capture service type" to know business hours). How to model?

**Risk**: Objective graph becomes complex (dependencies create tight coupling).

**Mitigation**:
1. **Objective context**: Objectives can reference data from previous objectives (`context.service_type`)
2. **Lazy evaluation**: Objective loads context when needed (not upfront)
3. **Explicit dependencies**: Objective declares dependencies (`depends_on: ["capture_service_type"]`)

**V1 decision**: Objective context with explicit dependencies. Orchestration enforces dependency order.

