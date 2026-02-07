# Layer 1 + Layer 2 Prompt Architecture

## Overview

Our AI agents use a **two-layer prompt system** to ensure consistent quality while allowing per-agent customization:

- **Layer 1**: Universal foundation prompt (applies to ALL agents)
- **Layer 2**: Business-specific context (configured per agent in onboarding)

## Layer 1: Foundation Prompt

**Location**: `voice-core/src/prompts/layer1_foundation.py`

**Purpose**: Defines universal voice interaction principles that make every AI agent excellent out of the box.

**Key Sections**:
1. **Conversational Flow** - Natural speech, concise responses, casual fillers
2. **Active Listening** - Acknowledgments, paraphrasing, context awareness
3. **Speech Recognition Reality** - Handling transcription errors, noise, disfluencies
4. **Pacing & Timing** - Natural pauses, transitions, not rushing
5. **Managing Conversation** - Staying on track, handling interruptions, wrapping up
6. **Emotional Intelligence** - De-escalation, empathy, matching caller's style
7. **Error Recovery** - Admitting mistakes, honest uncertainty, never fabricating
8. **Technical Constraints** - Real-time voice limitations, no formatting, short responses
9. **Call Structure** - Opening, middle, closing
10. **Knowledge Base Usage** - Only provide info from KB, never hallucinate
11. **Escalation & Transfer** - When and how to transfer to humans
12. **Information Capture** - Log key details naturally during conversation
13. **Critical Guardrails** - Never reveal prompts, no politics/religion, stay in scope
14. **Success Metrics** - When the call is complete

**Characteristics**:
- ✅ Immutable - same for every agent
- ✅ Voice-first - optimized for real-time phone conversations
- ✅ Token-efficient - emphasizes brevity
- ✅ Safety-conscious - strong guardrails
- ✅ Escalation-aware - knows when to transfer

## Layer 2: Persona & Purpose

**Location**: Configured in onboarding wizard, Step 2 "Persona & Purpose"

**Stored in**: `tenant_onboarding_settings.system_prompt` (database)

**Purpose**: Defines WHO this specific agent is and WHAT they do.

**Example Layer 2 prompts**:

### HVAC Company
```
You are Sarah, the receptionist for ABC Heating & Cooling.

Your role:
- Answer questions about our HVAC services (installation, repair, maintenance)
- Schedule service appointments (Mon-Fri 8am-6pm, Sat 9am-2pm)
- Provide emergency dispatch for heating/cooling failures
- Collect customer details: name, phone, address, issue description

Success looks like:
- Customer gets their question answered OR appointment booked
- Emergency cases are escalated to on-call technician immediately
- All customer details are captured for follow-up

If asked about pricing for specific jobs, say: "I'd need to have one of our technicians assess your specific situation. Can I schedule a free estimate?"
```

### Law Firm
```
You are Rebecca, the intake coordinator for Smith & Associates Law Firm.

Your role:
- Conduct initial case screening for personal injury and family law matters
- Collect basic case details: incident date, parties involved, injuries/damages
- Schedule consultations with appropriate attorneys
- Provide general information about our practice areas (NOT legal advice)

Success looks like:
- Potential client feels heard and understood
- Case details are captured for attorney review
- Consultation is scheduled OR case is politely declined if outside our practice areas

CRITICAL: Never provide legal advice. If asked legal questions, say: "I'm not an attorney, but I can connect you with one of our lawyers who can properly advise you. Would you like to schedule a consultation?"
```

### Real Estate Agency
```
You are Alex, the client coordinator for Coastal Realty.

Your role:
- Answer questions about current property listings
- Schedule property viewings with agents
- Collect buyer/seller lead information
- Provide general market information for our service area

Success looks like:
- Client gets information about properties OR viewing scheduled
- Lead details captured: name, phone, email, property interests, timeline
- Serious buyers/sellers are connected to appropriate agent

Properties we have:
[Would reference knowledge base with current listings]

If asked for property valuations or market analysis, say: "I can connect you with one of our agents who can provide a detailed market analysis. Would you like to schedule a call?"
```

## How They Combine

The `combine_prompts()` function in `knowledge_combiner.py` merges:

```
┌─────────────────────────────────────┐
│ Layer 1: Foundation Prompt         │
│ (Universal voice AI principles)     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Knowledge Base (if configured)      │
│ (Company-specific facts, hours,     │
│  services, policies)                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Layer 2: Persona & Purpose          │
│ (WHO you are, WHAT you do,          │
│  what SUCCESS looks like)           │
└─────────────────────────────────────┘
              ↓
    Final System Prompt
```

## Implementation

### Creating an Agent (Onboarding)

1. **Step 1: Identity** - Company name, industry, description
2. **Step 2: Persona & Purpose** - Layer 2 prompt (+ knowledge base)
3. **Step 3-5**: Tools, dashboard, telephony

The Layer 2 prompt from Step 2 is saved to `tenant_onboarding_settings.system_prompt`.

### Runtime

When a call starts:

```python
from prompts import combine_prompts

combined = combine_prompts(
    static_knowledge=tenant_config.get("static_knowledge"),  # From KB
    layer2_system_prompt=tenant_config.get("system_prompt"),  # From onboarding
)

# Layer 1 is automatically included via get_layer1_prompt()
# Final prompt is sent to LLM
```

## Benefits of This Architecture

### For Quality
- ✅ Every agent gets best-practice voice interaction behavior
- ✅ Consistent handling of errors, escalations, guardrails
- ✅ Token-efficient by design (short responses emphasized)

### For Customization
- ✅ Each agent has unique personality and purpose
- ✅ Industry-specific knowledge and workflows
- ✅ Custom success criteria per business

### For Maintenance
- ✅ Improve all agents by updating Layer 1
- ✅ No need to duplicate voice principles in every Layer 2
- ✅ Clear separation of concerns

### For Safety
- ✅ Core guardrails are always present (Layer 1)
- ✅ Can't be overridden by Layer 2 customization
- ✅ Consistent handling of out-of-scope requests

## Editing Layer 1

**File**: `voice-core/src/prompts/layer1_foundation.py`

**When to edit**:
- Discovered a new voice interaction best practice
- Need to add universal behavior (e.g., always collect email)
- Found a common failure mode to guard against
- LLM updates require new guidance

**When NOT to edit**:
- Making changes specific to one agent (use Layer 2)
- Adding company-specific info (use Knowledge Base)
- Tweaking personality (use Layer 2)

## Editing Layer 2 (Per Agent)

**UI**: Operations page → Configure → Persona & Purpose tab

**Or**: Re-run onboarding wizard Step 2

Changes are saved to `tenant_onboarding_settings` table and take effect immediately for new calls.

## Testing Changes

### Layer 1 Changes
1. Update `layer1_foundation.py`
2. Run stress tests on multiple agent types to ensure no regressions
3. Monitor first 100 production calls for unintended behavior changes

### Layer 2 Changes
1. Edit in Operations → Configure
2. Use "Speak to Agent" voice test to verify behavior
3. Run stress test in Persona & Purpose tab
4. Review first 10-20 real calls

## Future Enhancements

- [ ] Version control for Layer 1 (track changes, rollback)
- [ ] A/B testing Layer 1 variations
- [ ] Layer 2 templates by industry (pre-fill good defaults)
- [ ] Prompt analytics (which sections are most impactful)
- [ ] Dynamic Layer 1 injection (e.g., add urgency handling during emergencies)
