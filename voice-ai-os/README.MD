# SpotFunnel Voice AI Platform

> **Canonical Rule**  
> All system changes MUST comply with `docs/ARCHITECTURE_LAWS.md`.  
> If a proposal violates the laws, the proposal is invalid — not the law.

SpotFunnel is a **production-grade Voice AI platform**.  
It is not a chatbot, not a prompt wrapper, and not a Vapi-style configuration toy.

This repository defines a **single immutable Voice AI Core** and a scalable system for deploying **thousands of customer-specific voice agents** in **under 1 hour per customer**, with **zero per-customer code or prompt engineering**.

The platform is built for **real phone calls, real businesses, real money, and real uptime**.

---

# STAGE 1 — WHAT WE ARE BUILDING

## The Goal (Plain English)

Build a system where:

- The **voice behavior is built once and reused forever**
- **Operators (you and your co-founder) configure** what the AI should accomplish, not how it talks
- New customers are onboarded in **< 1 hour** (by operators, not end customers)
- Workflow failures **never break calls**
- Every call is **observable, replayable, and auditable**
- The platform scales to **2,000+ businesses with no linear ops cost**

**Critical Clarification**:
- This is a **Voice AI production system** for home service businesses.
- **Onboarding is performed by operators** (SpotFunnel team), not end customers.
- Customers receive a configured, working voice agent — they do NOT configure it themselves.
- The <1 hour onboarding SLA is for operator efficiency, not customer self-service.

---

## What This Is NOT

- ❌ Not a chatbot  
- ❌ Not a prompt-driven agent  
- ❌ Not per-customer rebuilds  
- ❌ Not workflows deciding what to say next  
- ❌ Not customer-editable prompts or logic  
- ❌ Not “magic” LLM autonomy  

If a feature requires prompt rewriting, custom logic, or manual testing per customer, **it does not ship**.

---

## The Core Idea (One Sentence)

> **One immutable Voice Core, plus configurable Objectives and Workflows, deployed through a simple UI.**

---

## The Three Levels (Non-Negotiable)

### **Level 1 — Voice Core (Immutable, Shared)**
Built once. Versioned. Never customized per customer.

**Responsibilities:**
- PSTN + WebRTC telephony
- Streaming STT (partials + finals)
- Streaming TTS (low time-to-first-audio)
- Turn-taking, silence handling, barge-in
- Capture primitives (phone, email, address, date, etc.)
- Deterministic validation, confirmation, repair
- Locale-aware behavior (en-AU in V1)
- Call transfer primitives
- Structured event emission (append-only)

**Hard rule:**  
Level 1 behavior is identical across all customers.

**Nuance (Allowed Global Tuning):**
- ✅ Allowed: process-level deployment config applied uniformly to all tenants (set once at startup).
- ✅ Allowed: versioned Voice Core defaults chosen at deployment time.
- ❌ Not allowed: per-tenant or per-request overrides of Layer 1 behavior.
- ❌ Not allowed: runtime knobs exposed to Layer 2 that change Layer 1 mid-call.

---

### **Level 2 — Objective Engine (Configurable per Customer)**
Defines **WHAT the call must achieve**, not HOW the AI speaks.

**Responsibilities:**
- Declarative objective graphs (DAGs)
- Objective state machines
- Required vs optional objectives
- Conditional routing and escalation
- Deterministic sequencing
- Stateless execution (event-sourced)

**Examples of objectives:**
- Capture phone number
- Capture email
- Book appointment
- Route to human
- Support triage

**Hard rule:**  
Objectives are configuration only. No code. No prompts.

---

### **Level 3 — Workflow & Integrations (Async, Isolated)**
Handles business automation **outside the conversation**.

**Responsibilities:**
- CRM updates
- Calendar bookings
- Email / SMS notifications
- Internal alerts
- Data enrichment

**Hard rules:**
- Workflows are asynchronous
- Workflow failures never block or crash calls
- Workflows never control conversation flow

---

## The Platform Spine (What Makes This Scalable)

The platform includes shared infrastructure that binds the three levels together:

- Tenant & configuration service
- Configuration validation and versioning
- Phone number provisioning and routing
- Event ingestion and storage
- Deterministic replay engine
- Customer dashboard
- Global operator dashboard

This is what turns architecture into a real product.

---

## How Onboarding Takes < 1 Hour

Onboarding is **configuration**, not setup. **Performed by operators (SpotFunnel team), not customers.**

**Operator collects from customer:**
- Business details
- Required information fields (name, phone, email, service type, etc.)
- Escalation rules (when to transfer to human)
- Phone number choice
- Integration requirements (CRM, calendar, etc.)

**Operator configures via UI:**
- Objective selection (via templates)
- Objective sequencing (DAG)
- Validation rules
- Workflow triggers

**System does automatically:**
- Validates configuration
- Generates objective graph
- Pins config version
- Provisions phone number
- Runs test calls
- Activates tenant

**Customer receives:** A working voice agent on their phone number. They do NOT configure it themselves.

No code. No prompts. No manual debugging.

---

## End-to-End Call Flow

1. Caller dials a real phone number
2. Call routes to the Voice Core
3. Router resolves tenant + active config
4. Voice Core runs the call
5. Objectives execute deterministically
6. Events are emitted to the event spine
7. Workflows consume events asynchronously
8. Dashboards update in near real time

---

## Dashboards

### Customer Dashboard (Simple, Outcome-Focused)
- Calls answered vs missed
- Leads captured
- Bookings created
- Transfers to human
- Recordings and transcripts
- System online/offline status

Customers never see prompts, logic, or graphs.

---

### Global Operator Dashboard (Internal)
- Platform-wide health metrics
- Per-tenant performance
- Objective completion rates
- Workflow delivery failures
- Call replay and debugging
- Cost and latency tracking

If an issue cannot be diagnosed here, the platform is incomplete.

---

# STAGE 2 — HOW WE SHIP AND OPERATE IT

## V1 Scope (Must Ship)

V1 is complete when:

- Real phone calls work end-to-end
- Voice feels human (interruptions, pacing, silence)
- At least one full capture primitive is production-grade
- Objectives are config-driven
- Workflow failures are isolated
- Calls are replayable from events
- Dashboards exist (customer + operator)

---

## Explicitly Out of Scope for V1

- Multi-agent squads
- Training pipelines
- Fine-tuning
- Advanced analytics
- Multi-region hardening

These come later.

---

## Event Spine (Backbone of the System)

Everything emits events.

**Rule:**  
If something cannot be reconstructed from events, it is a bug.

Events power:
- Dashboards
- Replay
- Debugging
- Stress testing
- Future training

---

## Stress Testing & Quality

Stress testing is first-class.

The system must:
- Simulate hostile callers
- Simulate confused callers
- Test interruptions and silence
- Replay historical failures

Every failure becomes a test case.

---

## Cost Discipline

Target cost: **≤ $0.20 per minute**.

The system enforces cost control via:
- Short, bounded responses
- Minimal TTS talk time
- Selective knowledge retrieval
- Model routing by risk

If cost is not measurable, the system is incomplete.

---

## Repository Layout


---

## Decision Discipline

Irreversible decisions are recorded in:
`docs/decisions/`

Re-litigation is not allowed.

---

## Quality Bar

A production-ready agent:

- Responds quickly and calmly
- Never bulldozes callers
- Confirms critical data
- Handles ambiguity safely
- Transfers correctly
- Is fully observable and replayable
- Improves without rebuilds

If it feels impressive but fragile, it does not ship.

---

## Final Rule

> **The Voice Core is built once.  
> Everything else is configuration.**

If the system drifts from this document, **this document wins**.

# STAGE 2 — HOW WE SHIP, SCALE, AND OPERATE THE PLATFORM

This section defines **how the system is built, deployed, onboarded, and operated in production**.

Stage 1 explains *what* the platform is.  
Stage 2 explains *how it actually becomes a scalable business*.

This section is **execution-focused** and assumes all architecture laws are binding.

---

## V1 SHIPPING DEFINITION

V1 is considered **shipped** when the platform can:

- Handle real inbound phone calls end-to-end
- Run the same Voice Core for multiple customers without modification
- Onboard a new customer in **< 1 hour**
- Survive workflow failures without breaking calls
- Replay any call deterministically from events
- Be monitored via dashboards (customer + operator)

Anything not required to meet these criteria is **out of scope for V1**.

---

## CUSTOMER ONBOARDING MODEL (NO CODE, NO PROMPTS)

Onboarding is a **guided configuration flow**, not a setup checklist and not a builder.

### Customer Inputs (All Structured)
- Business profile (name, hours, service area)
- Objective template selection
- Required vs optional information
- Escalation rules (when to transfer to human)
- Phone number selection (new / forwarded / ported)
- Integrations via connectors (calendar, CRM, notifications)

### System Responsibilities
- Validate configuration against schema
- Generate objective DAG
- Pin configuration version to tenant
- Provision phone number routing
- Run automated test calls
- Activate deployment

**Rule:**  
If onboarding requires writing code, editing prompts, or manual debugging, the platform has failed.

---

## CONFIGURATION AS A COMPILATION PIPELINE

Customer onboarding behaves like a compiler, not a form.

### Pipeline Stages
1. **Input validation**  
   Reject invalid configurations early.

2. **Objective graph generation**  
   Build a deterministic DAG from templates and toggles.

3. **Version pinning**  
   Each deployment references an immutable config version.

4. **Phone routing binding**  
   Phone number → tenant → config version.

5. **Smoke testing**  
   Scripted test calls validate objectives.

6. **Activation**  
   New calls use the new config. In-flight calls finish on old config.

This ensures **safe iteration without downtime**.

---

## EVENT SPINE (SYSTEM OF RECORD)

The platform is event-driven end to end.

### Event Rules
- Append-only
- Strictly ordered per call
- Versioned schemas
- Never mutated or deleted

### Events Power
- Call replay
- Debugging
- Dashboards
- Stress testing
- Workflow triggers
- Future training pipelines

**Rule:**  
If system state cannot be reconstructed from events, it is a bug.

---

## WORKFLOW INTEGRATION (ASYNC ONLY)

Workflows live **outside** the conversation runtime.

### Characteristics
- Triggered by events
- Fire-and-forget delivery
- At-least-once semantics
- Idempotent by design

### Allowed Workflow Actions
- Create/update CRM records
- Book calendar slots
- Send emails or SMS
- Notify internal teams

### Forbidden Actions
- Deciding what the AI says next
- Blocking the conversation
- Validating user input
- Triggering repair or confirmation

Workflow failure must be **invisible to the caller**.

---

## TELEPHONY & REAL CALL HANDLING

The platform supports real phone numbers as first-class citizens.

### Supported Modes
- Provisioned numbers
- Forwarded existing numbers
- Ported numbers

### Runtime Guarantees
- Low latency audio
- Reliable barge-in
- Graceful handling of silence
- Safe call transfer (warm/cold where supported)
- Transfer failures handled cleanly

All call outcomes are logged and replayable.

---

## DASHBOARDS (READ-ONLY BY DESIGN)

Dashboards are **views over events**, not control systems.

---

### CUSTOMER DASHBOARD

Designed for clarity, not power.

**Shows:**
- Calls answered vs missed
- Leads captured
- Transfers completed
- Recordings and transcripts
- System online/offline status

**Allows edits (strictly scoped):**
- Business hours
- Holiday closures
- Escalation phone numbers
- Notification emails

Edits trigger validation and redeployment automatically.

---

### GLOBAL OPERATOR DASHBOARD (INTERNAL)

Used to run the platform at scale.

**Capabilities:**
- Platform-wide call volume
- Latency (p50 / p95 / p99)
- Objective completion rates
- Workflow delivery failures
- Cost per minute
- Tenant health overview

**Debug Tools:**
- Full event timeline
- Deterministic call replay
- Transfer and escalation traces
- Config version history

If an issue cannot be diagnosed here, the system is incomplete.

---

## STRESS TESTING & QUALITY GATES

Stress testing is mandatory and automated.

### Stress Harness Capabilities
- Simulated callers
- Adversarial speech
- Silence and interruption tests
- Replay of historical failures

### When Stress Tests Run
- Before first customer deployment
- Before any config change
- Before any Voice Core upgrade

Failures block deployment until resolved.

---

## COST DISCIPLINE (HARD CONSTRAINT)

Target cost: **≤ $0.20 per minute**.

Cost is controlled through:
- Short, bounded responses
- Minimal TTS talk time
- Selective knowledge retrieval
- Model routing by risk level

Cost is visible per:
- Call
- Tenant
- Objective
- Voice Core version

If cost is not measurable, the system is incomplete.

---

## REPOSITORY STRUCTURE (EXECUTION-ALIGNED)


---

## RELEASE DISCIPLINE

- Voice Core changes are rare and versioned
- Customer configs are immutable per deployment
- Rollbacks are instant
- No hotfixes bypass architecture laws

---

## FINAL OPERATIONAL RULE

> **Build the Voice Core once.  
> Ship configuration forever.  
> Measure everything.  
> Replay all failures.**

This section defines **how SpotFunnel becomes operable at scale**.
