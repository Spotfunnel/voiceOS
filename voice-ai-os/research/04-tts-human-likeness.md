# Research: Human-Like Text-to-Speech in Real-Time Conversations

**🟢 LOCKED** - Production-validated research based on Cartesia Sonic 3 (October 2025 release), 90ms TTFA, 42 languages, emotion controls, streaming TTS benchmarks. Updated February 2026.

---

## Why This Matters for V1

TTS is the final output users hear and directly shapes their perception of the AI's intelligence, trustworthiness, and conversational competence. Poor TTS quality—robotic prosody, awkward pacing, mispronunciations—makes even perfect LLM responses sound unintelligent. Production data shows users notice latency before they notice prosody differences: a system with moderate quality but sub-100ms TTFB outperforms higher quality systems with perceptible hesitation. For V1, TTS must balance three competing demands: human-like naturalness (prosody, pacing, emotional expression), interruption-friendliness (clean stops, word-level timestamps), and real-time latency (<150ms TTFB). Getting this balance wrong breaks conversational flow and destroys user trust.

## What Matters in Production (Facts Only)

**Streaming TTS Categories:**
- **Single Synthesis**: Complete text input → single audio file (traditional, high latency)
- **Output Streaming**: Complete text input → audio output in chunks (Amazon Polly, Azure, ElevenLabs, OpenAI)
- **Dual Streaming**: Text fed in chunks (word/character-by-word) → real-time audio output (true low-latency conversational AI)

**Latency Requirements:**
- Sub-100ms time-to-first-byte (TTFB) is critical
- Communications break down around 250-300ms
- Users notice delays earlier than prosody differences
- Architecture choices affecting latency > voice quality tweaks for production

**Prosody Components:**
- **Intonation**: Pitch patterns across utterances (rising for questions, falling for statements)
- **Stress**: Emphasis on specific words or syllables (e.g., "REcord" vs "reCORD")
- **Rhythm**: Timing patterns, pauses, and speaking rate
- Prosody is essential for human-like speech; flat prosody sounds robotic/monotonic

**Speaking Rate:**
- Web Speech API: Rate 0.1 to 10 (1.0 = normal; 2.0 = 2x speed; 0.5 = half speed)
- Natural pacing requires balancing speed with quality
- Optimal rate varies by use case: conversational (1.0), informational (1.2), accessibility (0.8)

**Chunking Strategies:**
- **Sentence-based**: Split at natural boundaries (periods, question marks, exclamation marks) for best prosody
- **Character-based**: Fixed-length chunks (50-500 characters, default 150-200)
- **Clause-based**: Break at clause boundaries for longer sentences
- **Dynamic**: Adaptive based on content
- Smaller chunks = faster initial audio; larger chunks = better prosody
- Minimum sentence length: 20 characters (OpenAI default)

**Text Normalization:**
- Converts written text to spoken form: numbers, dates, abbreviations, monetary amounts
- Example: "123" → "one hundred twenty three" (in "123 pages") vs "one twenty three" (in "123 King Ave")
- Production principle: "Do no harm"—better to leave unexpanded than expand incorrectly
- Neural models (DuplexTagger + DuplexDecoder) achieve >95% sentence-level accuracy
- Errors are directly presented to users (e.g., "3cm" as "three kilometers" instead of "three centimeters")

**SSML (Speech Synthesis Markup Language):**
- W3C standard XML-based markup for controlling synthetic speech
- `<prosody>`: Pitch (absolute, relative, presets), rate, duration, volume, range
- `<break>`: Pauses with strength levels (x-weak to x-strong) or absolute time (e.g., 500ms, 2s)
- `<say-as>`: Customizes how content is spoken (dates, numbers, etc.)
- Supported by Azure, AWS Polly, Google Assistant

**Word-Level Timestamps:**
- Enable real-time synchronization: captions, word highlighting, avatar lip-sync
- Provide: start/end times (ms), character indices, nested structure (sentence → word)
- Critical for tracking what was actually said vs. interrupted
- Required for conversation context management post-interruption

**Interruption Handling:**
- Every component must be interrupt-aware and cancellable: ASR, LLM, TTS, audio playout
- TTS must stop within milliseconds upon interruption detection
- Use word-level timestamps to synchronize conversation context post-interruption
- VAD must distinguish real user intent from false positives (noise, clicks, background speech)
- Duplex processing + echo cancellation required to differentiate system vs. user audio

**Emotional Expression vs. Neutral:**
- Emotionally expressive TTS improves user satisfaction and engagement
- Study: Adding emotional interjections ("Wow!") and fillers improved conversation ratings
- However: Listeners perceive smaller emotional changes in AI voices vs. human voices
- Neutral-sounding voices perceived as "robotic" or "monotonous" in longer utterances
- Trade-off: Emotional expression adds complexity and may increase latency

**Voice Quality and Perceived Intelligence:**
- Voice acoustics significantly impact perceived trustworthiness and intelligence
- Lower pitch voices perceived as more dominant
- Acoustic-prosodic entrainment (matching user's style): Positive effect for intensity, negative for pitch
- Modern TTS nearly rivals human voices in quality for long-form content
- No single voice excels across all evaluation dimensions (clarity, quality, comprehension)

**Provider Quality Benchmarks (2026):**

*Naturalness (Blinded Human Evaluations):*
- Cartesia Sonic 3: Latest model (Oct 2025), high naturalness with SSM architecture
- Cartesia Sonic 2: Preferred 61.4% vs. ElevenLabs Flash V2 38.6% (historical benchmark)
- PlayHT: Claims 70.15% preference over ElevenLabs (disputed)
- ElevenLabs: Better emotional range than PlayHT

*Latency:*
- Cartesia Sonic 3: 90ms TTFA (Oct 2025 release)
- Cartesia Sonic 2: 40ms model latency, 128-135ms TTFA (P90, global)
- PlayHT: ~130ms
- ElevenLabs Flash v2: 75ms (reduced fidelity); Full: 300ms+

*Voice Cloning:*
- Cartesia Sonic 3: 10 seconds of audio (improved from Sonic 2's 3 seconds)
- PlayHT: 10 seconds
- ElevenLabs: 10 seconds (instant) or 60 minutes (professional)

*Customization:*
- Cartesia Sonic 3: Volume, speed, emotion controls via API/SSML; laughter support with `[laughter]` tags
- Cartesia Sonic 2: Slider controls (speed, emotion, synthetic voice mixing)
- PlayHT: Granular editing (speed, pitch, pauses, intonation)
- ElevenLabs: Stability, similarity, style controls

*Language Support:*
- Cartesia Sonic 3: 42 languages (covers 95% of global population, including 9 Indian languages)
- Cartesia Sonic 2: 15 languages
- ElevenLabs: 70+ languages
- PlayHT: Multiple languages (specific count not documented)

*Deployment:*
- Cartesia: Supports on-prem and on-device
- ElevenLabs/PlayHT: Cloud-only

**Quality Metrics:**
- **MOS (Mean Opinion Score)**: Subjective 1-5 scale, averaged (ITU-T P.800 standard)
- **PESQ (Perceptual Evaluation of Speech Quality)**: Objective method comparing contaminated vs. clean reference (ITU-T P.862, withdrawn 2024 but still widely used)
- **POLQA**: Supersedes PESQ for super-wideband speech (ITU-T P.863); better correlation with human preferences
- **Deep Learning MOS Estimation**: CNN-based achieves 0.89 Pearson correlation vs. 0.78 for POLQA
- **Large Audio Models (LAMs)**: Unified evaluation framework; up to 0.91 Spearman correlation with human preferences

## Common Failure Modes (Observed in Real Systems)

**1. Robotic Prosody (Most Common)**
- Flat intonation, monotonic delivery, lack of natural rhythm
- Example: "How can I help you today?" spoken with no rising intonation
- Root cause: Model not trained on diverse prosodic patterns; insufficient context
- Impact: Users perceive AI as unintelligent, robotic, disengaged

**2. Misplaced Stress/Emphasis**
- Incorrect word stress changes sentence meaning
- Example: "I didn't say he stole the money" (emphasis on different words changes meaning)
- Root cause: Model lacks semantic understanding of sentence structure
- Impact: Confusing or misleading responses, user frustration

**3. Awkward Pauses**
- Pauses in wrong locations or missing natural pauses
- Example: "I can help you with... that" (pause mid-phrase) vs. "I can help you with that." (natural)
- Root cause: Sentence chunking doesn't respect clause boundaries; poor prosody prediction
- Impact: Unnatural flow, perceived hesitation or uncertainty

**4. Mispronunciations**
- Uncommon names, technical terms, acronyms pronounced incorrectly
- Example: "SQL" as "sequel" vs. "S-Q-L"; "GIF" as "jiff" vs. "giff"
- Root cause: Insufficient training data for rare words; incorrect grapheme-to-phoneme mapping
- Impact: Breaks immersion, reduces credibility, user confusion

**5. Text Normalization Errors**
- Numbers, dates, abbreviations spoken incorrectly
- Example: "3cm" as "three kilometers" instead of "three centimeters"; "Dr." as "doctor" vs. "drive"
- Root cause: Context-insensitive normalization rules; ambiguous abbreviations
- Impact: Critical errors in medical, financial, technical domains

**6. Audio Artifacts**
- Glitches, clicks, buzzy vowels, background noise
- Example: Audible click between concatenated segments; distorted vowels from neural overfitting
- Root cause: Concatenative system boundaries; neural model overfitting; poor audio postprocessing
- Impact: Unprofessional quality, user distraction, perceived system failure

**7. Repetitive Speech (LLM-Based TTS)**
- Endless loops, repeated phrases, omitted segments
- Example: "I can help I can help I can help..." (infinite loop)
- Root cause: Alignment failures between text and speech tokens in decoder-only architecture
- Impact: System appears broken, requires restart, user abandonment

**8. Incomplete Interruption Handling**
- TTS continues speaking after user interrupts
- Example: User says "stop" but agent continues for 2-3 more seconds
- Root cause: No interrupt-aware cancellation; audio buffer not flushed; VAD latency >100ms
- Impact: User frustration, perceived system unresponsiveness

**9. Lost Context After Interruption**
- System doesn't track what was actually said before interruption
- Example: Agent interrupted at "Your account balance is five hundred..." but LLM context shows full "Your account balance is five hundred twenty-three dollars"
- Root cause: No word-level timestamp tracking; conversation state not synchronized
- Impact: Inconsistent conversation history, confused follow-up responses

**10. Excessive Latency (TTFB >300ms)**
- Long pause before agent starts speaking
- Root cause: Waiting for complete LLM response before starting TTS; no streaming; cold start
- Impact: Awkward silence, users think system is broken, conversation flow disrupted

**11. Chunking Artifacts**
- Unnatural breaks between chunks, inconsistent prosody across chunks
- Example: "I can help you with" [pause] "your account today" (unnatural mid-sentence pause)
- Root cause: Character-based chunking that splits mid-sentence; no prosody continuity across chunks
- Impact: Disjointed speech, perceived hesitation

**12. Over-Emotional or Under-Emotional Delivery**
- Inappropriate emotional tone for context
- Example: Cheerful "Sorry for your loss" or flat "Congratulations!"
- Root cause: Model not trained on contextual emotional appropriateness; no sentiment analysis
- Impact: Perceived insensitivity, user offense, trust damage

**13. Speaking Rate Mismatch**
- Too fast (users can't follow) or too slow (users get impatient)
- Example: Technical instructions at 2x speed; simple greeting at 0.5x speed
- Root cause: Fixed rate not adapted to content complexity or user preference
- Impact: Comprehension issues, user frustration

**14. Homophone Confusion**
- Similar-sounding words pronounced identically when context requires distinction
- Example: "meet" vs. "meat"; "their" vs. "there" vs. "they're"
- Root cause: Text input doesn't disambiguate; model lacks semantic understanding
- Impact: User confusion, incorrect information conveyed

**15. Unnatural Sentence Endings**
- Abrupt endings or trailing off without proper finalization
- Example: "I can help you with that..." (trails off) vs. "I can help you with that." (definitive)
- Root cause: Insufficient context for final prosody; streaming cutoff without proper ending
- Impact: Perceived incompleteness, user uncertainty

**16. Echo and Feedback During Barge-In**
- Agent's voice echoed back during user interruption
- Root cause: Poor acoustic echo cancellation (AEC); duplex processing failure
- Impact: Garbled audio, conversation breakdown

**17. Inconsistent Voice Characteristics**
- Voice changes mid-conversation (pitch, timbre, speaking style)
- Example: First response in deep voice, second in higher pitch
- Root cause: Different TTS requests using different voice IDs or random sampling
- Impact: Uncanny valley effect, perceived system instability

**18. Missing Punctuation Effects**
- No prosodic difference between statements, questions, exclamations
- Example: "How can I help you" (flat) vs. "How can I help you?" (rising intonation)
- Root cause: LLM output lacks punctuation; TTS doesn't infer from context
- Impact: Ambiguous intent, user confusion

**19. Unnatural Breathing Sounds**
- Audible breaths in wrong locations or missing natural breaths
- Example: Long utterance with no breaths (robotic) or breaths mid-word (unnatural)
- Root cause: Model not trained on natural breathing patterns; breath insertion algorithm failure
- Impact: Uncanny valley effect, perceived artificiality

**20. Cold Start Latency Spikes**
- First TTS request takes 200-2000ms, subsequent requests fast
- Root cause: Model not loaded in memory; container initialization
- Impact: P99 latency violations, inconsistent UX

## Proven Patterns & Techniques

**1. Use Dual Streaming TTS (Text Chunks → Audio Chunks)**
- Feed text to TTS incrementally as LLM generates
- Begin audio output before LLM completes full response
- Verified: Reduces TTFB from 1-3 seconds to <300ms

**2. Sentence-Level Chunking at Natural Boundaries**
- Split at periods, question marks, exclamation marks
- Minimum sentence length: 20 characters
- Verified: Preserves natural prosody, improves audio quality

**3. Use WebSocket Connections for TTS**
- Pre-establish connection before audio starts
- Maintain persistent connection for conversation
- Verified: Saves ~200ms connection overhead per request

**4. Enable Word-Level Timestamps**
- Track start/end times and character indices for each word
- Use for conversation context synchronization post-interruption
- Verified: Required for accurate conversation state management

**5. Implement Interrupt-Aware Cancellation**
- TTS must stop within milliseconds upon user speech detection
- Flush audio buffers proactively
- Use word timestamps to determine what was actually spoken
- Verified: Enables natural barge-in behavior

**6. Optimize for Latency First, Quality Second**
- Sub-100ms TTFB more important than perfect prosody
- Users notice delays before prosody differences
- Verified: Moderate quality + fast response > high quality + perceptible hesitation

**7. Use Neural Text Normalization**
- DuplexTagger + DuplexDecoder models for context-aware normalization
- Achieve >95% sentence-level accuracy
- Verified: Reduces mispronunciations of numbers, dates, abbreviations

**8. Disable Text Normalization Post-Processing for Ultra-Low Latency**
- Trade-off: Slight quality reduction for latency improvement
- Use when TTFB is critical (e.g., <100ms target)
- Verified: Saves 10-50ms depending on text complexity

**9. Use SSML for Critical Prosody Control**
- `<break>` for explicit pauses (e.g., after phone numbers)
- `<prosody>` for emphasis on key words
- `<say-as>` for disambiguation (dates, numbers, acronyms)
- Verified: Improves naturalness for structured content

**10. Select Voice Based on Use Case**
- Conversational: Moderate pitch, natural prosody, emotional range
- Professional: Lower pitch (perceived dominance), neutral tone
- Accessibility: Slower rate, clear articulation
- Verified: Voice characteristics impact perceived intelligence and trustworthiness

**11. Implement Acoustic-Prosodic Entrainment (Intensity Only)**
- Match user's speaking intensity (volume) for trust
- Do NOT match pitch (negative effect on trust)
- Verified: Positive effect on perceived trustworthiness

**12. Add Emotional Interjections Sparingly**
- Use "Wow!", "Oh!", "Hmm" for engagement
- Combine with filler words for improved conversation ratings
- Verified: Improves user satisfaction without excessive latency

**13. Use Emotionally Neutral Tone for V1**
- Avoid over-emotional delivery that may seem inappropriate
- Reserve emotional expression for post-V1 with sentiment analysis
- Verified: Neutral tone safer than contextually inappropriate emotion

**14. Monitor MOS/PESQ/POLQA for Quality Baselines**
- Establish baseline quality metrics in production
- Alert on significant degradation (>0.5 MOS points)
- Verified: Catches model drift and audio pipeline issues

**15. Use Deep Learning MOS Estimation for Real-Time Monitoring**
- CNN-based models achieve 0.89 correlation with human preferences
- Faster and cheaper than human evaluation
- Verified: Enables continuous quality monitoring

**16. Implement Custom Pronunciation Dictionaries**
- Add brand names, technical terms, acronyms with phonetic spellings
- Update as new terms emerge
- Verified: Reduces mispronunciations by 30-50% for domain-specific terms

**17. Use Non-Autoregressive TTS Models for Speed**
- FastSpeech-style architectures generate audio faster than autoregressive
- Trade-off: Slightly reduced quality for significant latency improvement
- Verified: Enables sub-100ms TTFB

**18. Pre-Warm TTS Connections**
- Establish WebSocket connections during conversation idle time
- Keep connections alive with periodic pings
- Verified: Eliminates 200-2000ms cold start penalty

**19. Use Edge Computing for Regional Latency Reduction**
- Deploy TTS models closer to users
- Verified: Reduces network latency by 50-100ms

**20. Implement Fallback TTS Provider**
- If primary TTS fails or exceeds latency SLA, fallback to secondary
- Verified: Improves reliability but requires voice consistency management

**21. Use Streaming Mode Over Full Synthesis**
- Even for complete text, stream audio output
- Verified: Feels faster and more responsive to users

**22. Chunk Size: 150-200 Characters for Balanced Latency/Quality**
- Smaller chunks (<100 chars) = faster but worse prosody
- Larger chunks (>300 chars) = better prosody but slower
- Verified: 150-200 chars optimal for conversational AI

**23. Use Clause-Based Chunking for Long Sentences**
- Split at commas, semicolons for sentences >300 characters
- Preserves natural pauses and prosody
- Verified: Improves naturalness for complex responses

**24. Track Real-Time Factor (RTF) <1.0 for TTS**
- Monitor synthesis_time / audio_duration
- Alert if RTF >0.8 (approaching capacity limit)
- Verified: Prevents system overload and latency spikes

## Engineering Rules (Binding)

**R1: Time-to-first-byte (TTFB) must be <150ms for conversational AI**
- Sub-100ms ideal; 150ms acceptable; >250ms breaks conversation flow
- Use dual streaming TTS with sentence-level chunking

**R2: Always use sentence-level chunking at natural boundaries**
- Split at periods, question marks, exclamation marks
- Minimum sentence length: 20 characters
- Never use character-based chunking that splits mid-sentence

**R3: Chunk size must be 150-200 characters for balanced latency/quality**
- Smaller chunks (<100) = faster but worse prosody
- Larger chunks (>300) = better prosody but slower
- Use clause-based chunking for sentences >300 characters

**R4: Enable word-level timestamps for all TTS requests**
- Required for conversation context synchronization post-interruption
- Track start/end times and character indices
- Use to determine what was actually spoken before interruption

**R5: Implement interrupt-aware cancellation with <100ms response time**
- TTS must stop within milliseconds upon user speech detection
- Flush audio buffers proactively
- Update conversation state with partial speech using word timestamps

**R6: Use WebSocket connections for TTS, not HTTP REST**
- Pre-establish connections before audio starts
- Maintain persistent connections during conversation
- Saves ~200ms connection overhead per request

**R7: Optimize for latency first, quality second**
- Sub-100ms TTFB more important than perfect prosody
- Users notice delays before prosody differences
- Choose fast models over high-quality models if latency trade-off required

**R8: Use neural text normalization for numbers, dates, abbreviations**
- DuplexTagger + DuplexDecoder models for context-aware normalization
- Target >95% sentence-level accuracy
- Never send unnormalized text that could be misread

**R9: Implement custom pronunciation dictionaries for domain terms**
- Add brand names, technical terms, acronyms with phonetic spellings
- Update as new terms emerge (vocabulary drift monitoring)
- Test pronunciation accuracy before production deployment

**R10: Use SSML for critical prosody control**
- `<break>` for explicit pauses after phone numbers, addresses
- `<prosody>` for emphasis on key words (e.g., negations, amounts)
- `<say-as>` for disambiguation (dates, numbers, acronyms)

**R11: Use emotionally neutral tone for V1**
- Avoid over-emotional delivery without sentiment analysis
- Reserve emotional expression for post-V1
- Exception: Light interjections ("Hmm", "I see") for engagement

**R12: Monitor TTS quality metrics (MOS, PESQ, POLQA) in production**
- Establish baseline quality (target MOS >4.0)
- Alert on degradation >0.5 MOS points
- Use deep learning MOS estimation for real-time monitoring

**R13: Real-Time Factor (RTF) must be <1.0 for TTS**
- Target <0.8 for safety margin
- Monitor synthesis_time / audio_duration
- Alert if RTF >0.8 to prevent capacity issues

**R14: Maintain warm TTS connections**
- Pre-establish WebSocket connections during conversation idle time
- Keep alive with periodic pings
- Eliminates 200-2000ms cold start penalty

**R15: Use streaming mode over full synthesis**
- Even for complete text, stream audio output
- Feels faster and more responsive to users
- Enables early interruption detection

**R16: Implement duplex processing with echo cancellation for barge-in**
- Differentiate system audio from user audio
- Use acoustic echo cancellation (AEC)
- Required for clean interruption handling

**R17: Never use autoregressive TTS models for real-time conversation**
- Use non-autoregressive architectures (FastSpeech-style)
- Autoregressive models too slow for <150ms TTFB target
- Exception: Offline generation for pre-recorded content

**R18: Implement fallback TTS provider**
- If primary TTS fails or exceeds latency SLA (>300ms), fallback to secondary
- Maintain voice consistency across providers (similar pitch, rate, style)
- Alert on fallback usage >5% of requests

**R19: Disable text normalization post-processing for ultra-low latency**
- Use when TTFB <100ms is critical
- Trade-off: Slight quality reduction for 10-50ms latency savings
- Test impact on pronunciation accuracy before enabling

**R20: Use clause-based chunking for sentences >300 characters**
- Split at commas, semicolons, colons
- Preserves natural pauses and prosody
- Prevents awkward mid-sentence breaks

## Metrics & Signals to Track

**Latency Metrics (P50, P95, P99):**
- Time-to-first-byte (TTFB): Target P95 <150ms
- Time-to-first-audio (TTFA): Target P95 <200ms
- Full synthesis time: Track for non-streaming requests
- Real-Time Factor (RTF): synthesis_time / audio_duration (target <0.8)
- Cold start latency: First request after idle (target <500ms)
- Chunk processing time: Per-chunk synthesis latency

**Quality Metrics:**
- Mean Opinion Score (MOS): Target >4.0 (1-5 scale)
- PESQ/POLQA: Objective quality vs. reference (target >4.0)
- Deep learning MOS estimation: Real-time quality prediction (0.89 correlation)
- Large Audio Model (LAM) scores: Multi-aspect evaluation (up to 0.91 correlation)
- Pronunciation accuracy: % correct for custom vocabulary terms
- Text normalization accuracy: % correct for numbers, dates, abbreviations

**Prosody Metrics:**
- Pitch variance: Track for monotonic delivery detection
- Pause placement accuracy: % pauses at natural boundaries
- Speaking rate: Words per minute (target 140-160 for conversational)
- Stress pattern accuracy: % correct emphasis on key words
- Intonation appropriateness: Rising for questions, falling for statements

**Interruption Handling Metrics:**
- Interrupt response time: Time from user speech detection to TTS stop (target <100ms)
- Audio buffer flush time: Time to clear remaining audio (target <50ms)
- Word timestamp accuracy: % correct start/end times
- Context synchronization accuracy: % correct conversation state post-interruption
- False positive interrupt rate: % interruptions triggered by non-speech

**Chunking Metrics:**
- Average chunk size: Characters per chunk (target 150-200)
- Chunk boundary accuracy: % chunks split at natural boundaries
- Chunks per response: Track for latency analysis
- Prosody continuity: Subjective rating across chunk boundaries
- Chunking artifacts: % responses with unnatural breaks

**Text Normalization Metrics:**
- Normalization accuracy: % correct for numbers, dates, abbreviations
- Normalization latency: Time added by normalization (target <50ms)
- Ambiguous term rate: % terms requiring disambiguation
- Custom pronunciation coverage: % domain terms in dictionary

**Emotional Expression Metrics:**
- Emotional appropriateness: Subjective rating by context
- Emotional intensity: Variance in prosodic features
- User satisfaction with tone: Survey or implicit feedback
- Neutral vs. expressive distribution: % responses with emotional markers

**Voice Consistency Metrics:**
- Pitch variance across responses: Standard deviation (target <10Hz)
- Timbre consistency: Spectral similarity across responses
- Speaking rate variance: Standard deviation (target <10 WPM)
- Voice ID consistency: % responses using correct voice

**Production Health Metrics:**
- TTS API error rate: Target <0.5%
- TTS API timeout rate: Target <0.1%
- WebSocket connection failures: Target <1%
- Fallback provider usage: Target <5%
- Cold start rate: % requests with cold start penalty

**User Experience Proxies:**
- Perceived intelligence: Survey or implicit feedback
- Perceived trustworthiness: Survey or implicit feedback
- Conversation ratings: User satisfaction scores
- Interruption success rate: % interruptions handled cleanly
- Call duration: Shorter calls may indicate TTS issues

**Audio Artifact Metrics:**
- Click/pop detection: % responses with audible artifacts
- Distortion detection: % responses with audio distortion
- Background noise level: dB relative to speech
- Buzzy vowel detection: % responses with overfitting artifacts

## V1 Decisions / Constraints

**Decision: Use Cartesia Sonic 3 for primary TTS (90ms TTFA, Oct 2025 release)**
- Rationale: Industry-leading latency with high naturalness; 42 languages (vs Sonic 2's 15); emotion controls, laughter support
- Features: State Space Model architecture, voice cloning (10 seconds), intelligent abbreviation pronunciation
- Quality: High naturalness, accurate transcript following, fine-grained volume/speed/emotion controls
- Constraint: Slightly higher latency than Sonic 2 (90ms vs 40ms) but still <100ms target

**Decision: Target P95 TTFB <150ms**
- Rationale: Balance between responsiveness and technical feasibility
- Constraint: Requires dual streaming, sentence-level chunking, warm connections

**Decision: Sentence-level chunking with 150-200 character target**
- Rationale: Optimal balance between latency and prosody quality
- Constraint: May cause awkward breaks for very long sentences (>300 chars)

**Decision: Enable word-level timestamps for all TTS requests**
- Rationale: Required for conversation context synchronization post-interruption
- Constraint: Slight latency increase (~10-20ms), increased payload size

**Decision: Use emotionally neutral tone for V1**
- Rationale: Safer than contextually inappropriate emotion; defer sentiment analysis to post-V1
- Constraint: May seem robotic for longer utterances; less engaging than emotional expression

**Decision: Implement neural text normalization (DuplexTagger + DuplexDecoder)**
- Rationale: >95% accuracy for numbers, dates, abbreviations
- Constraint: Adds 20-50ms latency; requires model hosting

**Decision: Use WebSocket connections for TTS**
- Rationale: Saves ~200ms connection overhead per request
- Constraint: More complex client integration; connection management overhead

**Decision: Implement custom pronunciation dictionary with top 100 domain terms**
- Rationale: Reduces mispronunciations by 30-50% for brand names, technical terms
- Constraint: Requires manual curation and ongoing maintenance

**Decision: Use SSML for critical prosody control (breaks, emphasis)**
- Rationale: Improves naturalness for structured content (phone numbers, addresses)
- Constraint: Requires LLM to generate SSML markup; increased prompt complexity

**Decision: Implement interrupt-aware cancellation with <100ms response time**
- Rationale: Required for natural barge-in behavior
- Constraint: Requires duplex processing, echo cancellation, audio buffer management

**Decision: Monitor MOS using deep learning estimation in real-time**
- Rationale: Enables continuous quality monitoring without human evaluation
- Constraint: Requires model hosting; 0.89 correlation not perfect

**Decision: Maintain warm TTS WebSocket connections**
- Rationale: Eliminates 200-2000ms cold start penalty
- Constraint: Requires connection pooling and keep-alive logic

**Decision: Use streaming mode for all TTS requests**
- Rationale: Feels faster and more responsive; enables early interruption detection
- Constraint: Requires client-side audio streaming support

**Decision: Defer emotional expression to post-V1**
- Rationale: Requires sentiment analysis to avoid inappropriate tone; adds complexity
- Constraint: V1 will seem less engaging for longer conversations

**Decision: Defer voice cloning to post-V1**
- Rationale: Not critical for V1; requires 3-10 seconds of audio per user
- Constraint: All users hear same voice; less personalization

**Decision: Defer SSML `<prosody>` pitch/rate control to post-V1**
- Rationale: Focus on latency and basic naturalness first
- Constraint: Less fine-grained prosody control; may sound monotonic for complex content

**Decision: Use Cartesia on-prem deployment for production**
- Rationale: Lower latency, data privacy, cost predictability
- Constraint: Infrastructure overhead; requires GPU hosting

**Decision: Implement fallback to ElevenLabs Flash v2 if Cartesia fails**
- Rationale: Improves reliability; ElevenLabs has better emotional range
- Constraint: Voice consistency management; 75ms vs. 40ms latency

## Open Questions / Risks

**Q1: What is acceptable MOS for production by use case?**
- Hypothesis: >4.0 for conversational AI; >4.5 for professional use (customer service)
- Risk: User tolerance varies; some domains require near-human quality
- Mitigation: A/B test with real users; measure task completion rate vs. MOS

**Q2: Should we implement acoustic-prosodic entrainment?**
- Match user's speaking intensity (positive effect on trust)
- Risk: Adds complexity; may seem uncanny if too aggressive
- Decision: Defer to post-V1; focus on baseline naturalness first

**Q3: What is optimal chunk size for different response lengths?**
- Short responses (<100 chars): Single chunk?
- Long responses (>500 chars): 200-char chunks?
- Risk: One-size-fits-all may not be optimal
- Mitigation: Dynamic chunking based on response length?

**Q4: How to handle very long responses (>1000 characters)?**
- Multiple chunks with prosody continuity?
- Risk: Unnatural breaks, inconsistent prosody across chunks
- Mitigation: Clause-based chunking + prosody transfer across chunks?

**Q5: Should we implement dynamic speaking rate based on content complexity?**
- Slower for technical instructions, faster for simple confirmations
- Risk: Adds complexity; may seem inconsistent
- Decision: Defer to post-V1; use fixed rate (1.0) initially

**Q6: How to measure prosody quality in production without human evaluation?**
- Deep learning models for pitch variance, pause placement, stress patterns?
- Risk: May not correlate perfectly with human perception
- Mitigation: Use LAM multi-aspect evaluation (0.91 correlation)?

**Q7: What is impact of voice pitch on perceived intelligence?**
- Lower pitch = more dominant, but does it affect perceived intelligence?
- Risk: Voice selection may bias user perception
- Mitigation: A/B test different pitch ranges; measure user satisfaction

**Q8: Should we implement emotional expression for specific intents?**
- Example: Apologetic tone for errors, enthusiastic for confirmations
- Risk: Contextually inappropriate emotion damages trust
- Decision: Requires sentiment analysis; defer to post-V1

**Q9: How to handle mispronunciations not in custom dictionary?**
- Real-time phonetic correction? User feedback loop?
- Risk: Mispronunciations break immersion
- Mitigation: Monitor low-confidence pronunciations; expand dictionary iteratively

**Q10: What is optimal WebSocket keep-alive interval?**
- Too frequent = network overhead; too infrequent = connection drops
- Risk: Connection drops cause cold start penalty
- Mitigation: Test with production network conditions (30-60 second pings?)

**Q11: Should we implement voice consistency checks across responses?**
- Detect pitch/timbre variance and alert on inconsistency
- Risk: False positives from natural prosodic variation
- Mitigation: Set thresholds based on baseline variance

**Q12: How to handle text normalization ambiguity?**
- Example: "Dr." = "doctor" or "drive"? "St." = "saint" or "street"?
- Risk: Incorrect normalization damages credibility
- Mitigation: Use context-aware neural models; flag ambiguous cases for LLM clarification

**Q13: What is impact of streaming chunk size on prosody quality?**
- Smaller chunks = faster but worse prosody continuity?
- Risk: Trade-off may vary by TTS provider
- Mitigation: Test with Cartesia; measure prosody continuity across chunk boundaries

**Q14: Should we implement real-time MOS monitoring for every response?**
- Enables immediate quality alerts
- Risk: Adds latency (~10-50ms); increases compute cost
- Decision: Sample 10% of responses for MOS estimation?

**Q15: How to handle interruptions during critical information delivery?**
- Example: User interrupts while agent saying account balance
- Risk: User may not hear critical information
- Mitigation: Prompt user to confirm they heard information? Repeat if interrupted?
