# Research: Turn-Taking, Interruption, and Barge-In in Voice AI Systems

**🟢 LOCKED** - Production-validated research based on Pipecat Smart Turn V3, Silero VAD v6.2, LiveKit Turn Detector v1.3.12. Updated February 2026.

---

## Why This Matters for V1

Turn-taking is the single most critical factor separating natural voice AI from robotic experiences. Production call-center AI systems fail primarily due to premature cutoffs (interrupting customers during natural pauses) and talk-over (simultaneous speech collisions). These failures directly increase call duration, customer frustration, and operational costs—incomplete transcripts sent to LLM APIs incur processing costs for both initial attempts and error corrections. For V1, getting turn-taking right determines whether customers perceive the system as conversational or broken.

## What Matters in Production (Facts Only)

**End-of-Turn Detection vs. VAD:**
- Voice Activity Detection (VAD) classifies individual audio frames as speech/silence; end-of-turn detection identifies when a user has *finished* their turn
- VAD with fixed silence timeouts (1-2 seconds) is the most common approach but creates unnecessary latency and high error rates
- Human pauses *within* turns are often longer than pauses *between* turns, making silence alone an unreliable indicator

**Latency Budget Reality:**
- Total cascaded pipeline (STT → LLM → TTS): 1-2+ seconds if unoptimized
- Breakdown: End-of-utterance detection (100-300ms) + STT (150-500ms) + LLM TTFT (200-800ms) + TTS TTFB (100-500ms) + Network (50-200ms)
- PSTN telephony adds ~500ms network latency before any agent processing begins
- User satisfaction drops precipitously beyond 1 second total response time

**Acceptable Latency Thresholds:**
- <200ms: Feels instantaneous
- 500-1000ms: Keeps conversation smooth
- >2000ms: Conversations start to fail
- Target for production: P50 <500ms, P95 <800ms end-to-end turn latency

**Partial vs. Final STT Transcripts:**
- Partial transcripts: Preliminary results streamed in real-time as speech is detected (can arrive in <100ms for first words)
- Final transcripts: Confirmed complete segment marked with `is_final: true`
- Providers break audio into segments based on natural pauses or speaker changes
- Best practice: Render/replace partials as they arrive, but trigger downstream LLM processing only on final transcripts

**Barge-In Detection:**
- Barge-in = user interrupts while agent is speaking
- Requires continuous low-latency audio monitoring (<100ms) during agent speech output
- Must differentiate system playback audio from user speech (duplex processing + echo cancellation)
- Default interrupt duration threshold: 160ms (configurable)

**Backchannel Suppression:**
- Backchannels ("uh-huh," "yeah," "mm-hmm") signal attentiveness without taking a turn
- Systems must distinguish backchannels from actual turn-taking cues to avoid false interruptions
- Conventional threshold-based silence detection cannot differentiate these cases

## Common Failure Modes (Observed in Real Systems)

**1. Premature Cutoff (Most Common)**
- System interrupts customer during natural pauses for thinking, recalling information, or checking details
- Occurs across industries: finance (spelling account numbers), healthcare (recalling patient IDs), retail (providing addresses)
- Root cause: Simple VAD or fixed silence timeouts (1-2s) that fail to distinguish pauses-within-turn from turn-completion
- Impact: Unnecessary re-prompts, incomplete LLM processing, wasted API costs, customer frustration

**2. Talk-Over / Simultaneous Start**
- Agent and user begin speaking at the same time
- Often occurs at conversation instances where affective states change
- Predictable based on utterance duration and acoustic features (pitch, intensity)
- Result: Overlapping speech, confusion, need for repair sequences

**3. Long Awkward Silences**
- System waits too long before responding (>2 seconds)
- Often caused by conservative end-of-turn thresholds to avoid premature cutoffs
- Creates perception of system lag or failure

**4. False Positive Barge-In**
- Transient noises: Keyboard clicks, coughs, door slams trigger VAD thresholds
- Background speech: Non-directed conversations, whispering, TV audio
- Echo leakage: Residual playback audio after acoustic echo cancellation (AEC)
- Backchannel misclassification: "uh-huh" interpreted as user wanting to take turn
- Result: Agent stops mid-sentence unnecessarily, conversation flow disrupted

**5. Missed Interruptions**
- User attempts to interrupt but system continues speaking
- Often due to interrupt duration threshold being too high or poor echo cancellation
- Creates frustration and perception that system "won't listen"

**6. Context-Free Detection Errors**
- System lacks semantic understanding of whether pause indicates thinking vs. completion
- Example: "My account number is... [checking phone] ...4-5-6-7" gets cut off after first pause
- Simple acoustic models cannot distinguish these cases without linguistic context

## Proven Patterns & Techniques

**1. Hybrid Turn Detection Models**
- Combine multiple signals: VAD + STT endpointing + semantic context + prosodic cues
- Acoustic-linguistic fusion: Neural acoustic models + LLMs for context-aware prediction
- Voice Activity Projection (VAP): Continuous frame-wise prediction distinguishing "holds" (pauses) from "shifts" (turn completion)
- Verified: Reduces cutoff errors by 37-43% at fixed 160ms latency vs. VAD-only approaches

**2. Configurable End-of-Turn Timeouts by Use Case**
- Interrupt mode: 500ms (snappy, higher false positives)
- Standard conversation: 700-1000ms
- Dictation/complex input mode: 2000ms (allows heavy thinking pauses)
- Verified: Production systems expose this as configuration parameter

**3. Streaming and Parallel Processing**
- Stream partial STT transcripts immediately (<100ms)
- Begin LLM processing on partial transcripts for intent detection
- Start TTS generation on early LLM tokens while later tokens still generating
- Verified: Dramatically reduces perceived latency vs. sequential pipeline

**4. Interruption Strategies with Thresholds**
- Minimum word count before allowing interruption (e.g., require 2-3 words to prevent false positives from backchannels)
- Minimum duration threshold (default 160ms)
- Interrupt modes: immediate, append to queue, or ignore
- Verified: Implemented in Pipecat, LiveKit, OpenAI Realtime API

**5. Echo Cancellation + Duplex Processing**
- Acoustic Echo Cancellation (AEC) preprocessing to remove device playback signals
- Separate audio streams for system output vs. user input
- Duplex processing to differentiate overlapping audio
- Verified: Required for barge-in detection; imperfect AEC leaves residual echo that degrades performance

**6. Noise Robustness via Data Augmentation**
- Train VAD/turn detection models on audio corrupted with music, TV, ambient noise
- Verified: Achieves 30-45% relative reduction in false rejection rates

**7. Backchannel Prediction Models**
- Fine-tune VAP models on specialized backchannel datasets
- Combine acoustic features with speaker-listener interaction encoding
- Predict both timing and type of minimal responses
- Verified: Enables natural conversation flow without false interruptions

**8. Track Conversation State for Interruption Handling**
- When user interrupts mid-agent-response, record only the portion actually delivered to user
- Maintain accurate conversation history for LLM context
- Verified: Critical for multi-turn coherence after interruptions

## Engineering Rules (Binding)

**R1: Never use VAD-only with fixed silence timeout as sole turn detection mechanism**
- Minimum requirement: VAD + STT endpointing
- Preferred: VAD + STT endpointing + semantic turn detection model

**R2: End-of-turn detection latency budget: 100-300ms maximum**
- Naive 1-1.5 second silence timeouts waste half the total latency budget
- Use neural endpointers trained for low-latency detection

**R3: Total turn latency targets (user stops speaking → agent starts speaking):**
- P50: <500ms
- P95: <800ms
- P99: <1000ms
- If exceeded, conversation quality degrades measurably

**R4: Always use streaming/partial transcripts**
- Render partials as they arrive
- Trigger LLM processing only on final transcripts
- Enable parallel processing (LLM + TTS) to reduce perceived latency

**R5: Barge-in detection must operate continuously at <100ms latency during agent speech**
- Implement acoustic echo cancellation (AEC)
- Use duplex audio processing to separate system and user audio

**R6: Implement minimum word count threshold for interruptions**
- Minimum 2-3 words before allowing barge-in
- Prevents false positives from backchannels and transient noise

**R7: Configure end-of-turn timeout based on use case:**
- Default conversation: 700-1000ms
- Complex input (account numbers, addresses): 1500-2000ms
- Fast interaction (simple yes/no): 500ms
- Must be runtime-configurable, not hardcoded

**R8: Track and log exact audio delivered before interruption**
- Record only the portion of agent response actually played to user
- Maintain accurate conversation history for LLM context

**R9: Implement interrupt modes with priority levels**
- Support: immediate stop, append to queue, ignore
- Allow configuration per conversation state or intent

**R10: Never send incomplete user utterances to LLM for final processing**
- Use partials for intent preview only
- Wait for final transcript before committing to LLM history and response generation

## Metrics & Signals to Track

**Latency Metrics (P50, P95, P99):**
- End-of-utterance detection time (target: 100-300ms)
- STT processing time (target: 150-500ms)
- LLM time-to-first-token (target: 200-800ms)
- TTS time-to-first-byte (target: 100-500ms)
- End-to-end turn latency (target P50 <500ms, P95 <800ms)

**Turn Detection Quality:**
- Premature cutoff rate (% of turns where user was interrupted mid-thought)
- Missed interruption rate (% of barge-in attempts that failed)
- False positive barge-in rate (% of interruptions triggered by non-speech)
- Average silence duration before turn detection
- Turn detection accuracy (sequence alignment-based, not just timestamp-based)

**STT Quality:**
- Word Error Rate (WER): 5-10% good, 20%+ problematic
- Partial transcript latency (time to first word)
- Final transcript latency (time to is_final=true)

**Conversation Flow:**
- Average turns per conversation
- Re-prompt rate (how often system asks user to repeat)
- Overlap duration (when agent and user speak simultaneously)
- Backchannel false positive rate (backchannels misclassified as turn-taking)

**User Experience Proxies:**
- Sentiment analysis (stress, frustration, confusion detection)
- Intent classification confidence scores
- Call duration (longer calls often indicate turn-taking failures)
- Escalation rate to human agents

**System Health:**
- Echo cancellation residual energy
- Background noise levels
- VAD confidence scores
- Turn detection model confidence scores

## V1 Decisions / Constraints

**Decision: Use hybrid turn detection (VAD + STT endpointing + semantic model)**
- Rationale: VAD-only has unacceptable error rates in production
- Constraint: Adds complexity but required for acceptable quality

**Decision: Target P95 end-to-end turn latency <800ms**
- Rationale: Balance between natural feel and technical feasibility
- Constraint: Requires streaming architecture and careful provider selection

**Decision: Implement configurable end-of-turn timeouts with 3 presets**
- Standard (700ms), Complex Input (1500ms), Fast (500ms)
- Rationale: Different conversation contexts have different pause patterns
- Constraint: Must expose configuration at runtime, not compile-time

**Decision: Minimum 2-word threshold for barge-in**
- Rationale: Prevents backchannel false positives
- Constraint: May delay legitimate single-word interruptions by ~200ms

**Decision: Use Deepgram/AssemblyAI for STT with partial transcript support**
- Rationale: Sub-100ms partial transcript latency required for responsive system
- Constraint: Vendor lock-in, API costs

**Decision: Implement full conversation state tracking with interruption logging**
- Rationale: Required for debugging turn-taking issues and maintaining LLM context accuracy
- Constraint: Storage and processing overhead

**Decision: Defer backchannel generation (agent producing "uh-huh") to post-V1**
- Rationale: Backchannel *detection* is critical; backchannel *generation* is nice-to-have
- Constraint: V1 will feel slightly less human without agent backchannels

**Decision: Use Pipecat Smart Turn V3 (LocalSmartTurnAnalyzerV3) for turn management**
- Rationale: ML-based turn detection beyond basic VAD; recognizes intonation patterns and linguistic signals; supports fast CPU inference
- Constraint: ~400MB RAM requirement, ~25ms inference time
- Alternative: LiveKit Turn Detector v1.3.12 (Jan 2026) - 13 languages, 25ms inference, open-weights model

## Open Questions / Risks

**Q1: What is acceptable premature cutoff rate for production?**
- Hypothesis: <5% of turns, but needs validation with real users
- Risk: Too strict threshold increases latency; too loose increases cutoffs

**Q2: How to handle multi-party calls (customer + background speaker)?**
- Current approaches assume single speaker
- Risk: Background conversations will trigger false barge-ins
- Mitigation: May require speaker diarization or directional audio

**Q3: What is optimal interrupt duration threshold?**
- Default 160ms is common, but is it optimal across use cases?
- Risk: Too short = noise false positives; too long = missed interruptions

**Q4: How to detect "thinking pauses" vs. "done speaking" pauses?**
- Semantic models help but not perfect
- Risk: Fundamental ambiguity in human speech patterns
- Mitigation: May need explicit user training ("say 'hold on' if you need time to think")

**Q5: Should we implement turn-taking prediction (proactive vs. reactive)?**
- Some research shows predicting turn-taking 500ms in advance improves flow
- Risk: Adds complexity; prediction errors could worsen experience
- Decision: Defer to post-V1

**Q6: How to handle regional/cultural differences in turn-taking norms?**
- Pause durations and overlap tolerance vary by culture
- Risk: Single global threshold may not work for all markets
- Mitigation: May need regional configuration profiles

**Q7: What is impact of network jitter/packet loss on turn detection?**
- PSTN and VoIP introduce variable latency and audio degradation
- Risk: Turn detection models trained on clean audio may fail on real telephony
- Mitigation: Requires testing on real phone networks, not just simulated

**Q8: How to balance barge-in responsiveness with echo cancellation quality?**
- Aggressive AEC reduces echo but may clip user speech
- Conservative AEC preserves speech but increases false positives
- Risk: Trade-off may vary by device/environment
- Mitigation: May need adaptive AEC parameters

**Q9: Should we implement different turn-taking strategies per conversation phase?**
- Example: More conservative during information gathering, more responsive during confirmation
- Risk: Adds state machine complexity
- Decision: Defer to post-V1, start with single strategy

**Q10: How to measure turn-taking quality in production without ground truth?**
- Manual labeling is expensive and slow
- Risk: May not detect regressions quickly
- Mitigation: Use proxy metrics (re-prompt rate, call duration, sentiment) + sample manual review
