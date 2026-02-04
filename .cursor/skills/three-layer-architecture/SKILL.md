# Three-Layer Architecture Enforcement Skill

Enforce strict separation between Voice Core (Layer 1), Orchestration (Layer 2), and Workflows (Layer 3) for scalable voice AI platforms.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Workflow / Automation (Async, Isolated)          │
│ - CRM updates, calendar booking, notifications             │
│ - Triggered by events, NEVER blocks conversation           │
│ - Failure isolation (workflow errors don't crash calls)    │
└───────────────────┬─────────────────────────────────────────┘
                    │ Events (async, fire-and-forget)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ EVENT BUS (Kafka/EventBridge)                               │
│ - Append-only event stream                                 │
│ - Powers replay, dashboards, workflow triggers             │
└───────────────────┬─────────────────────────────────────────┘
                    │ Events emitted
                    ▲
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
│ - PSTN/WebRTC telephony                                    │
│ - STT → LLM → TTS pipeline (streaming)                     │
│ - Capture primitives (validation, confirmation, repair)    │
│ - Turn-taking, barge-in, VAD                               │
│ - Multi-ASR voting                                         │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Voice Core (Immutable)

### What Layer 1 OWNS
- ✅ Telephony (PSTN, WebRTC call handling)
- ✅ Audio pipeline (STT, LLM, TTS streaming)
- ✅ Turn-taking (VAD, end-of-turn detection, barge-in)
- ✅ Capture primitives (email, phone, address with validation, confirmation, repair)
- ✅ Multi-ASR voting (3+ ASR systems, LLM ranking)
- ✅ State machine execution (objective state transitions)
- ✅ Event emission (objective_started, captured, confirmed, completed, failed)

### What Layer 1 MUST NEVER DO
- ❌ Decide which objective to execute next (Layer 2 responsibility)
- ❌ Execute business logic (CRM updates, calendar booking - Layer 3)
- ❌ Load customer configuration (Layer 2 responsibility)
- ❌ Wait for workflow responses (Layer 3 is async)

### Code Example: Valid Layer 1
```python
# ✅ CORRECT: Layer 1 primitive (immutable across customers)
class CaptureEmailPrimitive:
    def __init__(self):
        self.state = ObjectiveState.PENDING
        
    async def execute(self, llm, tts, stt):
        # ELICIT
        self.state = ObjectiveState.ELICITING
        await tts.speak("What's your email address?")
        
        # CAPTURE
        transcript = await stt.listen()
        email = extract_email(transcript)
        
        # VALIDATE (immutable rule)
        if not is_valid_email(email):
            # Re-elicit (max 3 retries)
            ...
        
        # CONFIRM (ALWAYS for critical data)
        self.state = ObjectiveState.CONFIRMING
        await tts.speak(f"Got it, {email}. Is that correct?")
        
        # COMPLETE
        self.state = ObjectiveState.COMPLETED
        return email
```

### Code Example: INVALID Layer 1
```python
# ❌ WRONG: Layer 1 should NOT decide sequencing
class CaptureEmailPrimitive:
    async def execute(self):
        email = await self.elicit()
        
        # ❌ WRONG: Deciding what to do next is Layer 2
        if email:
            next_objective = "capture_phone"  # VIOLATION
            orchestrator.execute(next_objective)
        
        # ❌ WRONG: Calling workflow is Layer 3
        await workflow_engine.send_email(email)  # VIOLATION
```

## Layer 2: Orchestration (Stateless)

### What Layer 2 OWNS
- ✅ Load customer objective graph (DAG) from configuration
- ✅ Execute objectives in sequence (or parallel if independent)
- ✅ Manage objective state (pending → in_progress → completed → failed)
- ✅ Handle failures (retry, skip, escalate based on objective config)
- ✅ Emit events (objective_started, objective_completed, objective_failed)
- ✅ Pause/resume objectives when conversation interrupted

### What Layer 2 MUST NEVER DO
- ❌ Modify primitive behavior (how confirmation works - Layer 1)
- ❌ Execute business logic (CRM updates, booking - Layer 3)
- ❌ Wait for workflow responses (Layer 3 is async)
- ❌ Validate user input (validation is Layer 1)

### Code Example: Valid Layer 2
```typescript
// ✅ CORRECT: Layer 2 orchestration (stateless, event-sourced)
class OrchestrationEngine {
  async executeObjectiveGraph(tenantId: string, conversationId: string) {
    // Load customer config (declarative)
    const config = await this.configService.load(tenantId);
    const objectives = config.objectives; // DAG of objectives
    
    // Execute objectives in sequence
    for (const objective of objectives) {
      await this.eventBus.emit('objective_started', { objective });
      
      // Call Layer 1 primitive (via gRPC)
      const result = await this.voiceCore.executePrimitive(objective.type);
      
      if (result.success) {
        await this.eventBus.emit('objective_completed', { objective, data: result.data });
        // Continue to next objective
      } else {
        // Handle failure (retry, skip, or escalate)
        if (objective.required) {
          await this.eventBus.emit('objective_failed', { objective });
          break; // Stop execution
        }
      }
    }
  }
}
```

### Code Example: INVALID Layer 2
```typescript
// ❌ WRONG: Layer 2 should NOT execute business logic
class OrchestrationEngine {
  async executeObjectiveGraph(tenantId: string) {
    const result = await this.voiceCore.executePrimitive('capture_email');
    
    // ❌ WRONG: Business logic belongs in Layer 3
    await this.sendConfirmationEmail(result.data.email);  // VIOLATION
    await this.updateCRM(result.data);  // VIOLATION
  }
}
```

## Layer 3: Workflow / Automation (Async)

### What Layer 3 OWNS
- ✅ CRM updates (Salesforce, HubSpot, custom)
- ✅ Calendar booking (Google Calendar, Calendly)
- ✅ Email/SMS sending (confirmation messages)
- ✅ Long-running tasks (background processing, data enrichment)
- ✅ Event consumption (subscribe to objective_completed events)

### What Layer 3 MUST NEVER DO
- ❌ Decide what to ask next (conversation sequencing is Layer 2)
- ❌ Modify conversation state (cannot change objective status)
- ❌ Block conversation (all workflow execution is async)
- ❌ Validate user input (validation is Layer 1)
- ❌ Control turn-taking (barge-in/interruption is Layer 1)
- ❌ Trigger re-elicitation (repair loops are Layer 1)

### Code Example: Valid Layer 3
```javascript
// ✅ CORRECT: n8n workflow (async, isolated)
// Trigger: webhook receives objective_completed event
{
  "event_type": "objective_completed",
  "objective_id": "capture_email",
  "data": {
    "email": "jane@example.com",
    "phone": "+61 412 345 678"
  }
}

// Workflow steps (ALL async, conversation already continued)
1. Create CRM record (Salesforce)
2. Book calendar slot (Google Calendar)
3. Send confirmation email (SendGrid)
4. Log to analytics (Mixpanel)

// If workflow fails: conversation unaffected (user never knows)
```

### Code Example: INVALID Layer 3
```javascript
// ❌ WRONG: Workflow should NOT control conversation
// n8n workflow that decides sequencing
if (email_captured) {
  // ❌ WRONG: Deciding next question is Layer 2
  trigger_objective('capture_phone');  // VIOLATION
}

// ❌ WRONG: Blocking conversation for workflow
conversation.wait_for_crm_response();  // VIOLATION (must be async)
```

## Event-Driven Integration (Binding Pattern)

### Event Schema (Immutable)
```json
{
  "event_id": "uuid-v4",
  "event_type": "objective_completed",
  "event_version": "v1",
  "tenant_id": "acme_plumbing",
  "conversation_id": "conv-123",
  "objective_id": "capture_email",
  "data": {
    "email": "jane@example.com"
  },
  "timestamp": "2026-02-03T10:23:45Z"
}
```

### Event Flow (Non-Negotiable)
```
[Layer 1: Voice Core]
    ↓ emits events
[Event Bus: Kafka/EventBridge]
    ↓ fires webhook
[Layer 3: n8n Workflow]

Conversation NEVER waits for Layer 3.
Workflow failures NEVER crash conversation.
```

## Common Violations & Fixes

### Violation 1: Workflow Controls Sequencing
**❌ WRONG**:
```python
# n8n workflow decides: "if email captured, ask for phone"
if objective_completed == "capture_email":
    trigger_objective("capture_phone")  # VIOLATION
```

**✅ CORRECT**:
```yaml
# Layer 2 config declares sequence (declarative)
objectives:
  - id: capture_email
    type: capture_email_au
    on_success: capture_phone  # Explicit sequencing
    
  - id: capture_phone
    type: capture_phone_au
    on_success: end_call
```

### Violation 2: Conversation Waits for Workflow
**❌ WRONG**:
```python
# Layer 1 waits for CRM response
email = await capture_email()
crm_response = await workflow.update_crm(email)  # VIOLATION (blocks)
if crm_response.success:
    say("Your details have been saved")
```

**✅ CORRECT**:
```python
# Layer 1 continues immediately
email = await capture_email()
await event_bus.emit('objective_completed', {'email': email})  # Async
say("Thanks! We'll send you a confirmation email shortly.")  # No wait
```

### Violation 3: Layer 1 Contains Customer-Specific Logic
**❌ WRONG**:
```python
# Customer-specific prompt in primitive
class CaptureEmailPrimitive:
    def __init__(self, customer_prompt: str):
        self.prompt = customer_prompt  # VIOLATION (not immutable)
        
    async def elicit(self):
        await tts.speak(self.prompt)  # Different per customer
```

**✅ CORRECT**:
```python
# Primitive behavior is immutable
class CaptureEmailPrimitive:
    async def elicit(self):
        # Same prompt for ALL customers
        await tts.speak("What's your email address?")
```

## Architecture Validation Checklist

Before deploying ANY code, verify:

### Layer 1 Checklist
- [ ] Voice Core unchanged across ALL customers
- [ ] Primitives versioned (v1, v2, v3)
- [ ] No customer-specific code in primitives
- [ ] No synchronous calls to Layer 2 or Layer 3
- [ ] All critical data confirmed (email, phone, address, payment, datetime)

### Layer 2 Checklist
- [ ] Objective graph is DAG (no cycles)
- [ ] Configuration is declarative (WHAT, not HOW)
- [ ] No business logic (CRM, calendar, email)
- [ ] Event-sourced (all state reconstructable from events)
- [ ] No synchronous calls to Layer 3 (workflows)

### Layer 3 Checklist
- [ ] Workflows triggered by events (not synchronous calls)
- [ ] Workflows NEVER modify conversation state
- [ ] Workflow failures logged, conversation continues
- [ ] No conversation sequencing logic in workflows

## Enforcement Strategies

### Code Review Checklist
```markdown
- [ ] Layer 1 changes: Is this truly immutable across customers?
- [ ] Layer 2 changes: Is configuration declarative (not imperative)?
- [ ] Layer 3 changes: Are workflows async and isolated?
- [ ] Event schema changes: Is schema versioned and append-only?
- [ ] No layer violations (no cross-layer synchronous calls)
```

### Testing Strategy
```python
# Test Layer 1 immutability
def test_primitive_immutability():
    """Primitives must behave identically for all customers"""
    customer_a_result = capture_email_primitive.execute()
    customer_b_result = capture_email_primitive.execute()
    assert customer_a_result.validation_rules == customer_b_result.validation_rules

# Test Layer 2 determinism
def test_orchestration_determinism():
    """Same events → same state"""
    events = [event1, event2, event3]
    state_a = orchestrator.replay(events)
    state_b = orchestrator.replay(events)
    assert state_a == state_b

# Test Layer 3 isolation
def test_workflow_isolation():
    """Workflow failure must not crash conversation"""
    workflow_engine.fail_next_request()  # Simulate failure
    result = orchestrator.execute_objective('capture_email')
    assert result.success  # Conversation continues despite workflow failure
```

## Key Takeaways

1. **Layer 1 is immutable** - same behavior for all customers
2. **Layer 2 is declarative** - customer configures WHAT, not HOW
3. **Layer 3 is async** - workflows triggered by events, never block
4. **Events are append-only** - never modify, always add new event types
5. **No layer violations** - enforce separation via code review + testing

## References

- Architecture Laws: `docs/ARCHITECTURE_LAWS.md`
- Research: `research/22-voice-core-orchestration-workflows.md`
