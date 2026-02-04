# V1 Acceptance Checklist (5 minutes)

Run this checklist by speaking to the bot at **https://spotfunnel.daily.co**

## Test 1: Basic Turn-Taking (30 seconds)
**Goal:** Verify the bot waits for you to finish speaking before responding.

1. Join the room
2. Bot says: "What's your email address?"
3. **Speak slowly:** "My email is..." (pause mid-sentence)
4. **Continue:** "...jane at gmail dot com"

**✅ PASS:** Bot waits until you finish the full sentence before responding.  
**❌ FAIL:** Bot interrupts you mid-sentence.

---

## Test 2: Barge-In (30 seconds)
**Goal:** Verify you can interrupt the bot.

1. Bot starts confirmation: "Got it, jane at gmail dot com. Is that—"
2. **Interrupt immediately:** "No, actually it's john at outlook dot com"

**✅ PASS:** Bot stops speaking and processes your correction.  
**❌ FAIL:** Bot continues speaking or ignores your interruption.

---

## Test 3: Capture + Confirm + Repair (90 seconds)
**Goal:** Verify email capture, confirmation, and correction flow.

1. Bot: "What's your email address?"
2. You: "test at example dot com"
3. Bot: "Got it, test at example dot com. Is that correct?"
4. You: "No, it's test123 at example dot com"
5. Bot: "Got it, test123 at example dot com. Is that correct?"
6. You: "Yes"
7. Bot: "Perfect, thank you!"

**✅ PASS:** Bot captures correction and re-confirms before completing.  
**❌ FAIL:** Bot ignores correction or completes with wrong email.

---

## Test 4: Retry Bound (90 seconds)
**Goal:** Verify the bot gives up after 3 failed attempts.

1. Bot: "What's your email address?"
2. You: "blah blah blah" (nonsense)
3. Bot: "Sorry, I didn't catch that. Could you please repeat your email address?"
4. You: "more nonsense"
5. Bot: "Let's try again. Please say your email address slowly and clearly."
6. You: "still nonsense"
7. Bot: "I'm sorry, I wasn't able to capture your email. Let's end the call."

**✅ PASS:** Bot gives up after 3 attempts and ends gracefully.  
**❌ FAIL:** Bot retries forever or crashes.

---

## Test 5: Australian Accent (60 seconds)
**Goal:** Verify Australian English transcription accuracy.

1. Bot: "What's your email address?"
2. You: "mate at bigpond dot com dot au" (use rising intonation)
3. Bot: "Got it, mate at bigpond dot com dot au. Is that correct?"
4. You: "Yeah, spot on"
5. Bot: "Perfect, thank you!"

**✅ PASS:** Bot correctly transcribes Australian domain and affirmation.  
**❌ FAIL:** Bot misses ".au" or doesn't recognize "yeah, spot on".

---

## Test 6: Event Timeline Verification (30 seconds)
**Goal:** Verify deterministic event ordering.

After the call ends, check the terminal output for:

```
EVENT SUMMARY
1. call_started (timestamp)
2. objective_started (capture_email_au)
3. user_spoke (transcription)
4. objective_captured (email value)
5. objective_completed (email confirmed)
6. call_ended (timestamp)
```

**✅ PASS:** Events are ordered, timestamped, and include trace_id.  
**❌ FAIL:** Events are missing, out of order, or lack trace_id.

---

## Expected Results

- **All 6 tests PASS:** V1 Voice Core is production-ready.
- **Any test FAILS:** Review event timeline and fix before deployment.

Total time: ~5 minutes
