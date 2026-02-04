# Critical Data Confirmation & ASR Confidence Patterns

Prevents 5-15% of critical data capture errors that cause business failures (wrong email = no service delivery). ASR confidence scores exhibit overconfidence bias—high scores (0.8-0.9) are frequently wrong.

## Why This Skill Matters

- **Prevents business failures**: Wrong email = customer never receives service
- **ASR overconfidence bias**: 5-15% of high-confidence (0.8-0.9) captures are wrong
- **Production evidence**: Human receptionists always verify critical information, even when certain
- **Cost of error**: Critical for appointment booking, service delivery, payment processing

## Key Patterns

### 1. Always Confirm Critical Data (Regardless of Confidence)

**Critical Data Types:**
- Email addresses
- Phone numbers
- Physical addresses
- Payment information
- Appointment date/time

**Rule**: Never skip confirmation for critical data, even if confidence ≥0.9

**Why**: ASR confidence scores are unreliable due to overconfidence bias. Production data shows 5-15% of high-confidence captures are wrong.

```python
# ✅ CORRECT: Always confirm critical data
if slot_type in ["email", "phone", "address", "payment", "appointment_datetime"]:
    # ALWAYS confirm, regardless of confidence
    await confirm_contextually(captured_value, wait_for_affirmation=True)
    
# ❌ INCORRECT: Skipping confirmation based on confidence
if confidence >= 0.9:
    skip_confirmation()  # NEVER DO THIS FOR CRITICAL DATA
```

### 2. Multi-ASR for Australian Accent (Mandatory)

**Requirement**: Email and phone capture MUST route through 3+ ASR systems

**ASR Systems**:
1. Deepgram
2. AssemblyAI
3. GPT-4o-audio

**Performance**:
- Single ASR on Australian accent: 60-65% accuracy
- Multi-ASR with LLM ranking: 75-85% accuracy
- ROI: 50-70% reduction in re-elicitation loops

**Cost**:
- Multi-ASR: $0.01-0.03/min (3x single ASR)
- Acceptable cost for critical data accuracy

```python
# ✅ CORRECT: Multi-ASR for email/phone
async def capture_email_multi_asr(audio: bytes) -> str:
    # Parallel transcription with 3 ASR systems
    results = await asyncio.gather(
        deepgram.transcribe(audio),
        assemblyai.transcribe(audio),
        openai_audio.transcribe(audio)
    )
    
    # LLM ranks candidates with Australian accent awareness
    ranked = await llm_rank_candidates(
        results,
        accent="en-AU",
        prompt="Which transcription is most likely correct for Australian English?"
    )
    
    # Validate and return best candidate
    return validate_email(ranked[0])

# ❌ INCORRECT: Single ASR for Australian accent
email = deepgram.transcribe(audio)  # Only 60-65% accuracy
```

### 3. Confidence-Based Strategy for Non-Critical Data Only

**Non-Critical Data**: Name, service preferences, notes

**Confirmation Strategy**:
- Confidence ≥0.7: Implicit confirmation ("Got it, thanks")
- Confidence 0.4-0.7: Contextual confirmation ("So that's [value], right?")
- Confidence <0.4: Re-elicit (max 3 retries)

**Critical Data**: ALWAYS confirm, ignore confidence thresholds

```python
# ✅ CORRECT: Confidence-based for non-critical, always confirm critical
if slot_type in CRITICAL_SLOTS:
    # Always confirm critical data
    await confirm_contextually(value)
else:
    # Non-critical: use confidence thresholds
    if confidence >= 0.7:
        await implicit_confirmation()
    elif confidence >= 0.4:
        await contextual_confirmation(value)
    else:
        await re_elicit()
```

### 4. Component-Level Confidence Tracking

**Pattern**: Track confidence per component (username vs domain, area code vs number)

**Benefit**: Confirm only uncertain components, not entire value

**Example**: If "gmail.com" is high confidence but "jane" is low, confirm only "jane"

```python
# ✅ CORRECT: Component-level confirmation
def confirm_email_components(email: str, components: dict):
    username, domain = email.split('@')
    
    if components['username']['confidence'] < 0.7:
        await say(f"Just to confirm, that's {username} before the @?")
        
    if components['domain']['confidence'] < 0.7:
        await say(f"And the domain is {domain}?")
    
    # Don't re-confirm high-confidence components

# ❌ INCORRECT: Re-confirming entire value
await say(f"Can you confirm the entire email: {email}?")  # Wastes time
```

## Critical Rules (Non-Negotiable)

1. ✅ **Email, phone, address, payment, appointment datetime MUST ALWAYS be confirmed**
   - No exceptions, regardless of confidence score
   
2. ✅ **Email and phone capture MUST use 3+ ASR systems for Australian accent**
   - Mandatory, not optional
   - Budget for 3x ASR costs
   
3. ❌ **Never skip confirmation based on confidence scores for critical data**
   - Confidence scores exhibit overconfidence bias
   - 5-15% of high-confidence captures are wrong
   
4. ✅ **Contextual confirmation (3-5 seconds), not robotic spelling**
   - "jane at gmail dot com" (contextual, 3-5 seconds)
   - NOT "j-a-n-e at g-m-a-i-l dot c-o-m" (robotic, 10-15 seconds)

## Contextual Confirmation Examples

**Email**:
- ✅ "Got it, jane at gmail dot com"
- ❌ "Can you spell that letter by letter?"

**Phone**:
- ✅ "0412 345 678, is that right?"
- ❌ "zero four one two, three four five, six seven eight"

**Address**:
- ✅ "123 Main Street, Richmond, NSW, is that correct?"
- ❌ "one two three Main Street, Richmond, New South Wales, two zero eight five"

## Common Mistakes to Avoid

### ❌ Mistake 1: Skipping confirmation for high-confidence critical data
**Problem**: Confidence scores unreliable (overconfidence bias)
**Solution**: Always confirm email, phone, address, payment, datetime

### ❌ Mistake 2: Using single ASR for Australian accent
**Problem**: Only 60-65% accuracy on Australian English
**Solution**: Use 3+ ASR systems with LLM ranking (75-85% accuracy)

### ❌ Mistake 3: Confirming entire value when only one component uncertain
**Problem**: Wastes time, frustrates user
**Solution**: Confirm only uncertain components (e.g., username but not domain)

### ❌ Mistake 4: Using confidence scores as absolute truth
**Problem**: Confidence scores exhibit overconfidence bias
**Solution**: Use confidence to inform strategy, but always confirm critical data

## Testing Requirements

**Before deploying ANY primitive capturing critical data:**

1. ✅ Test with 20+ Australian accent samples
2. ✅ Verify multi-ASR voting works correctly
3. ✅ Confirm confirmation is ALWAYS triggered (never skipped)
4. ✅ Test component-level confirmation (partial repairs)
5. ✅ Verify contextual confirmation (3-5 seconds, not robotic)

## Production Metrics to Track

- **Confirmation rate**: 100% for critical data (alert if <100%)
- **Multi-ASR coverage**: 100% for email/phone (alert if <100%)
- **Re-elicitation rate**: <20% for critical data (alert if >20%)
- **False positive rate**: <5% incorrect confirmations (user corrects)
- **Abandonment rate**: <10% during confirmation flow

## References

- Research: `research/21-objectives-and-information-capture.md` (lines 46-54, 64, 162-165)
- Architecture Law: `docs/ARCHITECTURE_LAWS.md` R-ARCH-006 (lines 710-728)
- Production evidence: ASR overconfidence bias, 5-15% false positive rate at high confidence
