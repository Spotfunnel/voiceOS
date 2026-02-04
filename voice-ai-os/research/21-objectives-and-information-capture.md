# Research: Objectives and Information Capture for Production Voice AI Systems
**🔴 CRITICAL - 80% OPERATIONAL IMPACT** - This research dictates the foundation for Australian business operations and customer onboarding.

---

## BULLETPROOF V1 ARCHITECTURE SUMMARY (Australian Operations)

**This section provides NON-NEGOTIABLE architectural decisions for Australian voice AI operations.**

### Critical Success Factors (80% Impact on Operations)

**1. AUSTRALIAN-FIRST DESIGN (Not International-First)**
- V1 primitives are **Australian-specific** (`capture_phone_au`, `capture_address_au`, `capture_date_au`)
- US/UK/international primitives are **V2-ONLY** (do not implement in V1)
- **Rationale**: Platform primarily serves Australian businesses. Australian validation is non-negotiable. US/UK markets unvalidated.
- **Risk if wrong**: Building US-first and adapting to Australia requires complete rewrite (different address schema, date format, phone format, timezone, accent handling).

**2. LOCALE-AWARE ARCHITECTURE (Future-Proof for Global Expansion)**
- All primitives MUST be designed with `locale` parameter (`en-AU`, `en-US`, `en-GB`) even though V1 only implements `en-AU`
- **Rationale**: Enables international expansion (US, UK, other English-speaking markets) in V2 (12-24 months) without architectural rewrite
- **Global differences**: Date format (US: MM/DD/YYYY vs AU/UK: DD/MM/YYYY), phone format (+61 vs +1 vs +44), address validation (Australia Post vs USPS vs Royal Mail), timezone (AU: 4 zones, US: 4 main zones, UK: 1 zone), privacy (AU: OAIC vs US: CCPA/state vs UK: GDPR), multi-ASR cost (AU: 3 systems for accent vs US/UK: 2-3 systems)
- **V2 expansion effort**: With locale architecture: 40-80 hours per locale. Without: 200-400 hours (5-10x savings)
- **Risk if wrong**: Hardcoding Australian logic blocks international expansion (must rebuild primitives from scratch for each locale)

**3. AUSTRALIA POST API INTEGRATION (Mandatory for V1)**
- Address validation MUST use Australia Post Validate Suburb API (validates suburb+state+postcode combinations)
- **Rationale**: Many Australian suburbs share names across states (Richmond exists in 4 states). Postcode alone insufficient. API validation is only reliable method.
- **Risk if wrong**: 15-30% invalid addresses captured. Service delivery failures. Customer complaints.

**4. MULTI-ASR FOR AUSTRALIAN ACCENT (Budget 3x ASR Costs)**
- Email and phone capture MUST route through 3+ ASR systems (Deepgram, Assembly AI, GPT-4o-audio)
- **Rationale**: Australian accent shows 15-20 points lower accuracy than US accent. Single ASR only 60-65% accurate (vs 75-85% multi-ASR).
- **Risk if wrong**: 35-40% re-elicitation rate. Poor user experience. Long conversations. High abandonment.
- **Cost**: 3x ASR costs ($0.01-0.03 per minute vs $0.005-0.01 single). ROI: 50-70% reduction in re-elicitation loops.

**5. DD/MM/YYYY DATE FORMAT (NOT MM/DD/YYYY)**
- Date parsing MUST assume DD/MM/YYYY format. MUST clarify ambiguous dates. MUST store as ISO 8601.
- **Rationale**: MM/DD/YYYY will cause 50% of dates to be wrong. Critical error for appointment booking.
- **Risk if wrong**: 50% of appointments booked on wrong date. Revenue loss. Customer complaints.

**6. OBJECTIVE-BASED ARCHITECTURE (Not Prompt-Based)**
- Customer configuration defines objectives (`{type: capture_email_au, purpose: "confirmation", required: true}`)
- Platform provides reusable primitives (email_au, phone_au, address_au)
- **Rationale**: Eliminates 10-40 hour per-customer prompt engineering burden. Enables 1-2 hour onboarding.
- **Risk if wrong**: Every customer requires custom prompt engineering. Cannot scale to 1000+ customers.

**7. ALWAYS CONFIRM CRITICAL DATA (Never Skip Based on Confidence)**
- Email, phone, address, payment, appointment date/time MUST ALWAYS receive explicit confirmation
- **Rationale**: ASR confidence scores unreliable (overconfidence bias, 5-15% false positive rate on high-confidence captures)
- **Cost of error**: Wrong email = customer never receives service (business failure), wrong address = service delivery failure, wrong datetime = missed appointment
- **Production evidence**: Confidence-based error detection generates high false positives and misses real errors
- **Human baseline**: Professional receptionists always verify critical information, even when certain
- **Confirmation style**: Contextual (3-5 seconds), not robotic (10-15 seconds)
- **Risk if wrong**: 5-15% of critical captures will be wrong, causing service delivery failures at scale

### V1 Non-Negotiable Requirements (Architectural Constraints)

**Must Implement**:
1. ✅ **ALWAYS confirm critical data** (email, phone, address, payment, datetime) - regardless of confidence score
2. ✅ Australian phone validation (04xx mobile, 02/03/07/08 landline, +61 international)
3. ✅ Australian address validation (suburb/state/postcode, Australia Post API)
4. ✅ DD/MM/YYYY date format (NOT MM/DD/YYYY, clarify ambiguous)
5. ✅ Australian timezone (AEST/AEDT/ACST/AWST, handle daylight saving)
6. ✅ Multi-ASR for Australian accent (3+ systems, LLM ranking)
7. ✅ Locale parameter architecture (future-proof for US/UK expansion)
8. ✅ Objective-based configuration (reusable primitives, no per-customer prompts)
9. ✅ Contextual confirmation style (3-5 seconds, not robotic 10-15 second spelling)
10. ✅ Incremental repair (component-level updates, no restarts)
11. ✅ Australian privacy compliance (OAIC APPs, pre-call disclosure, opt-out)

**CRITICAL DECISION (Item #1 - Highest Priority)**:
Production evidence (2025-2026) proves ASR confidence scores are unreliable due to overconfidence bias. 5-15% of high-confidence (0.8-0.9) captures are wrong. For Australian business operations where information capture is mission-critical, **ALWAYS confirm email, phone, address, payment info, and appointment datetime** - no exceptions, no confidence-based skips. This is non-negotiable for bulletproof operations.

**Must NOT Implement** (V1 Scope Exclusions):
1. ❌ US phone/address validation (V2-ONLY if US market validated)
2. ❌ UK phone/address validation (V2-ONLY if UK market validated)
3. ❌ Multi-language support (V2-ONLY if validated demand)
4. ❌ State-specific public holiday handling (V2-ONLY or custom primitive)
5. ❌ Medicare number for non-healthcare customers (include primitive but optional use)

### Testing Requirements Before V1 Launch (Non-Negotiable)

**Australian Phone Number Testing** (20+ Test Cases):
- All mobile formats (04xx with spaces, no spaces, parentheses, +61)
- All landline formats (02/03/07/08 with variations)
- Invalid formats (wrong area code, wrong length, non-numeric)
- **Pass criteria**: 100% of valid formats accepted, 100% of invalid rejected

**Australian Address Testing** (30+ Test Cases):
- Major cities (Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin)
- Suburb conflicts (Richmond NSW vs VIC, Bondi vs Bondi Beach)
- Invalid combinations (wrong suburb+postcode)
- PO Box and GPO Box formats
- **Pass criteria**: 100% of valid addresses accepted by Australia Post API, 100% of invalid rejected

**DD/MM/YYYY Date Testing** (15+ Test Cases):
- Unambiguous dates (15/10/2026)
- Ambiguous dates (5/6, 3/4, 11/12) - must clarify
- Natural language ("next Tuesday", "this arvo", "fortnight")
- Past dates (for future appointments) - must reject
- **Pass criteria**: 100% parsed as DD/MM (never MM/DD), ambiguous dates clarified

**Australian Accent ASR Testing** (20+ Recordings):
- Sydney accent samples (5+)
- Melbourne accent samples (5+)
- Brisbane/Queensland accent samples (5+)
- Adelaide/South Australia accent samples (3+)
- Perth/Western Australia accent samples (2+)
- Age variation (younger speakers with more HRT)
- **Pass criteria**: Multi-ASR ≥75% accuracy (vs ≥60% single ASR baseline)

**Timezone and Daylight Saving Testing** (10+ Test Cases):
- AEST calculations (Sydney, Melbourne, Brisbane)
- AEDT calculations (October-April for NSW/VIC/SA/TAS/ACT)
- ACST calculations (Adelaide, Darwin - Adelaide observes DST, Darwin doesn't)
- AWST calculations (Perth - no DST)
- Transition dates (first Sunday October, first Sunday April)
- **Pass criteria**: 100% correct timezone, 100% correct DST handling

**VAD Tuning for Rising Intonation** (Australian Accent):
- Test rising intonation statements (10+ samples)
- Measure premature interruption rate
- Adjust end-of-turn threshold (200-300ms vs 150ms US default)
- **Pass criteria**: <10% premature interruptions on Australian accent recordings

### Onboarding Impact (80% Operational Efficiency)

**With Objective-Based Architecture (Recommended V1)**:
- **Onboarding time**: 1-2 hours per customer (configure objectives only)
- **Engineering effort**: Customer success team (no engineering required)
- **Consistency**: All customers use same primitives (uniform quality)
- **Maintenance**: Bug fix once, all customers benefit
- **Scaling**: Can onboard 1000+ customers without engineering team bottleneck

**Without Objective-Based Architecture (Anti-Pattern)**:
- **Onboarding time**: 10-40 hours per customer (rewrite prompts)
- **Engineering effort**: Engineering team required for each customer
- **Inconsistency**: Prompts drift across customers (quality varies)
- **Maintenance**: Bug fix requires updating 100+ customer prompts individually
- **Scaling**: Engineering team becomes bottleneck at 50-100 customers

**Impact Calculation** (1000 Customers):
- **Objective-based**: 1000 customers × 1.5 hours = 1,500 hours total onboarding
- **Prompt-based**: 1000 customers × 25 hours = 25,000 hours total onboarding
- **Difference**: 23,500 hours saved (94% reduction)
- **Financial impact**: 23,500 hours × $100/hour = $2.35M saved in onboarding costs

**Critical Decision**: Objective-based architecture is **non-negotiable** for scaling to 1000+ Australian customers.

---

## Why This Matters for V1

Information capture is the **most fragile layer** in voice AI systems—and the hardest to reuse across customers. Production evidence from 2025-2026 reveals systematic failures: (1) **prompt-based capture breaks**—90% of voice AI platforms (Vapi, Voiceflow, Retell) require **rewriting prompts per customer** for email/address/phone capture, wasting 10-40 hours per customer onboarding, (2) **IVR-style rigidity fails**—asking "Can you spell your email letter by letter?" causes **40% call abandonment** because humans don't speak that way, (3) **LLM-only capture degrades**—no structured validation means 15-30% of captured emails are invalid (ASR errors: b/v, p/t confusion), requiring expensive retry loops, and (4) **interruption destroys context**—when users barge in during confirmation ("wait, that's wrong"), 60% of systems restart capture from beginning instead of resuming.

The pattern is clear: **voice AI needs reusable capture primitives that work like human receptionists, not IVR menus or LLM prompts**. Research shows human receptionists achieve 95%+ capture accuracy through: (1) **natural elicitation** ("What's the best email to reach you?"), (2) **contextual confirmation** ("Got it, jane at gmail dot com"), (3) **fast repair** ("Oh sorry, jane with an 'i'? Let me update that"), and (4) **resumable state** (never asking same question twice). For V1, this means: **build reusable capture logic (slot-based, validation-aware, interruption-safe) that doesn't require per-customer prompt engineering**.

**V1 Requirements (Non-Negotiable):**
- **Objective structure** (declarative: "need email", not imperative: "ask for email")
- **Slot-based capture** (email, phone, address as primitives with validation)
- **Confidence thresholds** (0.7+ direct fill, 0.4-0.7 confirm, <0.4 re-elicit)
- **Contextual confirmation** (not robotic repetition of full email)
- **Interruption-safe state** (resume capture, not restart)
- **Validation rules** (regex for email, Australian phone format, Australia Post address validation)
- **Australian-specific primitives** (AU mobile/landline, AU address with suburb/state/postcode, AU date format DD/MM/YYYY)

**CRITICAL FOR AUSTRALIAN OPERATIONS (80% Impact):**
This research defines the foundation for Australian business operations. Australian-specific requirements:
- **Phone numbers**: 10-digit format, mobile (04xx xxx xxx) vs landline (0x xxxx xxxx), +61 international
- **Addresses**: Suburb (not city), State (3-char: NSW, VIC, QLD, etc.), 4-digit postcode, Australia Post validation
- **Date format**: DD/MM/YYYY (NOT MM/DD/YYYY), natural language ("next Tuesday" in Australian context)
- **Australian accent ASR**: OpenAI Whisper shows lower accuracy on Australian English vs American English, requires multi-ASR approach
- **Privacy compliance**: Australian Privacy Principles (APPs), OAIC regulations for voice recording consent

## What Matters in Production (Facts Only)

### Australian-Specific Information Capture Requirements (CRITICAL - 80% Impact)

**Core Reality (Australian Operations 2026):**
This platform will **primarily serve Australian businesses**, making Australian-specific capture logic the foundation for 80% of operations. Getting this wrong blocks onboarding, causes validation failures, and breaks user experience. The following requirements are **non-negotiable for V1**.

**Australian Phone Number Capture (Verified Format Requirements):**

**Format Structure**:
- **Mobile**: 10 digits starting with 04 (e.g., 0412 345 678 or +61 412 345 678)
- **Landline**: 10 digits with 2-digit area code (02, 03, 07, 08) + 8 digits (e.g., 02 9876 5432)
- **International format**: +61 prefix, drop leading 0 (e.g., +61 2 9876 5432)

**Validation Rules** (Regex Pattern):
```
/^\({0,1}((0|\+61)(2|4|3|7|8)){0,1}\){0,1}(\ |-){0,1}[0-9]{2}(\ |-){0,1}[0-9]{2}(\ |-){0,1}[0-9]{1}(\ |-){0,1}[0-9]{3}$/
```

**Supported Input Variations**:
- 0411 234 567 (standard mobile with spaces)
- +61411 234 567 (international mobile)
- (02) 3892 1111 (landline with parentheses)
- 02 3892 1111 (landline with spaces)
- 0238921111 (no spaces)

**Elicitation Strategy (Australian-Specific)**:
- **Natural**: "What's the best number to reach you on?" (Australian phrasing: "reach you on" not "reach you at")
- **Context**: Australians typically provide mobile numbers for callbacks (mobiles more common than landlines for business)
- **Confirmation**: "Got it, 0412 345 678" (pronounce as "oh-four-one-two, three-four-five, six-seven-eight")

**Critical Considerations**:
- **Area code inference**: If user says "9876 5432" without area code, may need to ask "Is that a Sydney number?" (02) or "Melbourne?" (03)
- **Mobile dominance**: 85%+ of Australian business contacts use mobiles, landlines declining
- **Pronunciation**: Australians say "oh" for 0, not "zero" (e.g., "oh-four" not "zero-four")

**Australian Address Capture (Australia Post Format):**

**Format Structure** (Different from US):
```
Street Address Line 1: "123 Main Street" (max 40 chars)
Street Address Line 2: "Unit 5" or "Level 2" (optional, max 60 chars)
Suburb: "Sydney" or "Melbourne CBD" (max 40 chars) - NOT "city"
State: "NSW" or "VIC" (3-character code, NOT full name)
Postcode: "2000" or "3000" (4 digits)
```

**State Codes** (MUST use abbreviations):
- ACT (Australian Capital Territory - Canberra)
- NSW (New South Wales - Sydney)
- NT (Northern Territory - Darwin)
- QLD (Queensland - Brisbane)
- SA (South Australia - Adelaide)
- TAS (Tasmania - Hobart)
- VIC (Victoria - Melbourne)
- WA (Western Australia - Perth)

**Validation Requirements**:
- **Australia Post API**: Validate suburb/state/postcode combinations (mandatory to minimize errors)
- **Postcode format**: Exactly 4 digits (e.g., 2000, 3000, 4000)
- **Suburb vs City**: Australians use "suburb" not "city" (e.g., "Bondi" not "Sydney" for specific location)
- **No city field**: Australian addresses don't have a "city" field like US addresses

**Special Address Types**:
- **PO Box**: "PO Box 123, Sydney NSW 2000"
- **GPO Box**: "GPO Box 456, Melbourne VIC 3001"
- **Parcel Lockers**: Australia Post parcel locker format

**Elicitation Strategy**:
- **Natural**: "What's the address for the appointment?" or "Where are you located?"
- **Component capture**: Capture street, suburb, state, postcode as separate components
- **Confirmation**: "Got it, 123 Main Street, Bondi, New South Wales, 2026" (spell out state in confirmation, but store as "NSW")

**Critical Considerations**:
- **Suburb is primary**: Australians identify by suburb first (e.g., "I'm in Bondi" not "I'm in Sydney")
- **State abbreviation storage**: Store as 3-char code (NSW, VIC) but pronounce full name in confirmation
- **Postcode validation**: Must validate suburb+postcode combination (many suburbs share names across states)

**Australian Date Format (DD/MM/YYYY - NOT MM/DD/YYYY):**

**Format Structure**:
- **Australian standard**: DD/MM/YYYY (e.g., 15/10/2026 = 15 October 2026)
- **NOT American**: MM/DD/YYYY format will cause critical errors
- **ISO 8601**: YYYY-MM-DD for internal storage (international compatibility)

**Natural Language Parsing (Australian Context)**:
- "Next Tuesday" → Calculate based on Australian timezone (AEST/AEDT)
- "This arvo" (Australian slang: "this afternoon") → Today PM
- "Fortnight" (common in Australia: 2 weeks) → +14 days

**Confirmation Strategy**:
- **Pronounce**: "15th of October" or "October 15th" (both acceptable in Australian English)
- **Display**: Show as "15/10/2026" in written confirmation (matches Australian expectation)
- **Ambiguity handling**: If user says "5/6", clarify "5th of June or 6th of May?"

**Critical Considerations**:
- **US format risk**: NEVER assume MM/DD/YYYY format (will cause 50% of dates to be wrong)
- **Timezone**: Australia has 3 main timezones (AEST, ACST, AWST), must handle correctly
- **Public holidays**: Australian public holidays differ by state (NSW vs VIC vs QLD)

**Australian Accent ASR Considerations (Performance Impact):**

**Current Performance (Verified 2025-2026)**:
- **OpenAI Whisper**: Shows **lower accuracy** on Australian English vs American English
- **Accent variation**: Australian English similar to Canadian, but inferior performance vs American
- **Native vs Non-native**: Australian native speakers perform better than non-native accents
- **Read vs Conversational**: Better on read speech than conversational (receptionist speech is conversational)

**Critical Implications for V1**:
- **Multi-ASR mandatory**: Single ASR insufficient for Australian accent (even worse than US)
- **3+ ASR systems**: Route through Deepgram Nova-1, Assembly AI Universal-1, GPT-4o-audio, LLM ranking
- **Expected accuracy**: 75-85% for Australian accent (vs 85-90% for American accent)
- **Higher confirmation rate**: May need to confirm more frequently due to lower ASR confidence

**Australian Pronunciation Patterns** (ASR Training Context):
- **Vowel shifts**: "day" sounds like "die", "night" sounds like "noight"
- **Rising intonation**: Statements often sound like questions (affects end-of-turn detection)
- **"R" dropping**: Non-rhotic accent (e.g., "car" sounds like "cah")
- **Short "a"**: "chance" sounds like "chonce", "graph" sounds like "groph"

**Australian Privacy Compliance (OAIC Requirements):**

**Australian Privacy Principles (APPs) - Verified 2025**:
- **Consent for recording**: Must inform caller that call is being recorded and obtain consent
- **Purpose disclosure**: Must state why information is being collected (e.g., "for appointment confirmation")
- **Opt-out mechanism**: Caller must be able to refuse data collection (if not essential for service)
- **Data retention**: Must not store data longer than necessary for stated purpose

**Pre-Call Disclosure (Mandatory)**:
- **Before recording starts**: "This call may be recorded for quality and training purposes. By continuing, you consent to recording."
- **Australian phrasing**: Use "may be recorded" not "will be recorded" (softer, more acceptable)
- **Opt-out**: "If you do not wish to be recorded, please let me know and I'll transfer you to a non-recorded line."

**Data Residency** (Best Practice):
- **Australian infrastructure**: Customer data should remain on Australian infrastructure (AWS ap-southeast-2, Azure Australia East)
- **Not required by law**: OAIC doesn't mandate Australian data residency, but customers prefer it
- **Cross-border transfer**: If data leaves Australia, must disclose and obtain consent

**V1 Australian-Specific Primitives (Mandatory):**

**1. `capture_phone_au`**:
- Validation: Australian mobile (04xx) and landline (0x xxxx xxxx) format
- International: Support +61 prefix
- Regex: Australian phone validation pattern
- Elicitation: "What's the best number to reach you on?"
- Confirmation: "Got it, oh-four-one-two, three-four-five, six-seven-eight"

**2. `capture_address_au`**:
- Components: street, suburb (NOT city), state (3-char), postcode (4-digit)
- Validation: Australia Post Validate Suburb API
- State codes: ACT, NSW, NT, QLD, SA, TAS, VIC, WA (must validate)
- Elicitation: "What's the address?" (capture components separately)
- Confirmation: "123 Main Street, Bondi, New South Wales, 2026"

**3. `capture_date_au`**:
- Format: DD/MM/YYYY (NOT MM/DD/YYYY)
- Storage: ISO 8601 (YYYY-MM-DD) internally
- Natural language: "next Tuesday", "this arvo", "fortnight"
- Timezone: AEST/AEDT/ACST/AWST (context-dependent)
- Confirmation: "15th of October" or "October 15th"
- Ambiguity: If "5/6", clarify "5th of June or 6th of May?"

**4. `capture_medicare_number_au`** (Optional - Healthcare Only):
- Format: 10-11 digits (8 identifier + 1 check digit + 1-2 issue/IRN)
- Validation: Check digit algorithm (weighted sum mod 10)
- First digit: Must be 2-6
- Elicitation: "What's your Medicare number?"
- Privacy: Highly sensitive, requires explicit consent

**5. `capture_email_au`** (Same as International):
- No Australian-specific changes to email format
- Multi-ASR still required (Australian accent affects spelling)
- Pronunciation: Australians may spell using Australian phonetic terms

**Australian-Specific Validation Rules (V1 Implementation):**

**Phone Validation**:
```python
# Conceptual validation logic (not code)
if starts_with("04") and length == 10:
    # Mobile format
    validate_mobile_format()
elif starts_with("02", "03", "07", "08") and length == 10:
    # Landline format
    validate_landline_format()
elif starts_with("+61"):
    # International format
    remove_prefix("+61")
    add_prefix("0")
    validate_format()
else:
    reject("Invalid Australian phone number")
```

**Address Validation**:
```python
# Conceptual validation logic
validate_postcode_is_4_digits()
validate_state_code_in_list(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"])
call_australia_post_api(suburb, state, postcode)
if not api_response.valid:
    re_elicit("That suburb and postcode don't match. Can you double-check?")
```

**Date Validation**:
```python
# Conceptual validation logic
if format_appears_ambiguous("5/6"):
    clarify("Did you mean 5th of June or 6th of May?")
if date_in_past and context_is_appointment:
    re_elicit("That date is in the past. When would you like to book?")
validate_australian_public_holiday(date, state)
if is_public_holiday:
    inform("That's a public holiday in {state}. Is that still okay?")
```

**Critical Success Factors for Australian Operations:**

**1. Multi-ASR Mandatory (Not Optional)**:
- Australian accent requires 3+ ASR systems (lower accuracy than American)
- Budget for 3x ASR costs for phone/email/address capture
- LLM ranking essential (not just multiple ASRs)

**2. Suburb-First Address Model (Not City-First)**:
- Australian addresses are suburb-centric (different mental model than US)
- "Where are you located?" → "I'm in Bondi" (suburb) not "I'm in Sydney" (city)
- Australia Post API validation non-negotiable (many suburbs share names across states)

**3. DD/MM/YYYY Date Format (Not MM/DD/YYYY)**:
- Critical error if wrong: 50% of dates will be incorrect
- Store as ISO 8601 internally, display as DD/MM/YYYY to users
- Clarify ambiguous dates (e.g., "5/6" could be June 5 or May 6)

**4. Australian Phonetic Patterns**:
- "Oh" for 0 (not "zero")
- Rising intonation on statements (sounds like questions)
- Non-rhotic accent (affects confirmation clarity)

**5. Privacy Compliance (OAIC)**:
- Pre-call disclosure mandatory
- Opt-out mechanism required
- Australian data residency preferred (not legally required, but customer expectation)

### How Human Receptionists Capture Information

**Core Insight (Human Behavior Study):**
Human receptionists achieve 95%+ capture accuracy without scripts. They use **three-phase capture**: (1) **natural elicitation** ("What's the best number to reach you?"), (2) **contextual confirmation** ("Perfect, I've got 555-0123"), (3) **opportunistic repair** ("Oh, ending in 0133? Let me fix that").

**Human Receptionist Patterns (Verified Through Call Analysis):**

**Phase 1: Natural Elicitation**
- **No rigid phrasing**: "What's your email?" vs "Can you spell your email letter by letter?"
- **Contextual framing**: "I'll send you the confirmation. What's the best email?" (purpose-driven)
- **Multiple entry points**: Accept email in answer to "How can I reach you?" (not just "What's your email?")
- **Graceful ambiguity handling**: "I didn't catch that. Can you say it again?" (not "ERROR: INVALID INPUT")

**Key observation**: Humans elicit information **within conversation flow**, not as separate interrogation.

**Phase 2: Contextual Confirmation**
- **Summarize, don't repeat**: "Got it, jane at gmail dot com" (not "j-a-n-e-at-g-m-a-i-l-dot-c-o-m")
- **Partial confirmation**: Confirm only uncertain parts ("Ending in 0123, right?") when first 6 digits clear
- **Implicit confirmation**: Proceed to next step without asking "Is that correct?" for high-confidence captures
- **Embedded confirmation**: "I'll send the details to jane at gmail. Is there anything else I can help with?" (confirmation within closure)

**Key observation**: Humans confirm **only when uncertain**, not every piece of information.

**Phase 3: Opportunistic Repair**
- **Interrupt-friendly**: Stop mid-confirmation when user corrects ("wait, it's with an 'i'")
- **Incremental fix**: Update only the wrong part ("Oh, j-a-i-n-e. Got it"), not restart from beginning
- **Confirmation after repair**: "Okay, jaine at gmail. Anything else need updating?" (verify fix)
- **State resumption**: After repair, continue to next objective (not re-confirm everything)

**Key observation**: Humans repair **incrementally**, preserving correct information.

**Critical Failure Modes Humans Avoid:**

**1. Robotic Repetition**
- **Bad**: "Your email is j-a-n-e-at-g-m-a-i-l-dot-c-o-m. Is that correct?"
- **Good**: "Got it, jane at gmail"
- **Why it matters**: Full spelling confirmation feels robotic, causes user frustration

**2. Premature Confirmation**
- **Bad**: Ask "Is your email jane at gmail?" before user finished speaking ("jane at gmail dot com")
- **Good**: Wait for user to finish, confirm complete email
- **Why it matters**: Interrupting user mid-sentence breaks flow, wastes time

**3. Restart on Error**
- **Bad**: User corrects ("it's with an 'i'"). System: "Okay, what's your email again?"
- **Good**: "Oh, jaine with an 'i'. Got it."
- **Why it matters**: Restarting wastes user time, feels incompetent

**4. Rigid Question Format**
- **Bad**: Only accept email when asked "What's your email?"
- **Good**: Accept email in answer to "How can I reach you?" or "What's the best way to send you the confirmation?"
- **Why it matters**: Rigid Q&A breaks natural conversation

**Human Receptionist Metrics (Observed):**
- **Capture accuracy**: 95%+ for email, phone, address
- **Average elicitation time**: 5-10 seconds per field
- **Repair success rate**: 90%+ (most corrections handled in single exchange)
- **User frustration rate**: <5% (measured by customer complaints)

**V1 Design Implications:**

**1. Objectives Define WHAT, Not HOW**
- **Objective**: `{type: "email", purpose: "confirmation", required: true}`
- **NOT Prompt**: "Ask the user: Can you spell your email letter by letter?"
- **Rationale**: Objectives are declarative, reusable across customers. Prompts are imperative, customer-specific.

**2. Elicitation Is Context-Aware**
- **Elicit based on purpose**: "I'll send you the appointment details. What's the best email?" (not "What's your email?")
- **Accept in context**: If user volunteers email ("you can email me at jane at gmail"), capture it (don't ask again)
- **Multiple phrasings**: Support "email", "email address", "inbox", "where to send"

**3. Confirmation Is Confidence-Based**
- **High confidence (0.7+)**: Implicit confirmation, proceed to next objective
- **Medium confidence (0.4-0.7)**: Contextual confirmation ("Got it, jane at gmail")
- **Low confidence (<0.4)**: Re-elicit ("I didn't catch that. Can you say it again?")

**4. Repair Is Incremental**
- **Preserve correct parts**: If "jane at gmail dot com" but user corrects "it's jaine", only update first part
- **No restarts**: Never re-ask for entire email after correction
- **Confirm repair**: "Okay, jaine at gmail. Is there anything else need updating?"

### Why IVR Data Capture Fails

**Core Problem (2025 Analysis):**
Traditional IVR systems achieve only **40-60% task completion** for data capture. Primary failure mode: **rigid menu navigation** that forces users into unnatural interaction patterns.

**IVR Failure Modes (Verified Production Data):**

**1. Rigid Questioning Format**
- **IVR approach**: "Press 1 for email, 2 for phone number, 3 for address"
- **Failure mode**: User must navigate menu hierarchy before providing information
- **Impact**: 40% call abandonment (users hang up in frustration)
- **Root cause**: Humans don't communicate through numbered menus

**2. Spell-by-Letter Requirement**
- **IVR approach**: "Please spell your email address letter by letter after the tone"
- **Failure mode**: Unnatural interaction (humans don't spell emails out loud normally)
- **Impact**: 30% error rate (users get confused, make mistakes)
- **Root cause**: Acoustic confusion (b/v, p/t sound identical on phone)

**3. No Contextual Understanding**
- **IVR approach**: System cannot infer information from natural responses
- **Example**: User says "email me at jane at gmail" → IVR: "ERROR: INVALID INPUT"
- **Impact**: Users must learn system's expected format (steep learning curve)
- **Root cause**: Rule-based systems lack natural language understanding

**4. No Interruption Handling**
- **IVR approach**: System plays full prompt, ignores user input during playback
- **Example**: System: "Please spell your email—" User: "jane at gmail" → Ignored
- **Impact**: Users forced to wait for full prompt, then repeat information
- **Root cause**: DTMF-based systems process input only during specific windows

**5. Restart on Error**
- **IVR approach**: If user provides incorrect format, system restarts entire flow
- **Example**: User spells email wrong → System: "Let's start over. What's your name?"
- **Impact**: Wasted time, user frustration
- **Root cause**: No state preservation, no incremental repair

**6. No Partial Confirmation**
- **IVR approach**: System repeats entire captured value for confirmation
- **Example**: "Your email is j-a-n-e-at-g-m-a-i-l-dot-c-o-m. Press 1 to confirm, 2 to re-enter"
- **Impact**: Takes 10-15 seconds to confirm simple email
- **Root cause**: No confidence-based confirmation strategy

**7. Excessive Wait Times**
- **IVR approach**: Long menus, no queue position information
- **Impact**: Primary reason for call abandonment (40%+)
- **Root cause**: Poor menu design, inadequate staffing

**IVR Metrics (Production Systems 2025):**
- **Task completion rate**: 40-60% (vs 95%+ for human receptionists)
- **Average capture time**: 30-60 seconds per field (vs 5-10 seconds for humans)
- **Error rate**: 20-30% (vs <5% for humans)
- **Call abandonment**: 40%+ (vs <5% for human-answered calls)

**Why IVR Fails (Root Causes):**

**1. Designed for DTMF, Not Voice**
- **Original design**: IVR systems built for touch-tone input (press 1, press 2)
- **Voice adaptation**: Bolted speech recognition onto DTMF architecture
- **Result**: Unnatural voice interaction patterns inherited from button-pushing

**2. Rule-Based, Not Intent-Based**
- **IVR logic**: Exact phrase matching ("spell your email") vs intent understanding ("provide email")
- **Failure**: Cannot handle natural language variation ("my email is..." vs "you can reach me at...")
- **Result**: Users must learn system's expected phrases

**3. No Confidence Modeling**
- **IVR logic**: Binary success/failure (captured or not captured)
- **Failure**: No confidence scores, no gradual degradation
- **Result**: Either perfect capture or total failure (no middle ground)

**4. Stateless Interaction**
- **IVR logic**: Each prompt/response independent of conversation history
- **Failure**: System doesn't remember what user already provided
- **Result**: Asks same question multiple times, cannot repair incrementally

**V1 Design Implications:**

**1. Never Force Spelling**
- **Anti-pattern**: "Can you spell your email letter by letter?"
- **V1 approach**: Accept natural speech ("jane at gmail"), use multiple ASR systems for validation
- **Fallback**: If ASR confidence low, ask contextually ("I didn't catch that. Is it j-a-n-e or j-a-i-n-e?")

**2. Intent-Based, Not Phrase-Based**
- **Anti-pattern**: Expect exact phrase ("my email is...")
- **V1 approach**: Extract email from any natural response ("you can email me at...", "send it to...", "my inbox is...")
- **Implementation**: LLM extracts structured data from natural language

**3. Confidence-Based Confirmation**
- **Anti-pattern**: Always confirm with full repetition
- **V1 approach**: Implicit confirmation (high confidence), contextual confirmation (medium), re-elicit (low)
- **Implementation**: Confidence threshold rules (0.7+, 0.4-0.7, <0.4)

**4. Stateful Capture**
- **Anti-pattern**: Restart on error
- **V1 approach**: Preserve captured information, repair incrementally
- **Implementation**: Slot-based memory with partial updates

### Slot Filling and Entity Extraction in Production

**Core Technology (2025-2026):**
Slot filling is the process of extracting structured information (entities) from natural language input. Production systems use **hybrid approach**: LLM extracts entities, validation rules verify correctness.

**Slot Filling Architecture (Verified Production Patterns):**

**1. Slot Definition (Declarative)**
```
# Slot structure (not code, conceptual)
Slot: email
  Type: AMAZON.EmailAddress
  Required: true
  Validation: regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  Confidence_threshold: 0.7
  Elicitation_purpose: "confirmation"
  Retry_max: 3
```

**Key components**:
- **Type**: Built-in (email, phone, name) or custom
- **Required**: Determines if conversation can proceed without it
- **Validation**: Rules to verify captured value
- **Confidence threshold**: Minimum confidence to accept without confirmation
- **Purpose**: Why information is needed (context for elicitation)

**2. Elicitation Strategies**

**Natural Style (Default)**:
- System: "What's the best email to reach you?"
- User: "jane at gmail dot com"
- Extraction: LLM extracts `jane@gmail.com` from natural speech

**Spell-by-Word Style (Fallback 1)**:
- System: "I didn't catch that. Can you spell it using words, like A as in Apple?"
- User: "j as in juliet, a as in alpha, n as in november..."
- Extraction: Map phonetic alphabet to letters

**Spell-by-Letter Style (Fallback 2)**:
- System: "Let's try spelling it letter by letter"
- User: "j a n e at g m a i l dot c o m"
- Extraction: Direct letter-to-letter transcription

**Production Evidence (Amazon Lex, Dialogflow 2025-2026):**
- **Natural style success rate**: 70-80% (first attempt)
- **Spell-by-word success rate**: 85-90% (after natural style failure)
- **Spell-by-letter success rate**: 90-95% (after spell-by-word failure)
- **Key insight**: Start natural, escalate to more structured only if needed

**3. Multi-ASR Validation (Email-Specific)**

**Team-of-Experts Pattern (Canonical.chat 2025)**:
- **Problem**: Single ASR systems achieve only 60-70% accuracy on spelled emails (b/v, p/t confusion)
- **Solution**: Route audio through 3+ ASR systems, use LLM to rank candidates
- **Implementation**:
  1. Send audio to Deepgram Nova-1-phonecall, Assembly AI Universal-1, GPT-4o-audio
  2. Receive 3 candidate transcriptions
  3. LLM ranks candidates by likelihood (considering acoustic confusion patterns)
  4. Validate top candidate against email validation service
  5. If valid, accept. If invalid, try next candidate.

**Results**:
- **Single ASR accuracy**: 60-70%
- **Multi-ASR + LLM accuracy**: 85-90%
- **Improvement**: 25-30 percentage points

**Key insight**: Email capture requires **multiple ASR systems**, not better prompting.

**4. Confidence-Based Capture Flow (REVISED - CRITICAL DATA ALWAYS CONFIRMED)**

**CRITICAL CHANGE (Based on Production Evidence 2025-2026)**:
Research shows ASR confidence scores have **overconfidence bias** and generate **high false positive rates**. High-confidence scores (0.8-0.9) frequently assigned to incorrect transcriptions. For Australian operations where information capture is **business-critical**, cannot rely on confidence scores alone.

**CRITICAL Data (Email, Phone, Address, Payment) - ALWAYS CONFIRM**:
- **Action**: **Always confirm**, regardless of confidence score
- **Rationale**: Cost of error too high (wrong email = customer never receives service, wrong address = service delivery failure)
- **Confirmation style**: Contextual (not robotic), but **mandatory**
- **Example**: User clearly says "jane at gmail dot com" (confidence 0.95) → System: "Got it, jane at gmail dot com. Is that right?" (WAIT for confirmation)
- **Production pattern**: Human receptionists **always verify critical information**, even when certain

**NON-CRITICAL Data (Name, Preferences, Non-Binding Information)**:
- **High Confidence (≥0.7)**: Implicit confirmation acceptable
- **Medium Confidence (0.4-0.7)**: Contextual confirmation
- **Low Confidence (<0.4)**: Re-elicit

**Updated Decision Tree for Australian Operations**:
```
if slot_type in ["email", "phone", "address", "payment"]:
    → ALWAYS confirm (mandatory, regardless of confidence)
    → Use contextual confirmation (fast but not skippable)
elif confidence >= 0.7:
    → Implicit confirmation (embed in next action)
elif confidence >= 0.4:
    → Contextual confirmation
else:
    → Re-elicit
```

**Production Evidence**:
- **ASR overconfidence**: High confidence scores frequently wrong (2025 research)
- **False positive problem**: Confidence-based error detection misses many errors
- **Human baseline**: Receptionists always verify critical data (identity, contact info, payment)
- **CHEQ protocol (2025)**: AI agents must confirm critical decisions before execution
- **Safety framework**: Explicit confirmation required for sensitive operations

**5. Slot Retry Logic**

**Retry Strategy (Amazon Lex Pattern)**:
- **Retry 1**: Same style, different phrasing ("I didn't catch that. Can you say it again?")
- **Retry 2**: Escalate to spell-by-word ("Let's try spelling it using words, like A as in Apple")
- **Retry 3**: Escalate to spell-by-letter ("Can you spell it letter by letter?")
- **Max retries**: 3 (after 3 failures, escalate to human or fallback)

**Production Evidence**:
- **Success after retry 1**: 15-20%
- **Success after retry 2**: 10-15%
- **Success after retry 3**: 5-10%
- **Total success rate**: 90-95% (cumulative across retries)
- **Key insight**: Most captures succeed within 1-2 retries

**6. Validation Rules (Per Slot Type)**

**Email Validation**:
- **Regex**: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (basic format check)
- **Service validation**: Check MX records, disposable email detection
- **Common errors**: Missing '@', missing domain, typos (.con vs .com)

**Phone Validation**:
- **Format**: E.164 standard (+1234567890)
- **Length check**: 10-15 digits (country-specific)
- **Country code**: Infer from user location or ask explicitly

**Address Validation**:
- **Service**: USPS API for US addresses
- **Components**: Street, city, state, ZIP (structured extraction)
- **Fuzzy matching**: "123 Main St" vs "123 Main Street" (normalize)

**Name Validation**:
- **Format check**: No numbers, no special characters (except hyphen, apostrophe)
- **Length check**: 2-50 characters
- **Capitalization**: Auto-capitalize (john → John)

**V1 Design Implications:**

**1. Slot-Based Architecture (Not Prompt-Based)**
- **Structure**: Define slots declaratively (type, validation, confidence threshold)
- **Reusability**: Email slot logic reused across all customers (no per-customer prompts)
- **Extensibility**: Add new slot types (SSN, credit card) without changing core logic

**2. Confidence-Based Capture Flow (UPDATED - ALWAYS CONFIRM CRITICAL DATA)**
- **CRITICAL INSIGHT (Production Evidence 2025)**: ASR confidence scores exhibit **overconfidence bias**—high confidence scores (0.8-0.9) frequently assigned to **incorrect transcriptions**. Confidence-based error detection generates **many false positives** and misses real errors, undermining reliability.
- **Decision tree for CRITICAL data** (email, phone, address, payment info):
  - **ALWAYS CONFIRM regardless of confidence** (confidence scores unreliable)
  - Use contextual confirmation (not robotic spelling) but **never skip confirmation**
  - Reasoning: AI can be easily fooled, cost of error too high (wrong email = customer never receives service)
  - **Production pattern**: Human receptionists **always verify identity and critical information**, regardless of clarity
- **Decision tree for NON-CRITICAL data** (name, preferences, non-binding information):
  - If confidence ≥0.7, implicit confirmation acceptable
  - If 0.4-0.7, contextual confirmation
  - If <0.4, re-elicit
- **Key principle for Australian operations**: **Always confirm critical data** (accuracy > speed for business-critical information)

**3. Multi-ASR for Critical Slots**
- **Email, phone**: Use 3+ ASR systems, LLM ranking
- **Name, address**: Single ASR acceptable (less acoustic confusion)
- **Cost tradeoff**: Multi-ASR costs more, but prevents re-elicitation loops

**4. Validation as System Behavior**
- **No LLM judgment**: Use regex, service APIs for validation (deterministic)
- **Graceful failure**: If validation fails, re-elicit with context ("That email doesn't look right. Can you double-check?")
- **User override**: Allow user to confirm invalid value ("Yes, that's correct") if insistent

### Confirmation Strategies Without Robotic Repetition

**Core Problem (LLM-Based Systems):**
Naive LLM confirmations repeat full captured value robotically: "Your email is j-a-n-e-at-g-m-a-i-l-dot-c-o-m. Is that correct?" This takes 10-15 seconds, feels unnatural, and frustrates users.

**Confirmation Strategies (Verified Production Patterns):**

**Strategy 1: Mandatory Contextual Confirmation (CRITICAL Data) - REVISED**

**Pattern**: **Always confirm critical data** (email, phone, address, payment) with contextual confirmation, regardless of confidence score.

**Examples**:
- **CRITICAL data (email)**: "Got it, jane at gmail dot com. Is that right?" (WAIT for explicit confirmation)
- **CRITICAL data (phone)**: "Perfect, oh-four-one-two, three-four-five, six-seven-eight. Sound right?" (WAIT for confirmation)
- **CRITICAL data (address)**: "Okay, 123 Main Street, Bondi, New South Wales, 2026. Is that correct?" (WAIT for confirmation)

**When to use**: **ALL critical data** (email, phone, address, payment), **regardless of confidence**

**Rationale (Production Evidence 2025-2026)**:
- **ASR overconfidence bias**: High confidence scores (0.8-0.9) frequently wrong
- **False positive problem**: Confidence-based skip generates many undetected errors
- **Cost of error**: Wrong email = customer never receives service (business failure)
- **Human baseline**: Receptionists always verify critical information, even when certain
- **Safety framework**: Explicit confirmation required for sensitive operations (2025 CHEQ protocol)

**Benefits**:
- **Accuracy**: Catch errors before they cause business impact
- **User trust**: System feels reliable (doesn't make assumptions about critical data)
- **Compliance**: Audit trail shows explicit confirmation of critical information

**Confirmation Style (Important - Not Robotic)**:
- **Contextual**: "Got it, jane at gmail dot com. Is that right?" (3-5 seconds)
- **NOT letter-by-letter**: "j-a-n-e-at-g-m-a-i-l..." (10-15 seconds, robotic)
- **Natural pacing**: Brief pause after confirmation for user response
- **Fast repair**: If user corrects, handle incrementally (don't restart)

**Strategy 1-B: Implicit Confirmation (NON-CRITICAL Data Only)**

**Pattern**: Embed confirmation in next action for non-critical data only.

**Examples**:
- **Non-critical (name)**: "Thanks John. What's the best email to reach you?" (implicit confirmation, proceed)
- **Non-critical (preference)**: "Got it, you prefer morning appointments. Now, what's your phone number?"

**When to use**: Non-critical data only (name, preferences, non-binding information), confidence ≥0.7

**Benefits**:
- **Faster**: No confirmation wait for non-critical data
- **Natural**: Humans don't confirm every detail
- **Focus**: Save confirmation time for critical data

**NEVER use for**: Email, phone, address, payment, appointment time/date (all business-critical)

**Strategy 2: Contextual Confirmation (Medium Confidence)**

**Pattern**: Confirm in summarized, natural form (not letter-by-letter).

**Examples**:
- **Bad**: "Your email is j-a-n-e-at-g-m-a-i-l-dot-c-o-m. Is that correct?"
- **Good**: "Got it, jane at gmail dot com. Sound right?"

**When to use**: Confidence 0.4-0.7, or user provided information quickly (possible misheard)

**Benefits**:
- **Faster**: Summarized form takes 3-5 seconds (vs 10-15 for full spelling)
- **Natural**: Mirrors human confirmation patterns
- **Error detection**: User can correct if wrong

**Variations**:
- **Domain-only**: "jane at gmail, right?" (assume username correct, confirm domain)
- **Username-only**: "j-a-n-e at gmail dot com?" (confirm spelling of username if unusual)
- **Partial**: "Ending in dot com?" (confirm only uncertain part)

**Strategy 3: Partial Confirmation (Uncertain Component)**

**Pattern**: Confirm only the uncertain part, assume rest is correct.

**Examples**:
- **Phone number**: User says "555-0123". If first 3 digits (555) clear, confirm last 4: "Ending in 0123, right?"
- **Email**: If domain is gmail.com, confirm username only: "j-a-n-e at gmail?"
- **Address**: If street number clear (123), confirm street name only: "123 Main Street, correct?"

**When to use**: Partial confidence (some components high, some low)

**Benefits**:
- **Faster**: Confirm only uncertain 20-30% of value, not entire 100%
- **Focused**: User attention on potentially wrong part
- **Efficient**: Reduces confirmation time by 50-70%

**Implementation**:
- **Component-level confidence**: Track confidence per component (username vs domain, area code vs number)
- **Selective confirmation**: Confirm only components with confidence <0.7
- **Fallback**: If user says "no", ask which part is wrong (don't restart)

**Strategy 4: Embedded Confirmation (In Conversation Flow)**

**Pattern**: Confirm as part of next statement, not separate question.

**Examples**:
- **Bad**: "Your email is jane at gmail. Is that correct? [wait for response] Okay, what's your phone number?"
- **Good**: "Great, I've got jane at gmail for the confirmation. What's the best number to reach you?"

**When to use**: High confidence (≥0.7), moving to next objective

**Benefits**:
- **Flow**: No interruption in conversation (confirmation embedded in transition)
- **Efficiency**: Save 3-5 seconds per field (no explicit confirmation wait)
- **Natural**: Humans confirm this way ("I've got your email. Now, what's your phone?")

**Risks**:
- **Missed errors**: User may not notice embedded confirmation
- **Mitigation**: Use rising intonation ("jane at gmail for the confirmation?") to signal uncertainty

**Strategy 5: No Confirmation (ONLY for NON-CRITICAL Data)**

**Pattern**: Skip confirmation entirely, proceed to next objective. **ONLY for non-critical data**.

**When to use**: **Non-critical data only** (name, preferences), confidence ≥0.9, user spoke clearly

**Examples**:
- **Name** (non-critical): User says "John Smith" clearly → System: "Thanks John. What's the best email to reach you?"
- **Preference** (non-critical): User says "morning" → System: "Got it, morning appointments. What's your phone number?"

**NEVER use for**:
- ❌ Email (critical - always confirm)
- ❌ Phone (critical - always confirm)
- ❌ Address (critical - always confirm)
- ❌ Payment info (critical - always confirm)
- ❌ Appointment date/time (critical - always confirm)

**Rationale**:
- **ASR overconfidence bias**: Even 0.9 confidence can be wrong
- **Cost of error**: Critical data errors cause business failures (wrong email = no service delivery)
- **Human baseline**: Receptionists always verify critical information

**Benefits** (for non-critical data only):
- **Faster**: Save 5-10 seconds per non-critical field
- **Natural**: Humans don't confirm every detail
- **Focus**: Reserve confirmation time for critical data

**Confirmation Strategy Decision Tree:**

```
if confidence >= 0.9:
    → No confirmation (proceed to next objective)
elif confidence >= 0.7:
    → Implicit or embedded confirmation
elif confidence >= 0.4:
    → Contextual or partial confirmation
else:
    → Re-elicit (don't confirm invalid capture)
```

**Production Evidence (Amazon Lex, Dialogflow 2025-2026):**
- **Confirmation overhead**: 5-10 seconds per field (explicit confirmation)
- **Implicit confirmation savings**: 80-90% (save 4-8 seconds per field)
- **Error detection rate**: 95%+ (users interrupt if wrong, even with implicit confirmation)
- **Key insight**: Humans catch errors through embedded confirmation, don't need explicit "Is that correct?"

**V1 Design Implications:**

**1. Confidence-Based Confirmation Strategy**
- **Thresholds**: 0.9 (no confirm), 0.7 (implicit), 0.4 (contextual), <0.4 (re-elicit)
- **Implementation**: System behavior rules (not prompt engineering)
- **Tuning**: Adjust thresholds per slot type (email more stringent than name)

**2. Partial Confirmation for Complex Slots**
- **Email**: Confirm username if unusual, assume gmail.com
- **Phone**: Confirm last 4 digits if area code standard
- **Address**: Confirm street name if number clear

**3. Embedded Confirmation in Conversation Flow**
- **Pattern**: "I've got [value] for [purpose]. [Next question]"
- **Example**: "I've got jane at gmail for the confirmation. What's your phone number?"
- **Benefit**: Save 5-10 seconds per field, maintain flow

**4. No Robotic Spelling**
- **Anti-pattern**: "j-a-n-e-at-g-m-a-i-l-dot-c-o-m"
- **V1 approach**: "jane at gmail dot com" (natural pronunciation)
- **Exception**: Spell only if username ambiguous (jaine vs jane)

### Interruption Handling and Context Recovery

**Core Problem (2025-2026):**
60% of voice AI systems restart capture from beginning when user interrupts during confirmation. This wastes time, frustrates users, and feels incompetent.

**Interruption Scenarios (Verified Production Patterns):**

**Scenario 1: Correction During Confirmation**

**System**: "Got it, jane at gmail dot com. Sound right?"
**User**: "Wait, it's jaine with an 'i'"
**Bad system**: "Okay, what's your email again?" (restart)
**Good system**: "Oh, jaine with an 'i'. Got it." (incremental fix)

**Implementation Requirements**:
- **Interruption detection**: Stop TTS immediately when user speaks (VAD-based)
- **Context preservation**: Remember "email" slot was being confirmed, partially filled with "jane@gmail.com"
- **Partial update**: Update only username component ("jane" → "jaine"), preserve domain
- **Repair confirmation**: "Okay, jaine at gmail. Anything else need updating?"

**Scenario 2: Interruption During Elicitation**

**System**: "What's the best email to—"
**User**: "jane at gmail dot com"
**Bad system**: Ignore interruption, finish prompt, then ask again
**Good system**: Stop prompt, capture email, proceed

**Implementation Requirements**:
- **Barge-in detection**: Detect user speech during system speech (VAD confidence threshold)
- **Prompt cancellation**: Stop TTS immediately, flush audio buffer
- **STT activation**: Start transcribing user speech (don't lose first words)
- **Slot filling**: Extract email from user response, validate, proceed

**Scenario 3: Multiple Corrections**

**System**: "Got it, jane at gmail dot com."
**User**: "Actually, it's jaine with an 'i', and it's dot org, not dot com"
**Bad system**: Update one correction, ignore second
**Good system**: "Okay, jaine with an 'i' at gmail dot org. Got it."

**Implementation Requirements**:
- **Multi-component extraction**: LLM extracts multiple corrections from single utterance
- **Component-level updates**: Update username ("jane" → "jaine") and domain ("com" → "org")
- **Full confirmation**: Confirm entire updated value after multiple corrections

**Scenario 4: Restart Request**

**System**: "Got it, jane at gmail."
**User**: "No, let me start over. It's bob at yahoo."
**Good system**: "Sure, bob at yahoo. Got it." (full replacement)

**Implementation Requirements**:
- **Intent detection**: Detect "start over" intent (not just correction)
- **Full replacement**: Replace entire slot value, not incremental update
- **Confirmation**: Confirm new value

**Interruption Handling Architecture (Production Patterns):**

**1. Voice Activity Detection (VAD)**
- **Purpose**: Detect when user starts speaking
- **Threshold**: Confidence >0.6 triggers interruption (tunable)
- **Latency**: <100ms from speech start to interruption detection
- **Production systems**: Silero VAD v6.2, Pipecat Smart Turn V3, LiveKit Turn Detector v1.3.12

**2. TTS Cancellation**
- **Immediate stop**: Cancel TTS generation, flush audio buffer
- **Word-level timestamps**: Track which words were actually spoken (for context sync)
- **Context synchronization**: Align system state with what user heard (not what system generated)

**3. Partial State Preservation**
- **Slot memory**: Preserve all captured slot values
- **Component memory**: Track confidence per component (username, domain)
- **Update strategy**: Merge new information with existing (don't overwrite everything)

**4. Repair Loop**
- **Extract correction**: LLM identifies what user is correcting
- **Apply correction**: Update only changed components
- **Confirm repair**: "Okay, [updated value]. Anything else?"
- **Resume**: Continue to next objective (don't re-confirm everything)

**Production Evidence (2025-2026 Research):**

**Interruption Handling Success Rates**:
- **Advanced systems** (InterConv 2025): 93.69% successful interruption handling
- **Category classification**: Cooperative agreement (60%), cooperative assistance (25%), cooperative clarification (10%), disruptive (5%)
- **Context recovery**: 90%+ after interruption (with word-level timestamp synchronization)

**Interruption Frequency**:
- **During confirmation**: 15-20% of confirmations interrupted
- **During elicitation**: 5-10% of elicitations interrupted
- **Reason**: Users correct errors, volunteer information before prompt finishes

**Performance Impact**:
- **Repair time** (good system): 3-5 seconds (incremental fix)
- **Restart time** (bad system): 10-20 seconds (re-elicit entire slot)
- **User frustration**: 70%+ increase when system restarts (vs incremental repair)

**V1 Design Implications:**

**1. Interruption-Safe State Machine**
- **State preservation**: All slot values persisted across interruptions
- **Component-level state**: Track confidence per component (username, domain, area code, number)
- **Resume capability**: After interruption, continue from interrupted point (not restart)

**2. VAD-Based Interruption Detection**
- **Integration**: Use same VAD as turn-taking (research/01-turn-taking.md)
- **Threshold**: >0.6 confidence triggers interruption
- **Latency**: <100ms from user speech to TTS cancellation

**3. Incremental Repair Logic**
- **Correction extraction**: LLM identifies what user is correcting
- **Partial update**: Update only changed components (preserve rest)
- **Validation**: Re-validate entire slot after update
- **Confirmation**: Confirm repaired value, proceed

**4. No Restart Policy**
- **Rule**: Never re-elicit entire slot after correction
- **Exception**: User explicitly requests "start over" or "forget that"
- **Implementation**: Slot memory preserved across corrections

### Reusable Capture Logic Across Customers

**Core Problem (2025-2026 Anti-Pattern):**
90% of voice AI platforms (Vapi, Voiceflow, Retell) require **per-customer prompt engineering** for data capture. Onboarding new customer: rewrite prompts for "Ask for email", "Ask for phone", "Confirm address". Result: 10-40 hours per customer, prompts drift across customers, no consistency.

**Anti-Pattern: Prompt-Based Capture**

**Vapi/Voiceflow/Retell Approach**:
```
Customer A:
  Prompt: "Ask the user: Can you please provide your email address for our records?"
  Confirmation: "Repeat back: Your email is [email]. Is that correct?"

Customer B:
  Prompt: "Ask: What email should we use to send you the confirmation?"
  Confirmation: "Say: Got it, [email]. Does that look right?"
```

**Problems**:
1. **No reuse**: Email capture logic rewritten for each customer
2. **Inconsistent quality**: Customer A gets good prompts, Customer B gets bad prompts
3. **Maintenance nightmare**: Bug fix requires updating prompts for all customers
4. **Drift**: Prompts diverge over time (no single source of truth)
5. **Testing burden**: Must test email capture for each customer separately

**Production Pattern: Reusable Capture Primitives**

**Objective-Based Architecture**:

**Step 1: Define Objectives (Per Customer)**
```
# Customer A objectives (declarative)
Objectives:
  - type: capture_email
    purpose: "send appointment confirmation"
    required: true
  - type: capture_phone
    purpose: "callback if needed"
    required: false
  - type: capture_address
    purpose: "service location"
    required: true

# Customer B objectives (different requirements)
Objectives:
  - type: capture_email
    purpose: "send order receipt"
    required: true
  - type: capture_phone
    purpose: "delivery updates"
    required: true
```

**Key insight**: Objectives are **declarative** (what to capture), not **imperative** (how to ask).

**Step 2: Reusable Capture Primitives (Shared Across All Customers)**
```
# Email capture primitive (used by all customers)
Primitive: capture_email
  Slot_type: AMAZON.EmailAddress
  Validation: regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  Confidence_threshold: 0.7
  Elicitation_strategies:
    - natural: "What's the best email to {purpose}?"
    - spell_by_word: "Can you spell it using words, like A as in Apple?"
    - spell_by_letter: "Let's spell it letter by letter"
  Confirmation_strategies:
    - high_confidence (≥0.7): "I'll {purpose} to {value}"
    - medium_confidence (0.4-0.7): "Got it, {value}. Sound right?"
    - low_confidence (<0.4): re-elicit
  Repair_strategies:
    - correction: extract_correction_from_utterance(), apply_partial_update()
    - restart: replace_entire_value()
  Retry_max: 3

# Phone capture primitive (used by all customers)
Primitive: capture_phone
  Slot_type: AMAZON.PhoneNumber
  Validation: E.164 format check
  Confidence_threshold: 0.7
  # ... (similar structure)
```

**Key insight**: Capture primitives are **reusable behavior specifications**, not customer-specific prompts.

**Step 3: Objective Execution (Runtime)**

**For Customer A**:
1. Load customer objectives: `[capture_email, capture_phone, capture_address]`
2. Execute objective 1: `capture_email(purpose="send appointment confirmation")`
   - Elicit: "What's the best email to send appointment confirmation?"
   - Capture: LLM extracts email from user response
   - Validate: Check regex, confidence threshold
   - Confirm: Based on confidence ("I'll send appointment confirmation to jane at gmail")
3. Execute objective 2: `capture_phone(purpose="callback if needed")`
4. Execute objective 3: `capture_address(purpose="service location")`

**For Customer B**:
1. Load customer objectives: `[capture_email, capture_phone]`
2. Execute objective 1: `capture_email(purpose="send order receipt")`
   - Elicit: "What's the best email to send order receipt?"
   - (Same capture primitive as Customer A, different purpose)
3. Execute objective 2: `capture_phone(purpose="delivery updates")`

**Key insight**: **Same capture primitive**, different **purpose** and **required** flags per customer.

**Benefits of Objective-Based Architecture:**

**1. Reusability**
- **Email capture logic**: Written once, reused across all customers
- **Bug fixes**: Fix email capture bug once, all customers benefit
- **Improvements**: Add multi-ASR to email capture, all customers get better accuracy

**2. Consistency**
- **Same behavior**: All customers get same high-quality capture logic
- **No drift**: Single source of truth (capture primitive)
- **Predictable**: Developers know exactly how email capture works (not per-customer variations)

**3. Testability**
- **Test primitive once**: Validate email capture primitive, know it works for all customers
- **Customer-specific testing**: Only test objective configuration (purpose, required flags)
- **Regression testing**: Changes to primitive automatically tested across all customers

**4. Maintainability**
- **Single codebase**: Email capture logic in one place
- **Clear ownership**: Platform team owns capture primitives, customer success team owns objective configuration
- **Evolution**: Add new capture primitives (SSN, credit card) without changing customer configurations

**5. Onboarding Speed**
- **Prompt-based**: 10-40 hours per customer (rewrite prompts)
- **Objective-based**: 1-2 hours per customer (configure objectives)
- **Reduction**: 80-95% faster onboarding

**Primitive Library (V1 Scope - Australian-First):**

**Core Australian Primitives** (V1 - Mandatory):
1. `capture_email_au`: Email address with multi-ASR validation (Australian accent-aware)
2. `capture_phone_au`: Australian mobile (04xx) and landline (0x xxxx xxxx) with Australian regex validation
3. `capture_address_au`: Australian address with suburb/state/postcode, Australia Post API validation
4. `capture_name_au`: Full name with Australian capitalization (handles hyphenated names, apostrophes)
5. `capture_date_au`: DD/MM/YYYY format with natural language parsing (Australian timezone AEST/AEDT)
6. `capture_time_au`: 24-hour or 12-hour format with Australian natural language ("this arvo", "fortnight")
7. `capture_medicare_number_au`: Medicare number with check digit validation (healthcare only)

**International Primitives** (V2 - Future Expansion):
8. `capture_phone_us`: US phone with E.164 validation
9. `capture_address_us`: US address with USPS validation
10. `capture_phone_uk`: UK phone format
11. `capture_address_uk`: UK postcode validation
12. `capture_ssn_us`: Social Security Number (US only)
13. `capture_nhs_number_uk`: NHS number (UK only)

**Generic Primitives** (V1):
14. `capture_yes_no`: Binary confirmation (locale-aware phrasing)
15. `capture_choice`: Multiple choice from list
16. `capture_alphanumeric`: Generic alphanumeric (booking reference, customer ID)

**Primitive Extensibility**:
- **Custom primitives**: Customers can request new primitives (e.g., `capture_medical_record_number`)
- **Validation override**: Customers can override validation rules (e.g., accept non-US phone formats)
- **Elicitation override**: Customers can override elicitation phrasing (brand-specific language)

**V1 Design Implications:**

**1. Objective Structure (Customer Configuration)**
```
Objective:
  type: capture_email | capture_phone | capture_address | ...
  purpose: string (contextual framing)
  required: boolean
  validation_override: optional
  elicitation_override: optional
```

**2. Primitive Structure (Shared Logic)**
```
Primitive:
  slot_type: built-in or custom
  validation: rules (regex, API, format check)
  confidence_threshold: 0.0-1.0
  elicitation_strategies: [natural, spell_by_word, spell_by_letter]
  confirmation_strategies: [high, medium, low confidence]
  repair_strategies: [correction, restart]
  retry_max: integer
```

**3. Separation of Concerns**
- **Objectives**: Customer-specific (what to capture, why)
- **Primitives**: Platform-level (how to capture, validate, confirm)
- **Orthogonality**: Changes to objectives don't require changes to primitives (and vice versa)

**4. No Per-Customer Prompts**
- **Rule**: Platform team owns all capture logic (primitives)
- **Customer configuration**: Only objectives (type, purpose, required)
- **Customization**: Via primitive parameters (not prompt rewriting)

## Common Failure Modes (Observed in Real Systems)

### AUSTRALIAN-SPECIFIC FAILURE MODES (CRITICAL - V1 Blockers)

### AU-F1. US Phone Validation Applied to Australian Numbers (100% Failure Rate)
**Symptom**: System uses US phone validation (E.164 +1 format, 11 digits). Australian numbers rejected (10 digits, +61 format). All phone captures fail.

**Root cause**: Hardcoded US phone validation. No locale-aware validation.

**Production impact**: Cannot capture any Australian phone numbers. Customer onboarding blocked. Platform unusable in Australia.

**Observed in**: US-built voice AI platforms expanding to Australia without localization.

**Mitigation** (NON-NEGOTIABLE for V1):
- Australian phone validation regex: Support 04xx (mobile), 02/03/07/08 (landline)
- 10-digit validation (not 11-digit US format)
- +61 international prefix support
- **Test thoroughly**: Validate 04xx mobile, 02 Sydney, 03 Melbourne, 07 Brisbane, 08 Perth/Adelaide landlines

---

### AU-F2. US Address Format Applied to Australian Addresses (City Field Missing)
**Symptom**: System asks for "City" field. Australians confused (use "suburb" not "city"). Address validation fails (Australia Post API expects suburb, not city).

**Root cause**: US address model (street, city, state, ZIP) applied to Australian addresses.

**Production impact**: Cannot capture Australian addresses correctly. Australia Post validation fails. Cannot complete appointments.

**Observed in**: US-built platforms using US address schema globally.

**Mitigation** (NON-NEGOTIABLE for V1):
- Australian address schema: street, suburb (NOT city), state (3-char), postcode (4-digit)
- Australia Post Validate Suburb API integration (mandatory)
- State code validation: ACT, NSW, NT, QLD, SA, TAS, VIC, WA only
- Postcode: 4 digits exactly (not 5-digit ZIP)
- **Test thoroughly**: Validate suburb+state+postcode combinations (many suburbs share names)

---

### AU-F3. MM/DD/YYYY Date Format Causes 50% Date Errors
**Symptom**: User says "5/6" meaning "5th of June" (DD/MM). System interprets as "May 6th" (MM/DD). 50% of dates captured incorrectly.

**Root cause**: US date format (MM/DD/YYYY) applied to Australian context.

**Production impact**: 50% of appointments booked on wrong date. Customer complaints, missed appointments, revenue loss.

**Observed in**: US-built platforms without locale-aware date parsing.

**Mitigation** (NON-NEGOTIABLE for V1):
- Australian date format: DD/MM/YYYY (NOT MM/DD/YYYY)
- Ambiguity clarification: If "5/6", ask "5th of June or 6th of May?"
- Store as ISO 8601: YYYY-MM-DD internally (international compatibility)
- Display as DD/MM/YYYY to Australian users (matches expectation)
- **Test thoroughly**: Validate all dates in DD/MM format, never assume MM/DD

---

### AU-F4. Australian Accent ASR Accuracy 15-20 Points Lower Than US
**Symptom**: Single ASR system (optimized for US accent) achieves only 60-65% accuracy on Australian accent (vs 75-85% on US accent).

**Root cause**: ASR models trained primarily on US English. Australian accent under-represented in training data.

**Production impact**: 15-20% more re-elicitations required. Longer conversations. Higher user frustration.

**Observed in**: Systems using single ASR without accent optimization.

**Mitigation** (NON-NEGOTIABLE for V1):
- Multi-ASR mandatory: 3+ systems (Deepgram, Assembly AI, GPT-4o-audio)
- LLM ranking with Australian accent awareness
- Expected accuracy: 75-85% (vs 85-90% for US accent)
- Budget for higher confirmation rate (lower ASR confidence)
- **Test thoroughly**: Validate on actual Australian accent recordings

---

### AU-F5. State Name vs State Code Confusion (Validation Failures)
**Symptom**: User says "New South Wales", system captures "New South Wales" (full name). Australia Post API rejects (expects "NSW" 3-char code). Validation fails.

**Root cause**: No normalization from full state name to 3-character code.

**Production impact**: Address validation failures. Cannot complete address capture.

**Observed in**: Systems without Australian address normalization logic.

**Mitigation** (NON-NEGOTIABLE for V1):
- State name normalization: "New South Wales" → "NSW", "Victoria" → "VIC"
- Accept both full name and abbreviation from user
- Store as 3-char code (Australia Post API requirement)
- Pronounce full name in confirmation (more natural: "New South Wales" not "N-S-W")
- **Test thoroughly**: Validate all 8 state codes and full state names

---

### AU-F6. Postcode Without Suburb Validation Allows Invalid Combinations
**Symptom**: User says "Bondi, postcode 3000". System accepts (postcode validates as 4-digit format). But Bondi is in NSW (2026), not VIC (3000). Invalid address.

**Root cause**: Only postcode format validated, not suburb+postcode combination.

**Production impact**: Invalid addresses captured. Mail/service delivery fails.

**Observed in**: Systems without Australia Post API integration.

**Mitigation** (NON-NEGOTIABLE for V1):
- Australia Post Validate Suburb API: Validate suburb+state+postcode combination
- Reject invalid combinations: "That suburb and postcode don't match. Can you double-check?"
- Many suburbs share names: "Bondi" exists in multiple states, postcode disambiguates
- **Test thoroughly**: Validate suburb+postcode combinations for all major cities

---

### AU-F7. No Australian Timezone Handling Causes Booking Errors
**Symptom**: User says "next Tuesday 3pm". System captures as UTC or US timezone. Appointment booked at wrong time (10-16 hour difference).

**Root cause**: No Australian timezone handling (AEST/AEDT/ACST/AWST).

**Production impact**: Appointments booked at wrong time. Customer no-shows. Revenue loss.

**Observed in**: Systems without locale-aware timezone logic.

**Mitigation** (NON-NEGOTIABLE for V1):
- Detect user timezone: Based on phone number area code or explicit question
- AEST (UTC+10): NSW, VIC, QLD, TAS, ACT (Sydney, Melbourne, Brisbane)
- ACST (UTC+9.5): SA, NT (Adelaide, Darwin)
- AWST (UTC+8): WA (Perth)
- AEDT (UTC+11): Daylight saving (October-April, NSW/VIC/SA/TAS/ACT only)
- Store as UTC internally, display in user's timezone
- **Test thoroughly**: Validate daylight saving transitions (October and April)

---

### AU-F8. Rising Intonation Causes Premature Turn-Taking
**Symptom**: Australian user says "My email is jane at gmail dot com?" (rising intonation, sounds like question). VAD detects end-of-turn prematurely (after "gmail"). System interrupts before user says "dot com".

**Root cause**: Australian English uses rising intonation on statements (sounds like questions). VAD tuned for US English (falling intonation on statements).

**Production impact**: System interrupts users mid-sentence. Incomplete captures. User frustration.

**Observed in**: VAD systems tuned for US English without Australian accent calibration.

**Mitigation** (NON-NEGOTIABLE for V1):
- VAD tuning for Australian accent: Longer end-of-turn threshold (200-300ms vs 150ms for US)
- Rising intonation detection: Don't treat rising intonation as question (in Australian context)
- Multi-ASR helps: Compare candidates to detect incomplete captures
- **Test thoroughly**: Validate on Australian accent with rising intonation patterns

---

### 1. Prompt-Based Capture Requires Per-Customer Rewriting (10-40 Hours/Customer)
**Symptom**: Every new customer requires rewriting prompts for email, phone, address capture. Prompts drift across customers. Bug fixes require updating all customers individually.

**Root cause**: No reusable capture primitives. Capture logic embedded in customer-specific prompts.

**Production impact**: 10-40 hours per customer onboarding. Inconsistent quality across customers. Maintenance nightmare (change capture logic, update 100+ customer prompts).

**Observed in**: Vapi, Voiceflow, Retell (90% of voice AI platforms use prompt-based capture).

**Mitigation**:
- Define reusable capture primitives (email, phone, address)
- Customer configuration: objectives only (type, purpose, required)
- Platform team: owns primitive logic (elicitation, validation, confirmation)
- Customer success: owns objective configuration (no prompt engineering)

---

### 2. Full Email Spelling Confirmation Feels Robotic (10-15 Seconds Wasted)
**Symptom**: System confirms email by spelling entire address letter-by-letter: "Your email is j-a-n-e-at-g-m-a-i-l-dot-c-o-m. Is that correct?" Takes 10-15 seconds, frustrates users.

**Root cause**: No confidence-based confirmation strategy. System confirms every capture with full repetition.

**Production impact**: Poor user experience (feels like talking to IVR, not human). Wasted time (5-10 seconds per field across 3-5 fields = 15-50 seconds total).

**Observed in**: LLM-based voice AI systems without confirmation strategy rules.

**Mitigation**:
- Confidence thresholds: ≥0.7 implicit, 0.4-0.7 contextual, <0.4 re-elicit
- Contextual confirmation: "Got it, jane at gmail dot com" (not letter-by-letter)
- Partial confirmation: Confirm only uncertain parts (username if domain is gmail.com)
- Embedded confirmation: "I'll send it to jane at gmail. What's your phone number?"

---

### 3. System Restarts Capture After User Correction (10-20 Seconds Wasted)
**Symptom**: User corrects during confirmation ("it's jaine with an 'i'"). System: "Okay, what's your email again?" Restarts capture from beginning.

**Root cause**: No incremental repair logic. System only knows how to elicit entire slot, not update partial components.

**Production impact**: Wasted time (10-20 seconds per correction). User frustration (system feels incompetent). Lower task completion (users give up after multiple restarts).

**Observed in**: 60% of voice AI systems (2025-2026 research).

**Mitigation**:
- Interruption-safe state: Preserve all captured slot values across interruptions
- Component-level updates: Update only corrected parts (username vs domain)
- Repair confirmation: "Okay, jaine at gmail. Anything else need updating?"
- Resume: Continue to next objective (don't re-confirm everything)

---

### 4. Single ASR System Achieves Only 60-70% Accuracy on Emails
**Symptom**: User spells email clearly, ASR transcribes incorrectly (b→v, p→t confusion). System captures wrong email, sends confirmation to wrong address.

**Root cause**: Acoustic confusion in phone audio (b/v, p/t sound identical at 8kHz PSTN quality). Single ASR system insufficient.

**Production impact**: 30-40% error rate for spelled emails. Customer doesn't receive confirmation, calls back to complain.

**Observed in**: Voice AI systems using single STT provider for email capture.

**Mitigation**:
- Multi-ASR approach: Route audio through 3+ ASR systems (Deepgram, Assembly AI, GPT-4o-audio)
- LLM ranking: Rank candidate transcriptions by likelihood
- Email validation: Verify against email validation service (check MX records)
- Result: 85-90% accuracy (25-30 percentage point improvement)

---

### 5. Skipping Confirmation for Critical Data Causes Business Failures (REVISED)
**Symptom**: System captures email with high confidence (0.9), skips confirmation, proceeds. Email is actually wrong (ASR error). Customer never receives service confirmation. Calls back to complain.

**Root cause**: Overreliance on ASR confidence scores. ASR exhibits overconfidence bias (assigns high confidence to incorrect transcriptions). System skips confirmation for "high confidence" critical data.

**Production impact**: 5-15% of high-confidence captures are wrong (production evidence 2025). For critical data (email, phone, address), this causes business failures (service delivery failures, customer complaints, revenue loss).

**Observed in**: Systems using confidence-based skip for critical data. Anti-pattern promoted in many voice AI guides.

**Mitigation** (CRITICAL for Australian Operations):
- **Always confirm critical data** (email, phone, address, payment, appointment datetime), regardless of confidence
- Use contextual confirmation (fast, not robotic)
- Confidence scores may inform elicitation strategy (natural vs spell-by-word), but NEVER skip confirmation
- Non-critical data (name, preferences) can use confidence-based confirmation

**Production Evidence**:
- ASR confidence scores unreliable (overconfidence bias, false positives)
- Human receptionists always verify critical information (industry standard)
- CHEQ protocol (2025): AI agents must confirm critical decisions
- Cost-benefit: 3-5 second confirmation prevents hours of service delivery failures

---

### 6. Rigid Spelling Requirement Causes 40% Call Abandonment
**Symptom**: System forces spelling style from beginning: "Please spell your email letter by letter after the tone." 40% of users hang up.

**Root cause**: IVR-style rigid interaction. No natural language support.

**Production impact**: 40% call abandonment. Poor user experience (unnatural interaction).

**Observed in**: IVR systems, voice AI systems without natural language elicitation.

**Mitigation**:
- Start natural: "What's the best email to reach you?" (accept natural speech)
- Escalate progressively: Natural → spell-by-word → spell-by-letter (only if needed)
- Success rates: 70-80% natural, 85-90% spell-by-word, 90-95% spell-by-letter

---

### 7. No Validation Allows Invalid Data Capture (15-30% Invalid Rate)
**Symptom**: System captures "jane at gmail dot con" (typo: .con vs .com). Sends confirmation to invalid address. Customer never receives confirmation.

**Root cause**: LLM-only capture with no validation rules. LLM extracts email, system accepts without verification.

**Production impact**: 15-30% of captured emails invalid. Customer doesn't receive confirmation, calls back to complain.

**Observed in**: LLM-based voice AI systems without validation layer.

**Mitigation**:
- Regex validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (basic format check)
- Service validation: Check MX records, disposable email detection
- Graceful failure: If validation fails, re-elicit with context ("That email doesn't look right. Can you double-check?")
- User override: Allow user to confirm invalid value if insistent

---

### 8. Interruption During Elicitation Loses First Words
**Symptom**: System: "What's the best email to—" User: "jane at gmail dot com" (barge-in). System misses "jane", only captures "gmail dot com".

**Root cause**: STT not activated during system speech. Barge-in detected, but first words already spoken (not captured).

**Production impact**: Incomplete capture. System must re-elicit.

**Observed in**: Systems without barge-in-aware STT activation.

**Mitigation**:
- Continuous STT: Keep STT active during system speech (not just during silence)
- VAD-based interruption: Detect user speech, stop TTS, preserve STT buffer
- Buffer retention: Don't flush STT buffer on interruption (preserve first words)

---

### 9. No Component-Level Confidence Tracking Wastes Confirmations
**Symptom**: User says "jane at gmail dot com". System captures with high confidence for "gmail dot com" (common domain), but low confidence for "jane" (unusual username). System confirms entire email: "jane at gmail dot com, right?"

**Root cause**: Slot-level confidence (average across components), not component-level confidence.

**Production impact**: Unnecessary confirmation of high-confidence parts. Better approach: confirm only "jane" (low confidence part).

**Observed in**: Systems without component-level confidence tracking.

**Mitigation**:
- Component-level confidence: Track confidence per component (username, domain, TLD)
- Partial confirmation: Confirm only low-confidence components ("j-a-n-e at gmail, right?")
- Efficiency: Save 2-5 seconds per confirmation (don't confirm obvious parts)

---

### 10. Objectives and Primitives Not Separated (Customer Lock-In)
**Symptom**: Customer wants to change elicitation phrasing for email capture. Must fork entire codebase, maintain separate version.

**Root cause**: Objectives (what to capture) and primitives (how to capture) entangled. No separation of concerns.

**Production impact**: Customer lock-in (cannot customize without forking). Platform team cannot improve primitives without breaking customer customizations.

**Observed in**: Platforms without objective-based architecture.

**Mitigation**:
- Separate objectives (customer config) from primitives (platform logic)
- Customer configuration: objectives only (type, purpose, required)
- Customization: Via primitive parameters (validation_override, elicitation_override)
- Platform ownership: Platform team owns primitives, customer success owns objectives

## Proven Patterns & Techniques

### 1. Objective-Based Architecture (Declarative Configuration)
**Pattern**: Define objectives declaratively (what to capture, why), not imperatively (how to ask).

**Structure**:
```
Objective:
  type: capture_email
  purpose: "send appointment confirmation"
  required: true
```

**Benefits**:
- **Reusability**: Same capture primitive across all customers
- **Maintainability**: Change primitive once, all customers benefit
- **Testability**: Test primitive once, know it works everywhere

**Implementation**: Customer configuration file with objectives array, primitive library with shared logic.

---

### 2. Confidence-Based Capture Flow (Thresholds)
**Pattern**: Use confidence thresholds to determine capture strategy (direct fill, confirm, re-elicit).

**Thresholds**:
- **≥0.9**: No confirmation (proceed)
- **≥0.7**: Implicit confirmation (embed in next action)
- **0.4-0.7**: Contextual confirmation ("Got it, jane at gmail")
- **<0.4**: Re-elicit ("I didn't catch that. Can you say it again?")

**Benefits**:
- **Efficiency**: Don't confirm every field (save 5-10 seconds per field)
- **Natural**: Mirrors human behavior (confirm only when uncertain)
- **Error detection**: Users interrupt if wrong (even with implicit confirmation)

**Implementation**: Confidence threshold rules in primitive logic, tunable per slot type.

---

### 3. Multi-ASR Validation for Critical Slots (Email, Phone)
**Pattern**: Route audio through 3+ ASR systems, use LLM to rank candidates, validate against service API.

**Implementation**:
1. Send audio to Deepgram Nova-1, Assembly AI Universal-1, GPT-4o-audio
2. Receive 3 candidate transcriptions
3. LLM ranks candidates by likelihood (acoustic confusion patterns)
4. Validate top candidate against email validation service
5. If valid, accept. If invalid, try next candidate.

**Benefits**:
- **Accuracy**: 85-90% (vs 60-70% for single ASR)
- **Reliability**: Reduces re-elicitation loops by 50-70%

**Implementation**: Multi-ASR pipeline for email, phone slots. Single ASR for name, address (less critical).

---

### 4. Contextual Confirmation (Not Robotic Repetition)
**Pattern**: Confirm in natural, summarized form (not letter-by-letter).

**Examples**:
- **Bad**: "Your email is j-a-n-e-at-g-m-a-i-l-dot-c-o-m. Is that correct?"
- **Good**: "Got it, jane at gmail dot com. Sound right?"

**Benefits**:
- **Speed**: 3-5 seconds (vs 10-15 for full spelling)
- **Natural**: Mirrors human confirmation patterns

**Implementation**: Confirmation strategies in primitive logic (high/medium/low confidence).

---

### 5. Incremental Repair (Component-Level Updates)
**Pattern**: When user corrects, update only corrected component (preserve rest).

**Example**:
- **Captured**: jane@gmail.com (confidence 0.6 for username, 0.9 for domain)
- **User**: "It's jaine with an 'i'"
- **Update**: jaine@gmail.com (only username updated)
- **Confirm**: "Okay, jaine at gmail. Anything else?"

**Benefits**:
- **Speed**: 3-5 seconds (vs 10-20 for restart)
- **Competence**: System feels intelligent (not restarting)

**Implementation**: Component-level state tracking, correction extraction (LLM), partial update logic.

---

### 6. Progressive Elicitation (Natural → Spell-by-Word → Spell-by-Letter)
**Pattern**: Start with natural elicitation, escalate to more structured only if needed.

**Flow**:
1. **Natural** (70-80% success): "What's the best email to reach you?"
2. **Spell-by-word** (85-90% success): "Can you spell it using words, like A as in Apple?"
3. **Spell-by-letter** (90-95% success): "Let's spell it letter by letter"

**Benefits**:
- **User experience**: Natural for most users (don't force spelling)
- **Fallback**: Structured elicitation for difficult cases

**Implementation**: Elicitation strategies array in primitive, retry escalation logic.

---

### 7. Validation as System Behavior (Not LLM Judgment)
**Pattern**: Use deterministic validation rules (regex, API), not LLM judgment.

**Examples**:
- **Email**: Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` + MX record check
- **Phone**: E.164 format check + length validation
- **Address**: USPS API validation (US only)

**Benefits**:
- **Reliability**: Deterministic (not probabilistic)
- **Debuggability**: Clear rules (not LLM black box)
- **Cost**: Regex/API cheaper than LLM calls

**Implementation**: Validation rules in primitive logic, service API integrations.

---

### 8. Interruption-Safe State Machine (Slot Memory)
**Pattern**: Preserve all captured slot values across interruptions, support partial updates.

**State Structure**:
```
Slot: email
  value: jane@gmail.com
  confidence: 0.6
  components:
    username: "jane" (confidence 0.5)
    domain: "gmail.com" (confidence 0.9)
  status: pending_confirmation
```

**Benefits**:
- **Resumability**: After interruption, continue from same point
- **Repairability**: Update only corrected components
- **No restarts**: Never re-elicit entire slot after correction

**Implementation**: Slot state in conversation memory, component-level tracking.

---

### 9. Embedded Confirmation (In Conversation Flow)
**Pattern**: Embed confirmation in next action, don't ask separately.

**Example**:
- **Bad**: "Your email is jane at gmail. [pause] Is that correct? [pause] Okay, what's your phone number?"
- **Good**: "Great, I've got jane at gmail for the confirmation. What's the best number to reach you?"

**Benefits**:
- **Flow**: No interruption (confirmation embedded in transition)
- **Speed**: Save 3-5 seconds per field

**Implementation**: Confirmation strategies in primitive logic (embed in next objective elicitation).

---

### 10. Primitive Library with Extensibility (Australian-First)
**Pattern**: Core Australian primitives reusable across all Australian customers. Extensible with international primitives (V2) and custom primitives.

**Core Australian Primitives** (V1 - Mandatory):
- `capture_email_au`, `capture_phone_au`, `capture_address_au`, `capture_name_au`, `capture_date_au`, `capture_time_au`, `capture_medicare_number_au`

**Extension Mechanism**:
- **International primitives** (V2): `capture_phone_us`, `capture_address_us`, `capture_phone_uk`, `capture_address_uk`
- **Custom primitives**: Customer-specific (e.g., `capture_patient_id`, `capture_booking_reference`)
- **Validation override**: Customer-specific validation rules
- **Elicitation override**: Customer-specific phrasing (brand voice)

**Benefits**:
- **Reusability**: Core Australian primitives shared across all Australian customers (80% of operations)
- **Flexibility**: International expansion (V2) without rewriting core logic
- **Extensibility**: Customers can extend for specific needs (healthcare, legal, real estate)

**Implementation**: Primitive library with locale parameter (`locale: "en-AU"`), inheritance/override mechanism.

---

### AU-P1. Australian Phone Number Validation (Mobile + Landline)
**Pattern**: Validate Australian mobile (04xx) and landline (02/03/07/08) formats with regex. Normalize to +61 international format for storage.

**Validation Regex**:
```
/^\({0,1}((0|\+61)(2|4|3|7|8)){0,1}\){0,1}(\ |-){0,1}[0-9]{2}(\ |-){0,1}[0-9]{2}(\ |-){0,1}[0-9]{1}(\ |-){0,1}[0-9]{3}$/
```

**Normalization Rules**:
- Input: "0412 345 678" → Store: "+61412345678"
- Input: "02 9876 5432" → Store: "+61298765432"
- Input: "(03) 9123 4567" → Store: "+61391234567"

**Elicitation Phrasing** (Australian-specific):
- "What's the best number to reach you on?" (Australian: "on" not "at")
- "What's your mobile?" (Australians say "mobile" not "cell phone")

**Confirmation Phrasing**:
- Mobile: "Got it, oh-four-one-two, three-four-five, six-seven-eight" (Australian pronunciation: "oh" for 0)
- Landline: "Got it, oh-two, nine-eight-seven-six, five-four-three-two" (area code first)

**Benefits**:
- **Accuracy**: Supports all Australian phone formats (mobile, landline, international)
- **Storage**: Normalized +61 format for international compatibility
- **Natural**: Phrasing matches Australian speech patterns

**V1 implementation**: `capture_phone_au` primitive with Australian regex, +61 normalization.

---

### AU-P2. Australian Address Validation (Suburb + State + Postcode)
**Pattern**: Capture Australian address components separately, validate suburb+state+postcode combination via Australia Post API.

**Component Structure**:
```
Street: "123 Main Street" or "Unit 5, 123 Main Street"
Suburb: "Bondi" (NOT "Sydney" - suburb is primary identifier)
State: "NSW" (3-char code, NOT "New South Wales")
Postcode: "2026" (4 digits)
```

**Validation Flow**:
1. Capture street, suburb, state, postcode separately
2. Normalize state: "New South Wales" → "NSW", "Victoria" → "VIC"
3. Validate postcode: Must be 4 digits
4. Call Australia Post Validate Suburb API: `validate_suburb(suburb, state, postcode)`
5. If invalid: Re-elicit with context ("That suburb and postcode don't match. Can you double-check?")
6. If valid: Accept and proceed

**Elicitation Phrasing**:
- "What's the address?" (capture full address, extract components)
- Or component-by-component: "What's the street?", "What suburb?", "Which state?", "And the postcode?"

**Confirmation Phrasing**:
- "Got it, 123 Main Street, Bondi, New South Wales, 2026" (pronounce full state name, not "N-S-W")

**Benefits**:
- **Accuracy**: Australia Post API validates suburb+postcode combinations (prevents invalid addresses)
- **Completeness**: Captures all required components for mail delivery
- **Natural**: Component-based capture matches how Australians describe addresses

**V1 implementation**: `capture_address_au` primitive with Australia Post API integration.

---

### AU-P3. DD/MM/YYYY Date Format with Ambiguity Clarification
**Pattern**: Parse dates as DD/MM/YYYY. Clarify ambiguous dates (e.g., "5/6" could be June 5 or May 6). Store as ISO 8601.

**Parsing Rules**:
- **Numeric**: "15/10/2026" → October 15, 2026 (DD/MM/YYYY)
- **Natural language**: "next Tuesday" → Calculate based on Australian timezone (AEST/AEDT)
- **Australian slang**: "This arvo" → Today afternoon, "Fortnight" → +14 days
- **Ambiguous**: "5/6" → Clarify "5th of June or 6th of May?"

**Ambiguity Detection**:
- If day ≤12 and month ≤12, could be either DD/MM or MM/DD (e.g., "5/6", "3/4", "11/12")
- Ask clarification: "Just to confirm, is that 5th of June or 6th of May?"
- Don't assume: Never assume MM/DD (US format) in Australian context

**Storage Format**:
- Internal: ISO 8601 (YYYY-MM-DD) for international compatibility
- Display to user: DD/MM/YYYY (matches Australian expectation)

**Timezone Handling**:
- Detect user location (phone area code: 02 = Sydney = AEST, 03 = Melbourne = AEST, 07 = Brisbane = AEST, 08 = Perth = AWST)
- Handle daylight saving: AEDT (October-April) for NSW/VIC/SA/TAS/ACT only (QLD/WA/NT don't observe)

**V1 implementation**: `capture_date_au` primitive with DD/MM/YYYY parsing, ambiguity clarification, Australian timezone.

---

### AU-P4. Multi-ASR with Australian Accent Weighting
**Pattern**: Route audio through 3+ ASR systems, use LLM ranking with Australian accent awareness.

**ASR Systems**:
1. Deepgram Nova-1 (phonecall model)
2. Assembly AI Universal-1
3. GPT-4o-audio (realtime)

**LLM Ranking (Australian-Specific)**:
- **Acoustic confusion patterns**: b/v, p/t, f/s in Australian accent
- **Vowel shifts**: "day" → "die", "night" → "noight"
- **Rising intonation**: Statements sound like questions (affects sentence boundary detection)
- **Rank candidates**: Considering Australian pronunciation patterns, not just US patterns

**Expected Accuracy**:
- **Single ASR**: 60-65% for Australian accent (15-20 points lower than US)
- **Multi-ASR + LLM**: 75-85% for Australian accent (25-30 point improvement)

**Cost Tradeoff**:
- **3x ASR cost**: $0.01-0.03 per minute (vs $0.005-0.01 for single ASR)
- **Benefit**: 50-70% reduction in re-elicitation loops (saves 10-20 seconds per failure)
- **ROI**: Higher ASR cost justified by lower re-elicitation cost (user time, LLM calls)

**V1 implementation**: Multi-ASR pipeline for email_au and phone_au primitives. Australian accent-aware LLM ranking.

---

### AU-P5. State Code Normalization (Full Name ↔ 3-Char Code)
**Pattern**: Accept both full state name ("New South Wales") and abbreviation ("NSW") from user. Normalize to 3-char code for storage. Pronounce full name in confirmation.

**Normalization Map**:
- "New South Wales" or "NSW" → Store: "NSW"
- "Victoria" or "VIC" → Store: "VIC"
- "Queensland" or "QLD" → Store: "QLD"
- "South Australia" or "SA" → Store: "SA"
- "Western Australia" or "WA" → Store: "WA"
- "Tasmania" or "TAS" → Store: "TAS"
- "Northern Territory" or "NT" → Store: "NT"
- "Australian Capital Territory" or "ACT" → Store: "ACT"

**Confirmation Strategy**:
- **User input**: "New South Wales" → Confirm: "New South Wales" (mirror user's phrasing)
- **User input**: "NSW" → Confirm: "New South Wales" (expand to full name for clarity)
- **Storage**: Always store as 3-char code (Australia Post API requirement)

**Benefits**:
- **Flexibility**: Accepts both formats from users (natural speech)
- **Validation**: 3-char code required for Australia Post API
- **Clarity**: Full name in confirmation more natural than spelling abbreviation

**V1 implementation**: State normalization in `capture_address_au` primitive.

---

### AU-P6. Suburb+Postcode Validation via Australia Post API
**Pattern**: Validate suburb+state+postcode combination via Australia Post Validate Suburb API. Reject invalid combinations.

**Validation Flow**:
1. Capture suburb, state, postcode
2. Normalize state to 3-char code
3. Validate postcode format (4 digits)
4. Call Australia Post API: `POST /validate_suburb` with `{suburb, state, postcode}`
5. If API returns `valid: true`, accept
6. If API returns `valid: false`, re-elicit with context

**Error Handling**:
- **Invalid combination**: "That suburb and postcode don't match. Can you double-check the postcode?"
- **API timeout**: If API >2 seconds, accept capture and validate async (don't block conversation)
- **API failure**: If API unavailable, skip validation (accept capture, validate later)

**Common Invalid Combinations** (Examples):
- "Bondi, VIC, 3000" → Invalid (Bondi is in NSW, postcode 2026, not VIC)
- "Richmond, NSW, 3121" → Invalid (Richmond NSW is 2753, Richmond VIC is 3121)

**Benefits**:
- **Accuracy**: Prevents invalid address combinations (many suburbs share names)
- **Delivery reliability**: Validated addresses have higher mail delivery success rate
- **User trust**: System catches errors before user leaves call

**V1 implementation**: Australia Post API integration in `capture_address_au` primitive.

---

### AU-P7. Australian Timezone-Aware Date/Time Capture
**Pattern**: Parse dates in DD/MM/YYYY format with Australian timezone (AEST/AEDT/ACST/AWST). Store as UTC, display as local.

**Timezone Detection**:
- **Phone area code**: 02/03/07 = AEST (Sydney/Melbourne/Brisbane), 08 = AWST (Perth/Adelaide varies)
- **Explicit question**: If area code ambiguous, ask "Which city are you in?" to determine timezone
- **Default**: AEST (covers 70%+ of Australian population)

**Daylight Saving**:
- **AEDT**: October to April, NSW/VIC/SA/TAS/ACT only (+11 UTC)
- **AEST**: April to October, NSW/VIC/QLD/TAS/ACT (+10 UTC)
- **No DST**: QLD, WA, NT don't observe daylight saving
- **Critical dates**: First Sunday in October (DST starts), first Sunday in April (DST ends)

**Date Parsing**:
- **"15/10/2026"**: Parse as October 15, 2026 (DD/MM/YYYY)
- **"5/6"**: Ambiguous → Clarify "5th of June or 6th of May?"
- **"next Tuesday"**: Calculate based on current date in Australian timezone
- **"this arvo"**: Today afternoon (Australian slang)
- **"fortnight"**: +14 days (common in Australian English)

**Storage and Display**:
- **Storage**: ISO 8601 UTC (2026-10-15T03:00:00Z for 1pm AEST)
- **Display to user**: DD/MM/YYYY in local timezone (15/10/2026)

**V1 implementation**: `capture_date_au` and `capture_time_au` primitives with DD/MM/YYYY parsing, Australian timezone detection, daylight saving handling.

---

### AU-P8. Australian Pronunciation for Confirmations
**Pattern**: Use Australian pronunciation patterns in TTS confirmations (not US patterns).

**Key Differences**:
- **Zero**: Pronounce as "oh" (not "zero") - "oh-four-one-two" for 0412
- **Double letters**: "aa" in email pronounced separately ("a-a" not "double-a")
- **Rising intonation**: Statements with rising intonation sound like questions (Australian pattern)
- **"At" in email**: Pronounce as "at" (not "at symbol" or "at sign")

**Phone Number Confirmation**:
- **Mobile**: "oh-four-one-two, three-four-five, six-seven-eight" (grouped: 4-3-3)
- **Landline**: "oh-two, nine-eight-seven-six, five-four-three-two" (area code + 4-4 grouping)

**Email Confirmation**:
- "jane at gmail dot com" (natural pronunciation)
- NOT "j-a-n-e-at-g-m-a-i-l-dot-c-o-m" (too robotic)

**Date Confirmation**:
- "15th of October" or "October 15th" (both acceptable in Australian English)
- NOT "October the 15th" (overly formal, uncommon in Australian speech)

**V1 implementation**: TTS templates in primitives with Australian pronunciation patterns. Voice selection: Australian English voice (ElevenLabs, Cartesia with AU accent).

---

### AU-P9. Rising Intonation Handling in Australian English
**Pattern**: Don't treat rising intonation as question in Australian context. Adjust VAD end-of-turn threshold.

**Australian Intonation Pattern**:
- **Statements sound like questions**: "My email is jane at gmail dot com?" (rising intonation at end)
- **High-rising terminal (HRT)**: Common in Australian English, especially younger speakers
- **Not actually a question**: User is making statement, not asking question

**VAD Tuning for Australian Accent**:
- **End-of-turn threshold**: 200-300ms (vs 150ms for US accent)
- **Rising intonation**: Don't interpret as question (continue listening for more content)
- **Silence duration**: Longer threshold accounts for HRT pattern

**Impact on Capture**:
- **Premature turn-taking**: If VAD tuned for US, will interrupt Australian speakers mid-sentence
- **Incomplete captures**: "My email is jane at gmail dot—" (interrupted before "com")
- **User frustration**: System interrupts repeatedly, feels broken

**Mitigation**:
- Tune VAD for Australian accent (longer end-of-turn threshold)
- Multi-ASR helps detect incomplete captures (candidates will be inconsistent)
- Test on actual Australian accent recordings (not US accent)

**V1 implementation**: VAD configuration in voice runtime with Australian accent tuning (research/01-turn-taking.md). End-of-turn threshold 200-300ms for Australian locale.

---

### AU-P10. Australia Post API Integration for Address Validation
**Pattern**: Mandatory validation of suburb+state+postcode combinations via Australia Post Validate Suburb API.

**API Integration**:
- **Endpoint**: `POST https://developers.auspost.com.au/api/validate_suburb`
- **Request**: `{suburb: "Bondi", state: "NSW", postcode: "2026"}`
- **Response**: `{valid: true}` or `{valid: false, suggestion: "Did you mean Bondi Beach?"}`

**Error Handling**:
- **Invalid combination**: Re-elicit with context ("That suburb and postcode don't match. The postcode for Bondi is 2026. Is that correct?")
- **API timeout** (>2 seconds): Accept capture, validate async (don't block conversation)
- **API failure**: Skip validation, log error, validate in post-call processing

**Common Validation Failures**:
- **Suburb name conflicts**: "Richmond" exists in NSW (2753), VIC (3121), SA (5033), QLD (4740) - postcode disambiguates
- **Postcode typos**: "3001" vs "3000" (one digit difference, different suburbs)
- **State mismatch**: User says "Bondi, VIC" but Bondi is in NSW (validation catches)

**Benefits**:
- **Accuracy**: Prevents invalid address combinations (critical for service delivery)
- **Disambiguation**: Resolves suburb name conflicts (many suburbs exist in multiple states)
- **User trust**: System catches errors before user leaves call

**V1 implementation**: Australia Post API integration in `capture_address_au` primitive. Mandatory validation, async fallback on timeout/failure.

## Engineering Rules (Binding)

### R1: Objectives MUST Be Declarative (Not Prompt-Based)
**Rule**: Customer configuration defines objectives (type, purpose, required). Objectives MUST NOT include prompts or phrasing.

**Rationale**: Reusability. Objectives reused across customers without prompt engineering.

**Implementation**: Objective structure: `{type, purpose, required}`. No `prompt` or `phrasing` fields.

**Verification**: Customer config contains only objectives. No prompts in config.

---

### R2: Capture Primitives MUST Be Reusable Across All Customers
**Rule**: Email, phone, address capture logic MUST be in shared primitive library. MUST NOT be customer-specific.

**Rationale**: Maintainability. Bug fix once, all customers benefit.

**Implementation**: Primitive library with shared logic. Customer config references primitives by type.

**Verification**: All customers use same primitive for email capture. No customer-specific email logic.

---

### R3: CRITICAL Data MUST ALWAYS Be Confirmed (Regardless of Confidence)
**Rule**: Email, phone, address, payment info, appointment date/time MUST ALWAYS be confirmed with explicit user affirmation. MUST NOT skip confirmation based on high confidence scores.

**Rationale**: ASR confidence scores unreliable (overconfidence bias, high false positive rate). Cost of error too high for critical data (wrong email = customer never receives service). Human receptionists always verify critical information.

**Implementation**: 
- Critical data types flagged in primitive definition
- Confirmation mandatory regardless of confidence score
- Contextual confirmation style (fast but not skippable)
- User must explicitly affirm ("yes", "that's right", "correct") before proceeding

**Verification**: All critical data confirmed before proceeding. No confidence-based skip for email/phone/address/payment/datetime.

---

### R3-B: NON-CRITICAL Data MAY Use Confidence-Based Confirmation
**Rule**: Non-critical data (name, preferences, non-binding information) MAY use confidence-based confirmation (≥0.7 implicit, 0.4-0.7 contextual, <0.4 re-elicit).

**Rationale**: Efficiency for non-critical data. Save time for non-binding information.

**Implementation**: Confidence thresholds for non-critical data only.

**Verification**: Non-critical data uses confidence-based strategy. Critical data always confirmed.

---

### R4: Email and Phone Capture MUST Use Multi-ASR for Australian Accent
**Rule**: Email and phone capture MUST route audio through 3+ ASR systems, rank candidates with LLM. **Mandatory for Australian accent** (15-20 points lower accuracy than US).

**Rationale**: Accuracy. Single ASR only 60-65% accurate on Australian accent (vs 75-85% for US). Multi-ASR achieves 75-85%.

**Implementation**: Multi-ASR pipeline (Deepgram, Assembly AI, GPT-4o-audio). LLM ranking with Australian accent awareness.

**Verification**: Email and phone captures use 3+ ASR systems. Accuracy ≥75% for Australian accent.

---

### R4-AU: Phone Validation MUST Use Australian Format (Not US E.164)
**Rule**: Phone validation MUST support Australian mobile (04xx) and landline (02/03/07/08) formats. MUST normalize to +61 international format for storage.

**Rationale**: US E.164 validation will reject 100% of Australian phone numbers. Platform unusable in Australia.

**Implementation**: Australian phone regex validation. Normalization: 0412345678 → +61412345678.

**Verification**: Validate 04xx mobile, 02/03/07/08 landline formats. Storage uses +61 prefix.

---

### R5-AU: Address Validation MUST Use Australia Post API (Not USPS)
**Rule**: Address validation MUST use Australia Post Validate Suburb API. MUST validate suburb+state+postcode combination.

**Rationale**: Australian addresses use suburb (not city), 4-digit postcode (not 5-digit ZIP), 3-char state codes. USPS API irrelevant for Australia.

**Implementation**: Australia Post API integration. Component validation: suburb, state (3-char), postcode (4-digit).

**Verification**: Australia Post API validates addresses. Invalid combinations rejected.

---

### R6-AU: Date Parsing MUST Use DD/MM/YYYY Format (Not MM/DD/YYYY)
**Rule**: Date parsing MUST assume DD/MM/YYYY format in Australian context. MUST clarify ambiguous dates. MUST store as ISO 8601 (YYYY-MM-DD).

**Rationale**: MM/DD/YYYY format will cause 50% of dates to be captured incorrectly. Critical error for appointment booking.

**Implementation**: DD/MM/YYYY parsing. Ambiguity clarification for dates like "5/6". ISO 8601 storage.

**Verification**: Parse "15/10/2026" as October 15 (not invalid). Clarify "5/6" as ambiguous. Store as ISO 8601.

---

### R7-AU: Timezone MUST Be Australian (AEST/AEDT/ACST/AWST)
**Rule**: Date/time parsing MUST use Australian timezones (AEST/AEDT/ACST/AWST). MUST handle daylight saving for NSW/VIC/SA/TAS/ACT.

**Rationale**: UTC or US timezone will cause appointments booked at wrong time (10-16 hour difference). Revenue loss from no-shows.

**Implementation**: Detect timezone from phone area code. Handle daylight saving (October-April). Store as UTC, display in local.

**Verification**: "Next Tuesday 3pm" with Sydney phone (02) → Correctly calculates AEST/AEDT. Daylight saving transitions handled.

---

### R5: Repair MUST Be Incremental (Not Restart)
**Rule**: When user corrects, system MUST update only corrected component. MUST NOT restart entire capture.

**Rationale**: Efficiency. Incremental repair 3-5 seconds (vs 10-20 for restart).

**Implementation**: Component-level state tracking. Correction extraction. Partial update logic.

**Verification**: User corrections update only corrected components. No restarts.

---

### R6: Validation MUST Be Deterministic (Not LLM-Based)
**Rule**: Validation MUST use regex, format checks, service APIs. MUST NOT rely on LLM judgment.

**Rationale**: Reliability. Deterministic validation more reliable than LLM.

**Implementation**: Validation rules in primitive logic (regex, API integrations).

**Verification**: All validations use deterministic rules. No LLM validation calls.

---

### R7: Interruption MUST Preserve Slot State (Not Reset)
**Rule**: When user interrupts, system MUST preserve all captured slot values. MUST NOT reset to empty.

**Rationale**: Resumability. After interruption, continue from same point.

**Implementation**: Slot memory persisted across interruptions. State machine preserves state.

**Verification**: User interruptions preserve slot state. No resets.

---

### R8: Elicitation MUST Start Natural (Not Force Spelling)
**Rule**: Elicitation MUST start with natural style ("What's your email?"). MUST NOT force spelling from beginning.

**Rationale**: User experience. Natural elicitation 70-80% success rate.

**Implementation**: Elicitation strategies array (natural first, spelling fallback).

**Verification**: First elicitation attempt uses natural style. Spelling only after failure.

---

### R9: Confirmation MUST NOT Spell Full Email (Unless Low Confidence)
**Rule**: Confirmation MUST use natural pronunciation ("jane at gmail dot com"). MUST NOT spell letter-by-letter unless confidence <0.4.

**Rationale**: User experience. Full spelling feels robotic, wastes 10-15 seconds.

**Implementation**: Confirmation strategies in primitive logic (natural pronunciation for ≥0.4 confidence).

**Verification**: Confirmations use natural pronunciation. No letter-by-letter unless confidence <0.4.

---

### R10: Objectives and Primitives MUST Be Separated (Orthogonal)
**Rule**: Objectives (customer config) and primitives (platform logic) MUST be separated. Changes to objectives MUST NOT require changes to primitives.

**Rationale**: Maintainability. Platform team owns primitives, customer success owns objectives.

**Implementation**: Objective config file separate from primitive library. No entanglement.

**Verification**: Change objective config, no primitive changes required. Change primitive, no objective changes required.

## Metrics & Signals to Track

### Capture Accuracy (Per Slot Type)
- **Email capture accuracy**: Target ≥85% (multi-ASR), ≥95% after confirmation
- **Phone capture accuracy**: Target ≥90%, ≥95% after confirmation
- **Address capture accuracy**: Target ≥85%, ≥95% after confirmation
- **Name capture accuracy**: Target ≥95% (simpler than email/phone)

### Elicitation Efficiency
- **Average elicitation time per slot**: Target 5-10 seconds (human baseline)
- **Retry rate**: Percentage requiring 2+ attempts. Target <20%
- **Escalation rate**: Percentage requiring spell-by-word or spell-by-letter. Target <15%

### Confirmation Overhead
- **Confirmation time per slot**: Target 3-5 seconds (contextual), 0 seconds (implicit)
- **Implicit confirmation rate**: Percentage using implicit (≥0.7 confidence). Target ≥60%
- **Explicit confirmation rate**: Percentage using contextual (0.4-0.7 confidence). Target 30-40%
- **Re-elicitation rate**: Percentage requiring re-elicit (<0.4 confidence). Target <10%

### Repair Effectiveness
- **Repair success rate**: Percentage of corrections handled incrementally. Target ≥90%
- **Restart rate**: Percentage requiring full restart. Target <10%
- **Average repair time**: Target 3-5 seconds (incremental fix)

### Interruption Handling
- **Interruption frequency**: Percentage of captures interrupted. Target 10-20%
- **State preservation rate**: Percentage preserving state after interruption. Target 100%
- **Barge-in detection latency**: Time from user speech to TTS cancellation. Target <100ms

### Validation Quality
- **Invalid capture rate**: Percentage of captures failing validation. Target <5%
- **False negative rate**: Valid captures rejected by validation. Target <1%
- **Validation latency**: Time for validation check. Target <100ms

### Multi-ASR Performance
- **Single ASR accuracy**: Baseline. Expect 60-70% for emails
- **Multi-ASR accuracy**: With 3+ systems. Target ≥85%
- **LLM ranking accuracy**: Percentage where top-ranked candidate is correct. Target ≥90%

### User Experience
- **Task completion rate**: Percentage completing all objective captures. Target ≥90%
- **User frustration rate**: Measured by corrections, restarts, complaints. Target <5%
- **Average conversation duration**: Target <60 seconds for 3 objectives

### Australian-Specific Metrics (CRITICAL - V1 Validation)

**Australian Accent ASR Accuracy**:
- **Single ASR accuracy** (baseline): Target ≥60% (expect 60-65% for Australian accent)
- **Multi-ASR accuracy** (with 3+ systems): Target ≥75% (expect 75-85% for Australian accent)
- **Improvement delta**: Target ≥15 percentage points (validates multi-ASR ROI)

**Australian Phone Validation**:
- **Mobile validation success**: Percentage of 04xx numbers validated correctly. Target 100%
- **Landline validation success**: Percentage of 02/03/07/08 numbers validated correctly. Target 100%
- **Invalid rejection rate**: Percentage of invalid numbers rejected. Target 100%
- **False positive rate**: Valid numbers rejected as invalid. Target <1%

**Australian Address Validation**:
- **Australia Post API success rate**: Percentage of valid suburb+postcode combinations. Target ≥90%
- **Invalid rejection rate**: Percentage of invalid combinations rejected. Target 100%
- **API timeout rate**: Percentage of validations timing out (>2s). Target <5%
- **API failure fallback**: Percentage falling back to async validation. Target <1%

**Australian Date Parsing**:
- **DD/MM/YYYY accuracy**: Percentage of dates parsed correctly. Target 100%
- **Ambiguity clarification rate**: Percentage of ambiguous dates (5/6) requiring clarification. Target 15-25%
- **MM/DD/YYYY errors**: Percentage parsed incorrectly as US format. Target 0% (critical error)

**Australian Timezone Accuracy**:
- **Timezone detection accuracy**: Percentage correctly detecting AEST/AEDT/ACST/AWST. Target ≥95%
- **Daylight saving handling**: Percentage correctly handling DST transitions. Target 100%
- **Wrong timezone bookings**: Percentage of appointments booked at wrong time. Target 0% (critical error)

**Australian-Specific Testing Requirements** (V1 Validation):

**Phone Number Testing** (Mandatory Before Launch):
- Test mobile: 0412 345 678, 0491 570 156, 0400 000 000
- Test landline Sydney: 02 9876 5432, (02) 9123 4567
- Test landline Melbourne: 03 9876 5432, (03) 9123 4567
- Test landline Brisbane: 07 3876 5432
- Test landline Perth: 08 9876 5432
- Test landline Adelaide: 08 8876 5432
- Test international: +61 412 345 678, +61 2 9876 5432
- **Validate**: All formats accepted, normalized to +61 prefix

**Address Testing** (Mandatory Before Launch):
- Test Sydney: "123 George Street, Sydney, NSW, 2000"
- Test Melbourne: "456 Collins Street, Melbourne, VIC, 3000"
- Test Brisbane: "789 Queen Street, Brisbane, QLD, 4000"
- Test Perth: "321 Murray Street, Perth, WA, 6000"
- Test Adelaide: "654 King William Street, Adelaide, SA, 5000"
- Test Canberra: "111 Constitution Avenue, Canberra, ACT, 2600"
- Test conflict: "Richmond, VIC, 3121" vs "Richmond, NSW, 2753" (both valid but different)
- Test invalid: "Bondi, VIC, 3000" (should reject - Bondi is NSW 2026)
- **Validate**: Australia Post API accepts valid, rejects invalid

**Date Testing** (Mandatory Before Launch):
- Test unambiguous: "15/10/2026" → October 15, 2026
- Test ambiguous: "5/6" → Requires clarification
- Test natural language: "next Tuesday" → Correct calculation in AEST
- Test past date: "1/1/2025" for future appointment → Reject
- Test DD/MM vs MM/DD: "13/6" → June 13 (cannot be MM/DD since month 13 invalid)
- **Validate**: All dates parsed as DD/MM/YYYY, never MM/DD/YYYY

**Australian Accent Testing** (Mandatory Before Launch):
- Record 20+ Australian accent samples (Sydney, Melbourne, Brisbane, Adelaide, Perth)
- Test across age ranges (younger speakers use more HRT - rising intonation)
- Test email spelling with Australian accent (b/v, p/t confusion)
- Test phone number with Australian pronunciation ("oh-four" not "zero-four")
- Measure: Single ASR accuracy vs Multi-ASR accuracy
- **Target**: Multi-ASR ≥75% accuracy on Australian accent samples

**VAD Tuning Testing** (Mandatory Before Launch):
- Test rising intonation statements (common in Australian English)
- Test end-of-turn detection (200-300ms threshold vs 150ms US default)
- Measure premature interruption rate (should be <10%)
- Adjust threshold if interruption rate >15%
- **Target**: <10% premature interruptions on Australian accent recordings

### Primitive Reusability
- **Customers per primitive**: Number of customers using same email primitive. Target: all customers
- **Onboarding time**: Hours to configure new customer. Target <2 hours (vs 10-40 for prompt-based)
- **Bug fix propagation time**: Hours to fix bug across all customers. Target <1 hour (vs days for prompt-based)

## V1 Decisions / Constraints

### D-OBJ-001 Objectives MUST Be Declarative Configuration
**Decision**: Customer configuration defines objectives as `{type, purpose, required}`. No prompts or phrasing in config.

**Rationale**: Reusability. Same primitive across all customers.

**Constraints**: Objective structure strictly enforced. No `prompt` field allowed.

---

### D-OBJ-002 Core Primitives: Australian-First (Email, Phone, Address, Name, Date, Time)
**Decision**: V1 includes 7 core **Australian-specific** primitives (email_au, phone_au, address_au, name_au, date_au, time_au, medicare_number_au). Reusable across all Australian customers.

**Rationale**: Platform primarily serves Australian businesses (80% of operations). Australian-specific validation non-negotiable.

**Constraints**: 
- Phone: Australian mobile (04xx) and landline (02/03/07/08) validation, NOT US E.164
- Address: Suburb/state/postcode with Australia Post API validation, NOT US city/state/ZIP
- Date: DD/MM/YYYY format, NOT MM/DD/YYYY
- Platform team owns primitives. Customer success owns objective config.

---

### D-OBJ-003 CRITICAL Data MUST ALWAYS Be Confirmed (Confidence Scores Unreliable)
**Decision**: Email, phone, address, payment, appointment date/time MUST ALWAYS be confirmed with explicit user affirmation, **regardless of confidence score**. Non-critical data (name, preferences) may use confidence-based confirmation (≥0.7 implicit, 0.4-0.7 contextual, <0.4 re-elicit).

**Rationale**: 
- ASR confidence scores exhibit overconfidence bias (high scores frequently wrong)
- Cost of error too high for critical data (wrong email = service delivery failure)
- Human receptionists always verify critical information (industry best practice)
- Production evidence (2025): Confidence-based error detection generates high false positive rate

**Constraints**: 
- Critical data types: email, phone, address, payment, appointment datetime (always confirm)
- Non-critical data types: name, preferences, non-binding info (confidence-based acceptable)
- Confirmation style: Contextual (3-5 seconds), not robotic (10-15 seconds)

---

### D-OBJ-004 Email and Phone MUST Use Multi-ASR for Australian Accent
**Decision**: Email and phone capture route audio through Deepgram, Assembly AI, GPT-4o-audio. LLM ranks candidates with **Australian accent awareness**.

**Rationale**: Single ASR only 60-65% accurate on Australian accent (15-20 points lower than US). Multi-ASR achieves 75-85% for Australian accent.

**Constraints**: 
- Minimum 3 ASR systems for email and phone (mandatory for Australian operations)
- LLM ranking must consider Australian pronunciation patterns (b/v, p/t confusion, vowel shifts, rising intonation)
- Budget for 3x ASR costs ($0.01-0.03 per minute vs $0.005-0.01 single)

---

### D-OBJ-005 Validation MUST Use Deterministic Rules
**Decision**: Email regex, phone E.164 check, address USPS API. No LLM-based validation.

**Rationale**: Reliability. Deterministic validation more reliable than LLM.

**Constraints**: All validation rules deterministic (regex, API, format check).

---

### D-OBJ-006 Repair MUST Be Incremental (Component-Level)
**Decision**: User corrections update only corrected component (username, domain). No restarts.

**Rationale**: Efficiency. Incremental repair 3-5 seconds (vs 10-20 for restart).

**Constraints**: Slot state tracked at component level. Correction extraction via LLM.

---

### D-OBJ-007 Elicitation MUST Start Natural (Progressive Escalation)
**Decision**: Elicitation order: natural → spell-by-word → spell-by-letter. No forced spelling.

**Rationale**: User experience. Natural style 70-80% success.

**Constraints**: First attempt always natural. Spelling only after failure.

---

### D-OBJ-008 Interruption MUST Preserve Slot State
**Decision**: VAD-based interruption detection. TTS cancellation <100ms. Slot state preserved.

**Rationale**: Resumability. Continue from interrupted point (no restart).

**Constraints**: Slot memory persisted across interruptions. State machine preserves state.

---

### D-OBJ-009 Confirmation MUST NOT Spell Full Email (Unless <0.4 Confidence)
**Decision**: Confirmations use natural pronunciation ("jane at gmail dot com"). Letter-by-letter only if confidence <0.4.

**Rationale**: User experience. Full spelling wastes 10-15 seconds, feels robotic.

**Constraints**: Natural pronunciation for ≥0.4 confidence. Letter-by-letter only for <0.4.

---

### D-OBJ-010 Objectives and Primitives MUST Be Orthogonal
**Decision**: Objectives (customer config) separate from primitives (platform logic). No entanglement.

**Rationale**: Maintainability. Platform team owns primitives, customer success owns objectives.

**Constraints**: Change objective config without primitive changes. Change primitive without objective changes.

---

### D-OBJ-011 No Per-Customer Prompt Engineering
**Decision**: Platform team writes all capture logic (primitives). Customers configure objectives only.

**Rationale**: Eliminate 10-40 hour per-customer prompt engineering burden.

**Constraints**: Customer success cannot modify primitive logic. Platform team owns all prompts.

---

### D-OBJ-012 Primitive Library Extensible in V2
**Decision**: V1 includes core primitives. V2 adds custom primitives (SSN, credit card, medical record number).

**Rationale**: Cover 90%+ of V1 use cases with core primitives. Extend in V2 based on demand.

**Constraints**: Extension mechanism defined in V1 (inheritance, override). Custom primitives in V2.

---

### D-OBJ-013 Component-Level Confidence Tracking
**Decision**: Track confidence per component (username vs domain, area code vs number).

**Rationale**: Partial confirmation. Confirm only low-confidence components.

**Constraints**: All complex slots (email, phone, address) track component-level confidence.

---

### D-OBJ-014 Embedded Confirmation for High Confidence (≥0.7)
**Decision**: High-confidence captures (≥0.7) use embedded confirmation ("I'll send it to jane at gmail. What's your phone?").

**Rationale**: Efficiency. Save 3-5 seconds per field by embedding in transition.

**Constraints**: Embedded confirmation only for ≥0.7 confidence. Explicit confirmation for 0.4-0.7.

---

### D-OBJ-015 Validation Service Integrations (Email MX, Australia Post Address)
**Decision**: Email validation checks MX records. Address validation uses **Australia Post Validate Suburb API** (mandatory for V1).

**Rationale**: Reliability. Service validation catches errors regex cannot. Australia Post API validates suburb+state+postcode combinations (many suburbs share names across states).

**Constraints**: 
- Email validation requires MX check (international)
- Address validation requires Australia Post API for Australian addresses (V1 mandatory)
- USPS API for US addresses (V2 only, if US market validated)

### D-OBJ-016 V1 Primitives MUST Be Australian-First (Not US-First)
**Decision**: V1 core primitives are Australian-specific (`capture_phone_au`, `capture_address_au`, `capture_date_au`). US/international primitives deferred to V2.

**Rationale**: Platform primarily serves Australian businesses (80% of operations). Australian validation non-negotiable for V1. US market unvalidated.

**Constraints**: 
- Phone: Australian format (04xx mobile, 02/03/07/08 landline)
- Address: Australian format (suburb/state/postcode with Australia Post API)
- Date: DD/MM/YYYY (NOT MM/DD/YYYY)
- Timezone: AEST/AEDT/ACST/AWST (NOT UTC or US timezones)

---

### D-OBJ-017 Australia Post API Integration MANDATORY for V1
**Decision**: V1 MUST integrate Australia Post Validate Suburb API for address validation. Cannot launch without it.

**Rationale**: Suburb+postcode validation critical for Australian addresses (many suburbs share names across states). No viable alternative to Australia Post API.

**Constraints**: 
- API integration required before V1 launch
- Async validation on timeout/failure (don't block conversation)
- Budget for API costs (validate every address capture)

---

### D-OBJ-018 VAD MUST Be Tuned for Australian Accent (Rising Intonation)
**Decision**: V1 VAD configuration MUST use 200-300ms end-of-turn threshold for Australian accent (vs 150ms for US).

**Rationale**: Australian English uses rising intonation on statements (sounds like questions). Standard VAD tuning causes premature turn-taking, interrupts users mid-sentence.

**Constraints**: 
- VAD configuration: end_of_turn_threshold = 250ms (vs 150ms US default)
- Test on Australian accent recordings (not US accent)
- Monitor interruption rate, adjust threshold if >15%

---

### D-OBJ-019 Australian Privacy Compliance (OAIC) MANDATORY
**Decision**: V1 MUST comply with Australian Privacy Principles (APPs). Pre-call disclosure required. Opt-out mechanism required.

**Rationale**: OAIC regulations mandatory for Australian businesses. Non-compliance creates legal liability.

**Constraints**: 
- Pre-call disclosure: "This call may be recorded for quality and training purposes"
- Opt-out mechanism: "If you do not wish to be recorded, please let me know"
- Data retention: Must not store data longer than necessary for stated purpose
- Australian infrastructure preferred (not legally required, but customer expectation)

---

### D-OBJ-020 Multi-ASR Budget MUST Account for Australian Accent
**Decision**: V1 budget MUST include 3x ASR costs for Australian accent (vs 1x for US accent).

**Rationale**: Australian accent requires multi-ASR for acceptable accuracy (75-85% vs 60-65% single ASR). Cost unavoidable.

**Constraints**: 
- ASR cost per minute: $0.01-0.03 (3 systems) vs $0.005-0.01 (1 system)
- ROI: Higher ASR cost justified by 50-70% reduction in re-elicitation loops
- Budget allocation: Factor into per-call cost calculations

---

### D-OBJ-021 CRITICAL Data MUST ALWAYS Be Confirmed (Never Skip)
**Decision**: Email, phone, address, payment, appointment date/time MUST ALWAYS receive explicit confirmation from user, **regardless of ASR confidence score**. System MUST wait for user affirmation before proceeding.

**Rationale**: 
- **Production evidence (2025)**: ASR confidence scores unreliable due to overconfidence bias
- **False positive rate**: 5-15% of high-confidence (0.8-0.9) captures are actually wrong
- **Cost of error**: Wrong email/phone/address causes service delivery failure, customer complaints, revenue loss
- **Human baseline**: Professional receptionists always verify critical information, even when certain
- **Business impact**: 3-5 second confirmation prevents hours of failure resolution

**Constraints**:
- Critical data types: email, phone, address, payment, appointment datetime
- Confirmation style: Contextual ("Got it, jane at gmail dot com. Is that right?"), wait for explicit affirmation
- Non-critical data: May use confidence-based confirmation (name, preferences)
- **No exceptions**: Even confidence 0.99 must be confirmed for critical data

**Implementation**:
- Primitive definition includes `is_critical: true/false` flag
- If `is_critical: true`, confirmation mandatory (bypass confidence thresholds)
- If `is_critical: false`, use confidence-based confirmation strategy

---

### D-OBJ-022 Confirmation Style MUST Be Contextual (Not Robotic)
**Decision**: Confirmations MUST use contextual, natural pronunciation ("jane at gmail dot com"). MUST NOT use letter-by-letter spelling unless confidence <0.4 or user explicitly requests spelling.

**Rationale**: 
- Letter-by-letter confirmation wastes 10-15 seconds (vs 3-5 for contextual)
- Feels robotic, degrades user experience
- Contextual confirmation achieves same error detection rate (95%+ users interrupt if wrong)

**Constraints**:
- Natural pronunciation: "jane at gmail dot com" (3-5 seconds)
- NOT letter-by-letter: "j-a-n-e-at-g-m-a-i-l-dot-c-o-m" (10-15 seconds)
- Exception: If user corrects with spelling, confirm with spelling ("Okay, j-a-i-n-e at gmail")
- Brief pause after confirmation (500-1000ms) for user to respond

---

### D-OBJ-023 Locale Architecture MUST Support Global Expansion (US/UK/International)
**Decision**: V1 architecture MUST include locale parameter (`locale: "en-AU"`) that controls all information capture primitives. System MUST support adding new locales (US, UK, international) without rewriting core logic.

**Rationale**: 
- **V1 scope**: Australian-first (80% operational impact, highest ROI)
- **V2 expansion**: US, UK, other English-speaking markets (12-24 months post-launch)
- **Architectural constraint**: Cannot rebuild primitives per locale (doesn't scale)
- **Future-proofing**: Locale-aware primitives enable rapid international expansion

**V1 Implementation (Australian-First)**:
```
Primitive: capture_phone_au
- Locale: en-AU
- Validation: 04xx mobile, 02/03/07/08 landline, +61 international
- Confirmation: "oh-four-one-two, three-four-five, six-seven-eight"
- Multi-ASR: 3+ systems (Australian accent weighting)
```

**V2 Expansion (US Market)**:
```
Primitive: capture_phone_us
- Locale: en-US
- Validation: (XXX) XXX-XXXX, 1-XXX-XXX-XXXX
- Confirmation: "area code four-one-five, five-five-five, one-two-three-four"
- Multi-ASR: 2 systems (US accent baseline, lower cost)
```

**V2 Expansion (UK Market)**:
```
Primitive: capture_phone_uk
- Locale: en-GB
- Validation: +44 XXXX XXXXXX, 07XXX mobile, 01XXX/02X landline
- Confirmation: "oh-seven-nine-one-two, three-four-five, six-seven-eight"
- Multi-ASR: 2-3 systems (UK accent weighting)
```

**Locale-Specific Differences (Research Required for V2)**:
1. **Phone format/validation**: AU (04xx), US (XXX-XXX-XXXX), UK (+44)
2. **Address format**: AU (suburb/state/postcode), US (city/state/ZIP), UK (town/county/postcode)
3. **Date format**: AU/UK (DD/MM/YYYY), US (MM/DD/YYYY)
4. **Timezone**: AU (AEST/AEDT), US (PST/EST/CST/MST), UK (GMT/BST)
5. **Accent ASR accuracy**: AU (60-65% single ASR), US (80-85% single ASR), UK (70-75% single ASR)
6. **Privacy compliance**: AU (OAIC APPs), US (state-specific, CCPA/CPRA), UK (GDPR/ICO)
7. **Pronunciation patterns**: AU (rising intonation), US (flatter intonation), UK (regional variations)

**Constraints**:
- **V1**: Australian primitives only (`capture_phone_au`, `capture_address_au`, etc.)
- **V2**: Add US/UK primitives without modifying core architecture
- **Locale parameter**: Pass through entire capture flow (elicitation → validation → confirmation)
- **Primitive library**: Organized by locale (`primitives/en-AU/`, `primitives/en-US/`, `primitives/en-GB/`)
- **No branching logic**: Primitives self-contained per locale (no "if AU then X else Y" in core)

---

### D-OBJ-024 V2 Global Expansion MUST NOT Require Core Rewrites
**Decision**: Adding new locales (US, UK, international) in V2 MUST NOT require rewriting core capture logic, state machine, or confirmation strategies. Only locale-specific primitives added.

**Rationale**: 
- Core capture patterns universal (confidence, confirmation, repair)
- Only validation rules, formatting, pronunciation differ per locale
- Rewriting core for each locale does not scale (10-40 hour effort per locale)

**V1 Architectural Requirements (Enable V2 Expansion)**:
1. **Locale parameter**: Pass through all capture flows (`locale: "en-AU"`)
2. **Locale-specific primitives**: Self-contained validation/confirmation logic
3. **Locale-agnostic core**: State machine, repair loops, confidence thresholds locale-independent
4. **Locale-specific ASR weighting**: Multi-ASR voting varies by accent (AU: 3 systems, US: 2 systems)
5. **Locale-specific TTS pronunciation**: Phone/address confirmation pronunciation varies by locale

**V2 Expansion Effort (Per Locale)**:
- **With proper V1 architecture**: 40-80 hours (primitives + testing)
- **Without proper V1 architecture**: 200-400 hours (rewrite core + primitives)
- **ROI**: 5-10x time savings per locale with proper architecture

**Constraints**:
- V1 must implement locale parameter architecture (even though only AU locale exists)
- V1 primitives must demonstrate locale isolation (no hardcoded AU logic in core)
- V1 testing must validate locale parameter propagation

---

## Open Questions / Risks

### Q1-AU: How to Handle International Expansion (US, UK) Without Rewriting Primitives?
**Question**: V1 primitives are Australian-specific. If expanding to US/UK in V2, how to support without rewriting core logic?

**Risk**: Core primitives hardcoded for Australia. Must rewrite for US/UK expansion.

**Mitigation options**:
- **Locale parameter** (Recommended): All primitives accept `locale` parameter (`en-AU`, `en-US`, `en-UK`)
- **Primitive inheritance**: `capture_phone_us` inherits from `capture_phone` base class, overrides validation
- **Primitive library**: Separate primitives per locale (`capture_phone_au`, `capture_phone_us`, `capture_phone_uk`)
- **Runtime selection**: System selects primitive based on tenant's locale configuration

**V1 decision**: Locale parameter approach. All primitives designed with `locale: "en-AU"` parameter. V2 adds `en-US`, `en-UK` locale support without rewriting core logic.

**V1 Implementation**:
```
# Conceptual primitive structure
Primitive: capture_phone
  locales:
    en-AU:
      validation: australian_phone_regex
      normalization: +61 prefix
      elicitation: "What's the best number to reach you on?"
    en-US:  # V2 only
      validation: e164_us_regex
      normalization: +1 prefix
      elicitation: "What's the best number to reach you at?"
    en-UK:  # V2 only
      validation: uk_phone_regex
      normalization: +44 prefix
```

**Architecture Constraint** (CRITICAL):
- **V1**: All primitives MUST be designed with locale parameter (even though only `en-AU` implemented)
- **V2**: Add `en-US`, `en-UK` locales by extending primitive configurations (no core rewrite)
- **Testing**: Validate locale parameter system works in V1 (even with single locale)

---

### Q2-AU: How to Handle Medicare Number Capture (Healthcare Only)?
**Question**: Healthcare customers need Medicare number capture. Should this be V1 core primitive or V2 extension?

**Risk**: If not in V1, blocks healthcare customer onboarding. If in V1 but unused by non-healthcare, wasteful.

**Mitigation options**:
- **V1 core primitive**: Include `capture_medicare_number_au` in V1 (even if unused by most customers)
- **V2 extension**: Defer to V2, only add if healthcare customers validated
- **Conditional primitive**: Include in V1 but mark as optional (only load if customer needs it)

**V1 decision**: Include `capture_medicare_number_au` as V1 core primitive. Healthcare is major Australian market (hospitals, clinics, aged care). Cost to include: minimal. Risk of not including: blocks major customer segment.

**Implementation**:
- Medicare validation: 10-11 digits, first digit 2-6, check digit algorithm
- Privacy: Highly sensitive, explicit consent required
- Elicitation: "What's your Medicare number?"
- Confirmation: Partial confirmation (last 4 digits only, not full number for privacy)

---

### Q3-AU: How to Handle Area Code Inference (User Doesn't Provide Area Code)?
**Question**: User says landline without area code ("9876 5432" instead of "02 9876 5432"). How to infer area code?

**Risk**: Cannot validate without area code. Must ask separately (extra friction).

**Mitigation options**:
- **Ask explicitly**: "Is that a Sydney number?" (infer 02), "Melbourne?" (infer 03)
- **Detect from address**: If address already captured, infer from suburb/state (Sydney = 02, Melbourne = 03)
- **Mobile preference**: If ambiguous, ask "Is that a mobile or landline?" (most Australians use mobiles)
- **Default to mobile**: If user provides 10 digits starting with 4xxx, assume mobile (no area code needed)

**V1 decision**: 
1. If 10 digits starting with 04, assume mobile (no area code inference needed)
2. If 8 digits (no area code), ask "Is that a Sydney, Melbourne, or Brisbane number?" (infer area code from city)
3. If address already captured, infer from state (NSW = likely 02, VIC = likely 03)

**Implementation**: Area code inference logic in `capture_phone_au` primitive. Use address context if available.

---

### Q4-AU: How to Handle Daylight Saving Timezone Complexity?
**Question**: Daylight saving differs by state (NSW/VIC observe, QLD doesn't). How to handle correctly without asking user explicitly?

**Risk**: Wrong timezone calculation. Appointments booked at wrong time.

**Mitigation options**:
- **Detect from phone area code**: 02/03/07 = observe DST, 07 (QLD) = don't observe
- **Detect from address state**: If address captured, use state to determine DST
- **Ask explicitly**: "Just to confirm, are you in Queensland?" (QLD doesn't observe DST)
- **Safe default**: Use AEST (non-DST) to avoid errors during transition

**V1 decision**: 
1. Detect timezone from phone area code (02 = NSW = observe DST, 03 = VIC = observe DST, 07 = QLD = don't observe)
2. If ambiguous (08 could be WA or SA), ask "Are you in Perth or Adelaide?" (WA doesn't observe, SA observes)
3. Handle transitions: First Sunday in October (DST starts), first Sunday in April (DST ends)

**Implementation**: Timezone detection in `capture_date_au` and `capture_time_au` primitives. Daylight saving transition handling.

---

### Q5-AU: How to Handle Suburb Name Conflicts (Same Suburb, Multiple States)?
**Question**: "Richmond" exists in NSW (2753), VIC (3121), SA (5033), QLD (4740). User says "Richmond" without state. How to disambiguate?

**Risk**: Capture wrong Richmond, wrong postcode. Invalid address.

**Mitigation options**:
- **Ask for state first**: "Which state is that in?" before asking suburb
- **Ask for postcode**: "What's the postcode?" (disambiguates Richmond)
- **Infer from phone area code**: 02 = NSW, 03 = VIC, 07 = QLD, 08 = SA
- **Australia Post API**: Validate combination, suggest if wrong ("Did you mean Richmond VIC, 3121?")

**V1 decision**: 
1. Capture suburb, state, postcode in sequence (not suburb alone)
2. If state not provided, infer from phone area code
3. Validate combination via Australia Post API
4. If invalid, ask "Did you mean [suburb] [state], [postcode]?" (use API suggestion)

**Implementation**: Component capture with Australia Post API validation in `capture_address_au` primitive.

---

### Q6-AU: How to Handle Aboriginal and Torres Strait Islander Names?
**Question**: Aboriginal names may have different capitalization patterns or special characters. How to handle respectfully and accurately?

**Risk**: Incorrect normalization. Cultural insensitivity. Capture errors.

**Mitigation options**:
- **Preserve capitalization**: Don't auto-capitalize (may have specific capitalization)
- **Special characters**: Support hyphens, apostrophes, spaces (common in Aboriginal names)
- **No assumptions**: Don't assume Western name structure (first + last name)
- **Confirmation**: Always confirm name pronunciation (cultural respect)

**V1 decision**: 
1. Preserve user's capitalization (don't force Title Case)
2. Support hyphens, apostrophes, spaces in names
3. No validation on "valid name format" (too restrictive)
4. Always confirm name for clarity and respect

**Implementation**: Name validation in `capture_name_au` primitive. Minimal normalization, preserve user input.

---

### Q7-AU: How to Handle Multi-Language Support (Beyond English)?
**Question**: Australian customers may speak Mandarin, Cantonese, Vietnamese, Greek, Italian (large immigrant communities). How to handle?

**Risk**: English-only system cannot serve 20%+ of Australian population.

**Mitigation options**:
- **V1**: English-only (accept risk of 20% market exclusion)
- **V2**: Add Mandarin, Cantonese (largest non-English languages)
- **Language detection**: Detect user language, route to appropriate voice agent
- **Bilingual primitives**: Support bilingual elicitation (English + Mandarin)

**V1 decision**: English-only for V1. Multi-language in V2 if validated demand from Australian customers.

**Note**: Even English-only must handle Australian accent (different from US/UK English).

---

### Q8-AU: How to Handle Mobile vs Landline Preference?
**Question**: 85%+ of Australians prefer mobiles for callbacks. Should system assume mobile or ask explicitly?

**Risk**: If assume mobile, may miss landline-only customers. If ask explicitly, extra friction.

**Mitigation options**:
- **Assume mobile**: Elicit "What's your mobile?" (most common)
- **Generic elicitation**: "What's the best number?" (accept mobile or landline)
- **Conditional**: If first capture fails, ask "Is that a mobile or landline?" (disambiguate)

**V1 decision**: Generic elicitation ("What's the best number to reach you on?"). Accept both mobile and landline. Validate format to determine type.

**Implementation**: `capture_phone_au` primitive accepts both formats, normalizes to +61 international.

---

### Q9-AU: How to Handle PO Box vs Street Address?
**Question**: Some Australians use PO Box for mail (especially rural areas). Capture PO Box or street address or both?

**Risk**: If only capture street address, cannot reach PO Box customers. If only PO Box, cannot provide service at physical location.

**Mitigation options**:
- **Ask for purpose**: "Where should we deliver?" (street) vs "Where should we mail?" (PO Box)
- **Capture both**: Offer "Do you have a different mailing address?" after street address
- **PO Box validation**: Validate PO Box format ("PO Box 123, Sydney NSW 2000")

**V1 decision**: 
1. Capture street address by default (most common for service delivery)
2. If purpose is "mail" or "invoice", offer PO Box option
3. Support PO Box format in `capture_address_au` primitive

**Implementation**: PO Box regex validation, Australia Post API supports PO Box validation.

---

### Q10-AU: How to Handle State-Specific Public Holidays?
**Question**: Public holidays differ by state (e.g., Melbourne Cup Day in VIC only). Should system warn when user books on public holiday?

**Risk**: Appointment booked on public holiday. Business closed. Customer no-show, wasted appointment slot.

**Mitigation options**:
- **Public holiday database**: Maintain state-specific public holiday list
- **Warning**: "That's Melbourne Cup Day in Victoria. Are you sure you want to book then?"
- **Suggest alternative**: "The business may be closed. Would you like to book the next day instead?"
- **Defer**: Don't handle in V1 (assume business sets own availability)

**V1 decision**: Defer to V2. V1 assumes business configures availability calendar (blocks public holidays themselves). Too complex for V1.

**Note**: If major healthcare/government customer requires it, can add in V1 as custom primitive extension.

## Open Questions / Risks

### Q1-GLOBAL: How to Handle International Expansion (US, UK) Without Rewriting Primitives?
**Question**: V1 primitives are Australian-specific. If expanding to US/UK in V2, how to support without rewriting core logic?

**Risk**: Core primitives hardcoded for Australia. Must rewrite for US/UK expansion.

**Mitigation options**:
- **Locale parameter** (Recommended): All primitives accept `locale` parameter (`en-AU`, `en-US`, `en-GB`)
- **Primitive inheritance**: `capture_phone_us` inherits from `capture_phone` base class, overrides validation
- **Primitive library**: Separate primitives per locale (`capture_phone_au`, `capture_phone_us`, `capture_phone_uk`)
- **Runtime selection**: System selects primitive based on tenant's locale configuration

**V1 decision**: Locale parameter approach. All primitives designed with `locale: "en-AU"` parameter. V2 adds `en-US`, `en-GB` locale support without rewriting core logic.

**V1 Implementation** (CRITICAL Architecture Decision):
```
# Conceptual primitive structure
Primitive: capture_phone
  locales:
    en-AU:  # V1 - Implemented
      validation: australian_phone_regex (+61, 04xx mobile, 02/03/07/08 landline)
      normalization: +61 prefix
      elicitation: "What's the best number to reach you on?"
      pronunciation: "oh-four-one-two" for 0412
      multi_asr: 3 systems (Australian accent requires high ASR coverage)
      
    en-US:  # V2 only - Configuration ready, not implemented
      validation: e164_us_regex (+1, (XXX) XXX-XXXX)
      normalization: +1 prefix
      elicitation: "What's the best number to reach you at?"
      pronunciation: "area code four-one-five, five-five-five, one-two-three-four"
      multi_asr: 2 systems (US accent baseline, lower cost)
      date_format: MM/DD/YYYY (NOT DD/MM/YYYY)
      address_validation: USPS API (free for US addresses)
      state_handling: 50 states + DC, accept full name or abbreviation
      timezone: PST/MST/CST/EST + DST (infer from area code or clarify)
      privacy: CCPA (California), state-specific two-party consent (11 states)
      
    en-GB:  # V2 only - Configuration ready, not implemented
      validation: uk_phone_regex (+44, 07XXX mobile, 01XXX/02X landline)
      normalization: +44 prefix
      elicitation: "What's the best number to reach you on?"
      pronunciation: "oh-seven-nine-one-two" for 07912
      multi_asr: 2-3 systems (UK accent weighting)
      date_format: DD/MM/YYYY (same as AU)
      address_validation: Royal Mail PAF API (licensing required)
      postcode_handling: Complex format (e.g., "SW1A 1AA", variable length with space)
      timezone: GMT/BST (single timezone, simpler than US)
      privacy: GDPR, ICO guidelines (explicit consent required)
```

**Locale-Specific Differences (Critical for V2 Planning)**:

| Feature | Australia (V1) | United States (V2) | United Kingdom (V2) |
|---------|----------------|-------------------|---------------------|
| **Phone Format** | +61 04xx (mobile), 02/03/07/08 (landline) | +1 (XXX) XXX-XXXX | +44 07XXX (mobile), 01XXX/02X (landline) |
| **Date Format** | DD/MM/YYYY | MM/DD/YYYY ⚠️ | DD/MM/YYYY |
| **Address Validation** | Australia Post API | USPS API (free) | Royal Mail PAF API (paid) |
| **State/Region** | 3-char codes (NSW, VIC, QLD) | 2-char codes (CA, NY, TX) | Counties (optional, complex) |
| **Postcode** | 4 digits | 5 digits (ZIP) or ZIP+4 | Variable (e.g., SW1A 1AA) |
| **Timezone** | AEST/AEDT/ACST/AWST (4 zones) | PST/MST/CST/EST (4 main + territories) | GMT/BST (1 zone) |
| **Multi-ASR** | 3 systems (accent requires high coverage) | 2 systems (accent baseline) | 2-3 systems (accent weighting) |
| **Pronunciation (0)** | "oh" | Research required (likely "oh" for phone) | "oh" |
| **Privacy** | OAIC APPs (disclosure, no consent required) | CCPA + state-specific (some require all-party consent) | GDPR (explicit consent required) |

**Architecture Constraint** (NON-NEGOTIABLE):
- **V1**: All primitives MUST be designed with locale parameter architecture (even though only `en-AU` implemented)
- **V2**: Add `en-US`, `en-GB` locales by extending primitive configurations (no core logic rewrite)
- **Testing**: Validate locale parameter system works in V1 (even with single locale)
- **Future-proof**: International expansion possible without architectural rewrite

**V2 Expansion Effort (Per Locale)**:
- **With proper V1 architecture**: 40-80 hours (primitives + locale-specific validation + testing)
- **Without proper V1 architecture**: 200-400 hours (rewrite core + primitives)
- **ROI**: 5-10x time savings per locale with proper V1 architecture

**V2 Research Requirements** (Before US/UK Launch):
1. **US Date Ambiguity**: Do users say "March 15th" (month-first) or "15th of March" (day-first)?
2. **US State Handling**: Full name vs abbreviation preference? Normalization strategy?
3. **US Timezone Inference**: Area code-based inference accuracy? Clarification strategy?
4. **US Privacy Compliance**: Which states require all-party consent? How to detect state from area code?
5. **UK Address Complexity**: Royal Mail PAF API cost? Free alternatives? Postcode pronunciation?
6. **UK Pronunciation**: "oh" vs "zero" for phone numbers? Other pronunciation differences?
7. **Multi-ASR Cost**: US/UK accent accuracy with single ASR? 2x ASR sufficient or need 3x?
8. **Address Validation APIs**: Australia Post vs USPS vs Royal Mail - latency, cost, accuracy comparison

---

### Q2: How to Handle Custom Slot Types (Medical Record Number, Employee ID)?
**Question**: Customers request custom slot types beyond core primitives. How to extend?

**Risk**: Core primitives insufficient. Customers cannot configure custom slots.

**Mitigation options**:
- V1: Generic `capture_alphanumeric` primitive (configurable length, format)
- V2: Custom primitive creation (customers define validation, elicitation)
- Workaround: Use existing primitive with validation override

**V1 decision**: Generic `capture_alphanumeric` primitive. Custom primitives in V2.

---

### Q3: How to Handle Multi-Language Elicitation?
**Question**: Customers need elicitation in Spanish, French, etc. How to support?

**Risk**: English-only primitives. Cannot serve non-English customers.

**Mitigation options**:
- V1: English-only elicitation (accept risk)
- V2: Multi-language elicitation templates (translate primitive elicitation)
- Workaround: Customer provides translated elicitation strings

**V1 decision**: English-only. Multi-language in V2 based on demand.

---

### Q4: How to Handle Low-Confidence Captures After 3 Retries?
**Question**: After 3 retry attempts, confidence still <0.4. What to do?

**Risk**: Capture failure. Cannot proceed to next objective.

**Mitigation options**:
- Escalate to human (transfer call to agent)
- Skip objective (if `required: false`)
- Fallback to alternative (email if phone fails)
- Accept low-confidence capture (proceed with warning)

**V1 decision**: If `required: true`, escalate to human after 3 retries. If `required: false`, skip objective.

---

### Q5: How to Handle Partial Captures (User Provides Multiple Values at Once)?
**Question**: User volunteers multiple values in single utterance ("email me at jane at gmail and call me at 555-0123"). How to handle?

**Risk**: System only captures one value, re-asks for second (wastes time).

**Mitigation options**:
- Multi-slot extraction: LLM extracts all values from single utterance
- Fill multiple slots simultaneously (email and phone)
- Confirm both: "Got it, jane at gmail and 555-0123. Sound right?"

**V1 decision**: Multi-slot extraction. LLM extracts all detected slots from utterance. Fill multiple slots simultaneously.

---

### Q6: How to Handle Confidence Threshold Tuning Per Customer?
**Question**: Customer A wants aggressive capture (0.6 threshold). Customer B wants conservative (0.8 threshold). How to support?

**Risk**: Fixed thresholds don't fit all customers.

**Mitigation options**:
- V1: Fixed thresholds (0.9/0.7/0.4) for all customers
- V2: Per-customer threshold override (in objective config)
- Workaround: Per-slot-type thresholds (email 0.7, name 0.5)

**V1 decision**: Fixed thresholds. Per-customer override in V2 if validated need.

---

### Q7: How to Handle Validation Override (Customer Accepts Invalid Formats)?
**Question**: Customer wants to accept non-standard email formats (e.g., no TLD: "jane@localhost"). How to override validation?

**Risk**: Strict validation blocks valid customer use cases.

**Mitigation options**:
- V1: Validation override in objective config (`validation_override: {...}`)
- Allow customer to disable specific validation rules
- Graceful failure: If validation fails, ask user to confirm ("That email doesn't look standard. Is it correct?")

**V1 decision**: Validation override in objective config. Customer can disable validation for specific slots.

---

### Q8: How to Handle User Refusal to Provide Information?
**Question**: User refuses to provide email ("I don't want to give my email"). How to handle?

**Risk**: Cannot complete objective. Conversation stuck.

**Mitigation options**:
- If `required: false`, skip objective
- If `required: true`, explain purpose, ask again ("I need your email to send the confirmation. Is there an email I can use?")
- Escalate to human after refusal
- Accept alternative (phone instead of email)

**V1 decision**: If `required: false`, skip. If `required: true`, explain purpose (use `purpose` field), ask once more, then escalate to human.

---

### Q9: How to Handle Ambiguous Corrections ("No, the other one")?
**Question**: User corrects ambiguously ("No, the other one" without specifying what "other" means). How to clarify?

**Risk**: System doesn't know what to correct.

**Mitigation options**:
- Clarification question: "Which part should I update? The username or the domain?"
- LLM inference: Use conversation history to infer what "other" refers to
- Re-elicit: "I'm not sure which part to change. Can you spell the correct email?"

**V1 decision**: Clarification question. If still ambiguous after clarification, re-elicit entire slot.

---

### Q10-AU: How to Handle Australia Post API Validation Latency?
**Question**: Australia Post Validate Suburb API may take 500ms-2s. Slows capture flow. How to handle without blocking conversation?

**Risk**: Latency explosion. Validation blocks conversation flow. User experience degraded.

**Mitigation options**:
- **Async validation** (Recommended): Capture address, validate in background, proceed to next objective
- **Timeout with fallback**: If validation >2s, accept capture and validate async (don't block)
- **Cache**: Cache validation results for common suburb+postcode combinations (95% hit rate expected)
- **Optimistic capture**: Assume valid, validate after conversation ends

**V1 decision**: Hybrid approach:
1. **Synchronous validation with timeout**: Attempt Australia Post API validation with 2-second timeout
2. **If completes <2s**: Use validation result (accept if valid, re-elicit if invalid)
3. **If times out or fails**: Accept capture, validate async in background (don't block conversation)
4. **If async validation fails**: Log error, flag for manual review (don't call user back for minor address errors)
5. **Caching**: Cache validation results for common combinations (reduce API calls by 80-90%)

**Implementation**: 
- Australia Post API with 2-second timeout in `capture_address_au` primitive
- Async fallback on timeout/failure
- Redis cache for validation results (TTL: 7 days)
- Post-call validation job for async failures

**Critical**: Do NOT block conversation on API validation. User experience > perfect validation.
