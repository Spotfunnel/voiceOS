# Architectural Decisions

All decisions must comply with `docs/ARCHITECTURE_LAWS.md`.

This document contains only keystone, enforceable decisions that translate the laws
into explicit enforcement hooks. Explanatory research belongs in the constitution.

## Table of Contents
- [D-ARCH-001: Three-Layer Architecture is Mandatory](#d-arch-001-three-layer-architecture-is-mandatory)
- [D-ARCH-002: Voice Core Immutability and Versioning](#d-arch-002-voice-core-immutability-and-versioning)
- [D-ARCH-003: Objectives Are Declarative Configuration Only](#d-arch-003-objectives-are-declarative-configuration-only)
- [D-ARCH-004: Workflows Are Async and Non-Blocking](#d-arch-004-workflows-are-async-and-non-blocking)
- [D-ARCH-005: Workflows Cannot Control Conversation Sequencing](#d-arch-005-workflows-cannot-control-conversation-sequencing)
- [D-ARCH-006: Critical Data Confirmation Is Enforced in Voice Core](#d-arch-006-critical-data-confirmation-is-enforced-in-voice-core)
- [D-ARCH-007: Configuration-Only Onboarding With Schema Validation](#d-arch-007-configuration-only-onboarding-with-schema-validation)
- [D-ARCH-008: Locale Is Required and Selects Immutable Primitives](#d-arch-008-locale-is-required-and-selects-immutable-primitives)
- [D-ARCH-009: Voice Core Emits Immutable, Append-Only Events](#d-arch-009-voice-core-emits-immutable-append-only-events)
- [D-ARCH-010: Orchestration Is Stateless and Event-Sourced](#d-arch-010-orchestration-is-stateless-and-event-sourced)

---

### D-ARCH-001: Three-Layer Architecture is Mandatory
**Decision (testable):** The system MUST have exactly three layers: Voice Core (Layer 1), Objective & Orchestration (Layer 2), Workflow / Automation (Layer 3). No additional layers. No layer merging.

**Enforcement surface:** Architecture review gate, service boundaries, repo layout checks, and CI static checks for cross-layer imports.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-001: Three-Layer Architecture is Mandatory (No Exceptions)`

---

### D-ARCH-002: Voice Core Immutability and Versioning
**Decision (testable):** Voice core primitives, confirmation, repair, and turn-taking behavior MUST be identical across all customers. Primitive behavior changes require a new version; existing versions never change.

**Allowed global tuning (non-tenant):**
- ✅ Process-level deployment config applied uniformly to all tenants (set once at startup).
- ✅ Versioned Voice Core defaults chosen at deployment time.
- ❌ No per-tenant/per-request overrides or Layer 2 runtime knobs.

**Enforcement surface:** Voice core release process, versioned primitive registry, config validator (version pinning).

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-002: Voice Core MUST Be Immutable Across Customers`, `P-1: Immutable Voice Core with Versioned Primitives`

---

### D-ARCH-003: Objectives Are Declarative Configuration Only
**Decision (testable):** Customer configuration MUST declare WHAT to capture as objectives; imperative dialogue steps or prompt-encoded logic are rejected.

**Enforcement surface:** Configuration schema validation, onboarding compiler, UI builder constraints.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-003: Objectives MUST Be Declarative (Not Imperative)`, `P-2: Declarative Objective Configuration`

---

### D-ARCH-004: Workflows Are Async and Non-Blocking
**Decision (testable):** Conversations MUST NEVER wait for workflow completion. All workflow execution is asynchronous and triggered by events.

**Enforcement surface:** Runtime boundary checks, workflow adapter tests, CI rule to ban synchronous workflow calls from the voice runtime.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-004: Workflows MUST Be Asynchronous to Conversation`

---

### D-ARCH-005: Workflows Cannot Control Conversation Sequencing
**Decision (testable):** Workflows MUST NOT decide what to ask next, confirm, or repair. Sequencing is defined only in the objective graph.

**Enforcement surface:** Objective graph validator, workflow contract review, integration tests that run without workflow engine.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-005: Workflows MUST NOT Control Conversation Sequencing`

---

### D-ARCH-006: Critical Data Confirmation Is Enforced in Voice Core
**Decision (testable):** Critical data (email, phone, address, payment, appointment datetime) MUST always be confirmed by Layer 1 primitives regardless of ASR confidence.

**Enforcement surface:** Voice core primitive tests, confirmation strategy unit tests, config validator (disallow confirmation overrides).

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-006: Critical Data MUST Always Be Confirmed (Layer 1 Enforcement)`

---

### D-ARCH-007: Configuration-Only Onboarding With Schema Validation
**Decision (testable):** Onboarding MUST be configuration-only with schema validation; no per-customer code changes or prompt rewrites are allowed.

**Critical Clarification**:
- **Onboarding is performed by operators** (SpotFunnel team), NOT end customers.
- Customers receive a configured, working voice agent — they do NOT configure it themselves.
- The <1 hour onboarding SLA is for **operator efficiency**, not customer self-service.

**Enforcement surface:** Onboarding compiler, config schema validation, release checklist for customer onboarding.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-010: Onboarding MUST Be Configuration-Only (No Code Changes)`, `M-ARCH-006: Configuration Error Rate`

---

### D-ARCH-008: Locale Is Required and Selects Immutable Primitives
**Decision (testable):** Customer configuration MUST specify `locale`, and the system MUST select locale-specific primitives; locale behavior is immutable per locale.

**Enforcement surface:** Config schema validation, primitive resolver, locale-specific validation tests.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-008: Locale MUST Be Customer-Configurable, Primitive Behavior Per Locale Immutable`

---

### D-ARCH-009: Voice Core Emits Immutable, Append-Only Events
**Decision (testable):** Voice core MUST emit events for objective transitions and critical actions, and events MUST be append-only and replayable.

**Enforcement surface:** Event schema validation, event store append-only constraints, replay tests.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `R-ARCH-009: Voice Core MUST Emit Events for Observability`, `M-ARCH-010: Conversation Replay Success Rate`

---

### D-ARCH-010: Orchestration Is Stateless and Event-Sourced
**Decision (testable):** Orchestration MUST store no in-memory state and reconstruct conversation state from the event stream.

**Enforcement surface:** Orchestration runtime design review, event store integration tests, stateless deployment constraints.

**Source:** `docs/ARCHITECTURE_LAWS.md` → `D-ARCH-009: Orchestration Layer is Stateless (Event-Sourced)`

