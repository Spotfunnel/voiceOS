# Research: Streaming Speech-to-Text Best Practices for Live Calls

**🟢 LOCKED** - Production-validated research based on Deepgram Nova-3 (January 2026 refinements), phone audio constraints (8kHz PSTN), streaming STT benchmarks. Updated February 2026.

---

## Why This Matters for V1

Streaming STT is the first component in the voice AI pipeline and sets the foundation for everything downstream. Poor STT quality cascades: incorrect transcripts lead to wrong LLM responses, wasted API costs, and user frustration. For phone-based voice AI, STT must handle PSTN constraints (8kHz narrowband audio), background noise, diverse accents, and real-time latency requirements simultaneously. Production data shows STT accuracy degrades 16-20% for non-native accents and doubles error rates when SNR falls from 15dB to 5dB. Getting streaming STT right—with proper partial/final handling, endpointing, and noise robustness—is non-negotiable for V1.

## What Matters in Production (Facts Only)

**Streaming STT Architecture:**
- Continuous audio processing pipeline: Capture → Preprocessing → Buffering (50-200ms chunks) → Feature extraction → Acoustic model → Language model → Incremental results
- Real-time neural network processing through acoustic and language models
- Requires 16kHz audio with minimal buffering for low latency

**Partial vs. Final Transcripts:**
- **Partial (Interim) Results**: Preliminary transcriptions delivered in real-time as audio streams in; marked with `is_partial: true` or `IsPartial: true`
- **Final Results**: Complete, corrected transcription after endpointing; marked with `is_final: true` or `IsPartial: false`
- Final results include word-level confidence scores and timing metadata (StartTime, EndTime)
- Speech recognition revises words with additional context, so partials change until finalization
- Example progression: "The" → "The Amazon" → "The Amazon is" → "The Amazon is the largest rainforest on the planet." (final)

**Latency Measurement Milestones:**
- **Time to First Byte (TTFB)**: Speech start to first partial transcript (target: P95 ≤300ms for 3-second utterances)
- **Partial update cadence**: Frequency of interim results (typically 100-200ms intervals)
- **Final latency**: Complete transcription after endpointing (target: P95 ≤800ms for 3-second utterances)
- **Real-Time Factor (RTF)**: processing_time / audio_duration (target: <1.0 in production; <0.8 for safety margin)

**Phone Audio (PSTN) Constraints:**
- PSTN uses 8kHz sampling rate as native standard for narrowband voice
- Best practice: Send audio at native 8kHz rate, do NOT resample to higher rates
- Common codecs: AMR (Adaptive Multi-Rate Narrowband), MULAW (8-bit PCM), LINEAR16 (preferred when possible)
- Specialized phone models trained on telephony audio required for optimal accuracy
- Lower sampling rates (8kHz) reduce accuracy vs. 16kHz, but resampling introduces artifacts

**Accuracy vs. Latency Trade-off:**
- Fundamental tension: Accuracy requires context (past and future words), which adds latency
- Providers typically reduce latency by sacrificing accuracy
- Total cloud STT latency: 500-1200ms typical
- Latency sources: Network (20-3000ms+), endpointing (300-2000ms), audio buffering (100-500ms), model processing (50-300ms), cold starts (200-2000ms)
- Natural turn-taking occurs at 100-300ms gaps (occasionally to 700ms)
- Humans need 400-500ms to speak a word, so sub-100ms claims are misleading

**Chunk Size and Buffering:**
- Optimal chunk size: 50-200ms per message (100-450ms optimal for AssemblyAI)
- Chunk size formula: `(chunk_duration_ms / 1000) × sample_rate × 2` bytes
- Example (16kHz, 100ms): (100/1000) × 16,000 × 2 = 3,200 bytes
- Byte alignment: Single-channel PCM = even number of bytes; dual-channel = multiple of 4 bytes
- Smaller chunks reduce latency; larger chunks improve stability
- Audio buffering contributes 100-500ms of total latency

**Endpointing and Silence Detection:**
- Voice Activity Detection (VAD) assigns probability scores to audio chunks to identify speech presence
- Endpointing detects when user has finished speaking (end-of-utterance)
- Key parameters:
  - VAD threshold: Sensitivity (default: 0.55)
  - Min silence duration: 700-1000ms typical (default: 1000ms)
  - Min speech duration: 250ms typical
  - End-of-speech threshold: 0.3 typical
  - Speech padding: 500ms typical
- VAD onset/offset tuning by audio type:
  - Normal audio: onset 0.5, offset 0.3
  - Noisy audio: onset 0.3, offset 0.1
  - High-quality: onset 0.7, offset 0.5
- Lower thresholds include more speech but increase false positives (hallucinations)

**Noise Handling:**
- Noise significantly degrades accuracy: WER doubles when SNR falls from 15dB to 5dB
- Background levels >90dBA cause severe degradation
- **Noise Reduction Paradox**: Standard noise reduction preprocessing often HURTS accuracy rather than improves it
- Modern STT models perform better on raw, unprocessed noisy audio
- Most effective strategy: Train models on realistic, diverse noise datasets
- Preprocessing (limited role): Spectral subtraction, noise gates, VAD for segment isolation
- Production testing must use realistic acoustic conditions (HVAC, overlapping speakers, handset compression)

**Accent and Dialect Handling:**
- Error rates 16-20% higher for non-native accents vs. standard native accents
- Acoustic variability: Regional accents affect phoneme articulation (vowel/consonant pronunciation)
- Linguistic diversity: Dialects introduce unique vocabulary and grammar
- Data entanglement: Speaker, language, accent attributes highly correlated in training data
- Solution: Expand training data diversity; collaborate with linguistic experts
- Bias toward dominant accents excludes minority groups

**Confidence Scores:**
- Range: 0.0 to 1.0 (higher = more confident)
- Available at transcript level and word level (word-level requires explicit enabling)
- Use as comparative values, not absolute metrics
- Example: 0.95 vs 0.65 = low ambiguity; 0.75 vs 0.72 = high ambiguity requiring disambiguation
- Low confidence triggers: Noise, poor signal quality, ambiguous audio, out-of-vocabulary words

**Custom Vocabulary and Domain Adaptation:**
- Custom vocabularies boost recognition of specific words across all contexts
- Use for: Brand names, acronyms, technical jargon, proper names
- Specify: Custom pronunciations (how words sound) and display forms (how words appear)
- Word boost: Specify terms/phrases that should be recognized more frequently
- Custom language models: Capture contextual meaning for homophones and domain-specific speech
- Limit: Up to 2500 characters of custom vocabulary (AssemblyAI)

**Provider-Specific Configuration:**

*AssemblyAI:*
- Encoding: PCM16 (default) or Mu-law
- Sample rate: Configurable
- Single-channel audio
- 100-2000ms per message (100-450ms optimal)
- End utterance silence threshold: 700ms default
- Word boost: Up to 2500 characters
- Multilingual: English, Spanish, French, German, Italian, Portuguese

*Deepgram:*
- Model: nova-3 (optimized for latency)
- Encoding: linear16
- Sample rate: 16000
- Channels: 1
- Punctuate: true
- Interim results: true
- Endpointing configuration available

*Google Cloud:*
- Encoding: LINEAR16, MULAW, AMR
- Sample rate: 8000 (phone) or 16000 (standard)
- Phone model: Specialized for telephony audio
- Word confidence: Requires explicit enabling
- Model adaptation: Word/phrase boost, custom language models

## Common Failure Modes (Observed in Real Systems)

**1. Acoustic Drift (Most Insidious)**
- Changes in noise levels and signal conditions mask recognition performance over time
- Example: Call center moves to new building with different HVAC; WER increases 5-10% but goes unnoticed
- Root cause: Models trained on different acoustic environment than production
- Impact: Gradual accuracy degradation without obvious trigger

**2. Codec Drift**
- Audio encoding changes alter what models receive
- Example: Telephony provider switches from MULAW to AMR; transcripts degrade
- Root cause: Model not trained on new codec format
- Impact: Sudden accuracy drop after infrastructure change

**3. Vocabulary Drift**
- New domain-specific terms go unrecognized
- Example: Product name changes from "ProMax" to "ProMax Ultra"; STT transcribes as "pro max ultra" (incorrect capitalization/spacing)
- Root cause: Custom vocabulary not updated with new terms
- Impact: Incorrect entity extraction, failed intent recognition

**4. Population Drift**
- Shifts in speaker demographics degrade model performance
- Example: Call center expands to new region with different accent distribution
- Root cause: Training data doesn't represent new population
- Impact: 16-20% higher error rates for underrepresented accents

**5. Partial Result Instability**
- Partial transcripts change dramatically between updates, causing UI flicker or incorrect intent detection
- Example: Partial "I want to cancel" → "I want to can" → "I want to cancel" (final)
- Root cause: Insufficient context window or aggressive partial stabilization
- Impact: Premature LLM processing on incorrect partials, wasted API costs

**6. Premature Finalization (False Endpointing)**
- System finalizes transcript during mid-utterance pause
- Example: "My account number is... [checking phone] ...4-5-6-7" finalizes after "is"
- Root cause: Min silence duration too short (e.g., 500ms instead of 1000ms)
- Impact: Incomplete transcripts sent to LLM, user must repeat

**7. Delayed Finalization (Excessive Silence Wait)**
- System waits too long before finalizing, causing awkward pauses
- Example: User finishes speaking, 2-second silence before agent responds
- Root cause: Min silence duration too long (e.g., 2000ms)
- Impact: Conversation feels laggy, users think system is broken

**8. Noise False Positives (Hallucinations)**
- Background noise transcribed as speech
- Example: HVAC hum transcribed as "mmm" or "uh"; keyboard clicks as "tick tick tick"
- Root cause: VAD threshold too low or insufficient noise training
- Impact: Garbage text sent to LLM, confused responses

**9. Noise False Negatives (Clipped Speech)**
- Actual speech not detected due to low volume or noise masking
- Example: Soft-spoken user's words dropped; "I need help with my account" → "need help account"
- Root cause: VAD threshold too high
- Impact: Missing critical words, incorrect intent

**10. Accent Misrecognition**
- Strong accents transcribed incorrectly
- Example: Indian accent "thirty" transcribed as "dirty"; Scottish "can't" as "kant"
- Root cause: Model not trained on accent diversity
- Impact: 16-20% higher WER, user frustration, failed transactions

**11. Homophone Confusion**
- Similar-sounding words transcribed incorrectly without context
- Example: "I want to buy four" vs. "I want to buy for"; "meet" vs. "meat"
- Root cause: Insufficient language model context or custom vocabulary
- Impact: Wrong entity values, failed transactions

**12. Low Confidence Cascade**
- Low-confidence transcripts processed without verification
- Example: Confidence 0.45 transcript "cancel my order" processed as-is; user actually said "can't sell my order"
- Root cause: No confidence threshold checking before LLM processing
- Impact: Incorrect actions, user harm

**13. Chunk Size Mismatch**
- Audio chunks too large (>500ms) or too small (<50ms)
- Too large: Increased latency, delayed partials
- Too small: Network overhead, processing inefficiency, increased errors
- Root cause: Incorrect buffering configuration
- Impact: Latency spikes or degraded accuracy

**14. Cold Start Latency Spikes**
- First request after idle period incurs 200-2000ms penalty
- Root cause: Model not loaded in memory, container initialization
- Impact: P99 latency violations, inconsistent UX

**15. Resampling Artifacts**
- Phone audio (8kHz) resampled to 16kHz introduces distortion
- Root cause: Misunderstanding of best practices (thinking higher sample rate = better)
- Impact: Degraded accuracy vs. sending native 8kHz

**16. Missing Silence Encoding**
- Stream doesn't send audio during silence periods
- Root cause: Client-side VAD drops silent frames
- Impact: STT loses timing context, endpointing fails

**17. Lossy Codec Degradation**
- Using MP3, MP4, M4A instead of lossless formats
- Root cause: Bandwidth optimization without considering accuracy impact
- Impact: Reduced accuracy, especially combined with background noise

**18. Overlapping Speech**
- Multiple speakers talking simultaneously
- Example: Call center agent and customer speak at same time
- Root cause: Single-channel audio without speaker diarization
- Impact: Garbled transcripts, high WER

**19. Echo and Feedback**
- Agent's voice echoed back through customer's microphone
- Root cause: Poor acoustic echo cancellation (AEC)
- Impact: Duplicate transcription of agent speech, confused conversation state

**20. Custom Vocabulary Overfit**
- Too many custom terms cause false positives
- Example: Adding "cancel" to vocabulary causes "can't sell" → "cancel"
- Root cause: Overly aggressive word boost without testing
- Impact: Incorrect transcriptions of similar-sounding phrases

## Proven Patterns & Techniques

**1. Use Streaming STT, Not Batch**
- Stream audio in real-time rather than waiting for complete utterances
- Verified: Eliminates waiting time, enables partial results for responsive UX

**2. Optimal Chunk Size: 100-200ms**
- Balance latency (smaller chunks) vs. stability (larger chunks)
- Use formula: `(chunk_duration_ms / 1000) × sample_rate × 2` bytes
- Verified: 100ms chunks at 16kHz = 3,200 bytes provides good balance

**3. Send Audio at Native Sample Rate**
- Phone audio: Send at 8kHz, do NOT resample to 16kHz
- WebRTC/VoIP: Send at 16kHz or 48kHz depending on source
- Verified: Resampling introduces artifacts that degrade accuracy

**4. Use Phone-Specific Models for PSTN**
- Providers offer specialized models trained on telephony audio
- Verified: Significant accuracy improvement vs. general models on 8kHz narrowband

**5. Enable Interim Results for Responsive UX**
- Display partials as they arrive for text-as-you-speak experience
- Process only final results for LLM input
- Verified: Improves perceived responsiveness without sacrificing accuracy

**6. Tune Endpointing by Use Case**
- Standard conversation: 700-1000ms min silence
- Complex input (account numbers): 1500-2000ms min silence
- Fast interaction: 500ms min silence
- Verified: Reduces premature finalization and excessive wait times

**7. VAD Threshold Tuning by Audio Quality**
- Normal audio: onset 0.5, offset 0.3
- Noisy audio: onset 0.3, offset 0.1 (more sensitive)
- High-quality: onset 0.7, offset 0.5 (less sensitive)
- Verified: Reduces false positives and false negatives

**8. Do NOT Apply Aggressive Noise Reduction Preprocessing**
- Send raw audio to STT; let model handle noise
- Verified: Noise reduction often removes acoustic information models need

**9. Train/Select Models on Realistic Noise**
- Test with HVAC, overlapping speakers, handset compression
- Use models trained on diverse noise datasets
- Verified: 90%+ accuracy achievable in noisy production environments

**10. Implement Custom Vocabulary for Domain Terms**
- Add brand names, acronyms, technical jargon, proper names
- Limit to 2500 characters or provider maximum
- Include pronunciation and display form specifications
- Verified: Reduces WER for domain-specific terminology by 20-40%

**11. Use Confidence Scores for Quality Gates**
- Set threshold (e.g., 0.7) below which to request user confirmation
- Compare top alternatives when confidence scores are close (e.g., 0.75 vs 0.72)
- Verified: Prevents incorrect actions on ambiguous transcripts

**12. Enable Word-Level Confidence**
- Identify specific words with low confidence for targeted re-prompting
- Example: "I want to [0.45:cancel] my order" → confirm "cancel" specifically
- Verified: More precise disambiguation vs. re-prompting entire utterance

**13. Monitor WER Components (Substitutions, Insertions, Deletions)**
- Track error types separately to identify patterns
- Example: High substitutions = accent/noise issue; high deletions = VAD clipping
- Verified: Enables targeted optimization vs. generic "improve WER"

**14. Implement Production Drift Detection**
- Monitor acoustic drift, codec drift, vocabulary drift, population drift
- Use statistical tests on confidence distribution and audio features
- Set dynamic thresholds accounting for legitimate shifts
- Verified: Catches regressions before users report issues

**15. Oversample Low-Confidence Transcripts for Review**
- Randomly sample for baselines, oversample confidence <0.7
- Build domain-specific term lists from human review
- Verified: Iterative improvement of custom vocabularies

**16. Use Partial-Result Stabilization for Low-Latency UX**
- Enable stabilization to constrain which words can change
- Trade-off: Slightly reduced accuracy for faster TTFB
- Verified: Useful for video subtitling, less critical for voice AI

**17. Send Silence as Zero Bytes During Pauses**
- Encode and send equivalent silence duration (zero bytes for PCM)
- Verified: Maintains timing context for accurate endpointing

**18. Use Lossless Codecs When Possible**
- Prefer LINEAR16 over MULAW, AMR, MP3
- If bandwidth-constrained, use AMR_WB or OGG_OPUS
- Verified: Lossless formats provide best accuracy

**19. Maintain Warm STT Connections**
- Pre-establish WebSocket connections before audio starts
- Keep connections alive during conversation
- Verified: Eliminates 200-2000ms cold start penalty

**20. Implement Retry Logic for Low Confidence**
- If confidence <threshold, prompt user to repeat
- Use alternative phrasing: "I didn't catch that, could you say it again?"
- Verified: Captures better quality audio on second attempt

**21. Use Custom Language Models for Large Domain Corpora**
- Beyond custom vocabulary, train language models on domain-specific text
- Captures contextual meaning for homophones and complex terminology
- Verified: Further reduces WER by 10-20% for specialized domains

**22. Implement Speaker Diarization for Multi-Party Calls**
- Separate transcripts by speaker to handle overlapping speech
- Required for call center (agent + customer) scenarios
- Verified: Reduces confusion from simultaneous speech

**23. Enable Punctuation and Capitalization**
- Improves LLM understanding of transcript structure
- Verified: Better intent recognition and entity extraction

**24. Track Real-Time Factor (RTF) <1.0**
- Monitor processing_time / audio_duration
- Alert if RTF >0.8 (approaching capacity limit)
- Verified: Prevents system overload and latency spikes

## Engineering Rules (Binding)

**R1: Always use streaming STT with partial and final results**
- Never wait for complete utterance before starting transcription
- Display partials for UX, process finals for LLM input

**R2: Chunk size must be 100-200ms for real-time applications**
- Use formula: `(chunk_duration_ms / 1000) × sample_rate × 2` bytes
- Smaller chunks for lower latency; larger chunks for stability

**R3: Send audio at native sample rate, never resample**
- Phone (PSTN): 8kHz
- WebRTC/VoIP: 16kHz or 48kHz depending on source
- Resampling introduces artifacts

**R4: Use phone-specific STT models for PSTN audio**
- General models trained on 16kHz will underperform on 8kHz telephony
- Provider must offer phone/telephony model variant

**R5: Endpointing min silence duration must be configurable by use case**
- Standard: 700-1000ms
- Complex input: 1500-2000ms
- Fast interaction: 500ms
- Must be runtime-configurable, not hardcoded

**R6: VAD threshold must be tuned for production audio conditions**
- Test with realistic noise (HVAC, overlapping speakers)
- Adjust onset/offset based on audio quality
- Monitor false positive (hallucination) and false negative (clipping) rates

**R7: Never apply aggressive noise reduction preprocessing to audio**
- Send raw audio to STT
- Exception: Light noise gate if absolutely necessary, but test impact on accuracy

**R8: Implement custom vocabulary for all domain-specific terms**
- Minimum: Brand names, product names, common acronyms
- Include pronunciation and display form
- Update vocabulary as new terms emerge (vocabulary drift monitoring)

**R9: Always enable word-level confidence scores**
- Use for quality gates (e.g., confidence <0.7 triggers confirmation)
- Track confidence distribution for drift detection
- Oversample low-confidence transcripts for review

**R10: Monitor WER, CER, and WER components (substitutions, insertions, deletions)**
- Track separately for different audio conditions (noise levels, accents)
- Set alerts on WER regression >5% from baseline
- Investigate root cause (acoustic/codec/vocabulary/population drift)

**R11: Real-Time Factor (RTF) must be <1.0 in production**
- Target <0.8 for safety margin
- Alert if RTF >0.8 to prevent capacity issues
- Scale infrastructure before RTF reaches 1.0

**R12: Latency targets (P95):**
- TTFB: ≤300ms for 3-second utterances
- Final: ≤800ms for 3-second utterances
- If exceeded, investigate chunk size, network latency, model processing time

**R13: Send silence as zero bytes during pauses**
- Do not drop silent frames from stream
- Maintains timing context for accurate endpointing

**R14: Use lossless audio codecs when bandwidth permits**
- Prefer LINEAR16 over lossy codecs
- If bandwidth-constrained, use AMR_WB or OGG_OPUS (not MP3/MP4)

**R15: Implement confidence-based retry logic**
- If confidence <0.7, prompt user to repeat
- If top two alternatives have close confidence (diff <0.1), disambiguate
- Never process low-confidence transcripts as-is without verification

**R16: Maintain warm STT connections**
- Pre-establish WebSocket before audio starts
- Keep alive during conversation
- Eliminates cold start penalty (200-2000ms)

**R17: Enable punctuation and capitalization**
- Required for LLM understanding of transcript structure
- Improves intent recognition and entity extraction

**R18: Implement production drift detection**
- Monitor acoustic, codec, vocabulary, population drift
- Use statistical tests on confidence distribution
- Alert on significant shifts (e.g., mean confidence drops >0.1)

**R19: Test with diverse accents and dialects**
- Minimum: Test with top 3 accent groups in target market
- Track WER separately by accent
- If WER >20% for any accent, model is not production-ready

**R20: Implement speaker diarization for multi-party calls**
- Required for call center scenarios (agent + customer)
- Separate transcripts by speaker to handle overlapping speech

## Metrics & Signals to Track

**Accuracy Metrics:**
- Word Error Rate (WER): Target 5-10% for standard audio; 20%+ indicates problems
- Character Error Rate (CER): Complements WER for character-level errors
- Keyword Error Rate (KER): Domain-critical terms (e.g., "cancel", "refund")
- WER components: Substitutions, insertions, deletions (track separately)
- WER by accent/dialect: Track separately for top accent groups
- WER by noise level: Track separately for SNR ranges (>15dB, 10-15dB, 5-10dB, <5dB)

**Latency Metrics (P50, P95, P99):**
- Time to First Byte (TTFB): Target P95 ≤300ms for 3-second utterances
- Partial update cadence: Frequency of interim results (100-200ms typical)
- Final latency: Target P95 ≤800ms for 3-second utterances
- Real-Time Factor (RTF): processing_time / audio_duration (target <0.8)
- Cold start latency: First request after idle (target <500ms)

**Confidence Metrics:**
- Mean confidence score: Baseline and track drift
- Confidence distribution: P10, P50, P90 (detect shifts)
- Low-confidence rate: % transcripts with confidence <0.7
- Word-level confidence: Track per-word confidence for critical terms

**Endpointing Metrics:**
- Premature finalization rate: % utterances cut off mid-speech
- Delayed finalization rate: % utterances with >2s silence before finalization
- Average silence duration before finalization: 700-1000ms typical
- False endpointing rate: User continues speaking after finalization

**VAD Metrics:**
- False positive rate (hallucinations): % non-speech transcribed as speech
- False negative rate (clipping): % speech not detected
- VAD onset/offset threshold values: Track for tuning
- Speech detection latency: Time from speech start to VAD trigger

**Drift Detection Metrics:**
- Acoustic drift: Changes in noise levels, signal conditions (statistical tests on audio features)
- Codec drift: Changes in audio encoding (monitor codec distribution)
- Vocabulary drift: New terms with low confidence (track OOV rate)
- Population drift: Changes in speaker demographics (track accent distribution)

**Audio Quality Metrics:**
- Sample rate distribution: 8kHz (phone) vs 16kHz (VoIP) vs 48kHz (high-quality)
- Codec distribution: LINEAR16, MULAW, AMR, MP3, etc.
- Signal-to-Noise Ratio (SNR): Target >15dB for good accuracy
- Packet loss rate: Target <1%
- Jitter: Target <30ms

**Custom Vocabulary Metrics:**
- Custom term recognition rate: % custom terms correctly transcribed
- Custom term false positive rate: % incorrect transcriptions due to word boost
- Vocabulary size: Number of custom terms (track against provider limit)
- Vocabulary update frequency: How often new terms added

**Production Health Metrics:**
- STT API error rate: Target <0.5%
- STT API timeout rate: Target <0.1%
- WebSocket connection failures: Target <1%
- Retry rate: % requests requiring retry
- Fallback rate: % requests using fallback provider

**User Experience Proxies:**
- Re-prompt rate: % turns where user asked to repeat
- Conversation duration: Longer calls often indicate STT issues
- Call abandonment rate: Users hanging up due to poor transcription
- Escalation to human rate: Users giving up on AI agent

## V1 Decisions / Constraints

**Decision: Use Deepgram Nova-3 for primary STT (150ms TTFB target)**
- Rationale: Best latency profile for real-time voice AI; January 2026 refinements improve accuracy
- Latest: 54.3% WER reduction vs competitors, 6.84% median WER, real-time multilingual, keyterm prompting
- Constraint: Vendor lock-in, API costs, accuracy trade-offs vs. slower models

**Decision: Target P95 TTFB ≤300ms and P95 Final ≤800ms for 3-second utterances**
- Rationale: Balance between responsiveness and technical feasibility
- Constraint: Requires optimal chunk size, network latency, model selection

**Decision: Chunk size 100ms (1,600 bytes at 8kHz, 3,200 bytes at 16kHz)**
- Rationale: Good balance between latency and stability
- Constraint: May need adjustment based on production network conditions

**Decision: Endpointing min silence 700ms for standard conversation**
- Rationale: Reduces premature finalization while maintaining responsiveness
- Constraint: May need 1500ms for complex input (account numbers, addresses)

**Decision: VAD threshold 0.5 onset, 0.3 offset for normal audio**
- Rationale: Standard configuration for moderate noise environments
- Constraint: Requires tuning based on production acoustic conditions

**Decision: Enable interim results for UX, process only finals for LLM**
- Rationale: Responsive UX without wasting LLM API costs on incorrect partials
- Constraint: Requires careful state management to avoid processing partials

**Decision: Use phone-specific STT model for PSTN audio**
- Rationale: Significant accuracy improvement on 8kHz narrowband
- Constraint: Not all providers offer phone models; may need provider switch

**Decision: Send audio at native sample rate (8kHz PSTN, 16kHz WebRTC)**
- Rationale: Resampling introduces artifacts that degrade accuracy
- Constraint: Requires detecting source type and configuring STT accordingly

**Decision: Implement custom vocabulary with top 100 domain terms**
- Rationale: Reduces WER for brand names, product names, common acronyms
- Constraint: Requires manual curation and ongoing maintenance

**Decision: Enable word-level confidence scores**
- Rationale: Required for quality gates and targeted re-prompting
- Constraint: Not all providers support word-level confidence; may increase latency slightly

**Decision: Confidence threshold 0.7 for LLM processing**
- Rationale: Below 0.7, prompt user to repeat; above 0.7, proceed
- Constraint: May cause excessive re-prompts if threshold too high

**Decision: Do NOT apply noise reduction preprocessing**
- Rationale: Modern STT models perform better on raw audio
- Constraint: Requires STT provider with noise-robust models

**Decision: Monitor WER, CER, KER, confidence, latency, RTF in production**
- Rationale: Cannot optimize what cannot measure; drift detection requires baselines
- Constraint: Requires observability infrastructure and alerting

**Decision: Defer speaker diarization to post-V1**
- Rationale: Adds complexity; focus on single-speaker accuracy first
- Constraint: Multi-party calls will have garbled transcripts during overlapping speech

**Decision: Defer custom language model training to post-V1**
- Rationale: Custom vocabulary sufficient for V1; language models require large domain corpus
- Constraint: Homophone confusion will persist (e.g., "four" vs "for")

**Decision: Defer accent-specific model training to post-V1**
- Rationale: Use general model with diverse training data; accent-specific models require large datasets
- Constraint: 16-20% higher WER for underrepresented accents

**Decision: Implement retry logic for confidence <0.7**
- Rationale: Prevents incorrect actions on ambiguous transcripts
- Constraint: Increases conversation duration; may frustrate users if triggered too often

**Decision: Maintain warm STT WebSocket connections**
- Rationale: Eliminates 200-2000ms cold start penalty
- Constraint: Requires connection pooling and keep-alive logic

**Decision: Enable punctuation and capitalization**
- Rationale: Improves LLM understanding of transcript structure
- Constraint: Not all providers support punctuation; may increase latency slightly

## Open Questions / Risks

**Q1: What is acceptable WER for production by use case?**
- Hypothesis: 5-10% for standard conversation; <5% for high-stakes (financial, medical)
- Risk: User tolerance varies; some domains require near-perfect accuracy
- Mitigation: A/B test with real users; measure task completion rate vs. WER

**Q2: How to handle code-switching (multilingual speakers)?**
- Users may switch languages mid-conversation
- Risk: Single-language models fail on code-switching; multilingual models have higher latency
- Mitigation: Detect language switch and reconfigure STT? Defer to post-V1?

**Q3: What is optimal confidence threshold for retry?**
- 0.7 is common, but is it optimal for our use case?
- Risk: Too high = excessive re-prompts; too low = incorrect actions
- Mitigation: A/B test thresholds (0.6, 0.7, 0.8) and measure user satisfaction

**Q4: Should we implement partial-result stabilization?**
- Reduces latency but may reduce accuracy
- Risk: Trade-off may not be worth it for voice AI (vs. video subtitling)
- Decision: Test in production; measure impact on LLM intent accuracy

**Q5: How to handle extremely noisy environments (SNR <5dB)?**
- Current models may have WER >30% in extreme noise
- Risk: System unusable in noisy call centers, outdoor environments
- Mitigation: Prompt user to move to quieter location? Use noise gate? Defer to human agent?

**Q6: What is impact of network jitter on streaming STT?**
- Variable packet arrival times may affect chunk processing
- Risk: Increased latency or degraded accuracy
- Mitigation: Implement jitter buffer on client side? Test on real networks (4G, 5G, WiFi)

**Q7: Should we implement multi-provider fallback?**
- If primary STT fails or exceeds latency SLA, fallback to secondary
- Risk: Inconsistent transcription quality across providers; complexity
- Decision: Defer to post-V1; focus on single-provider reliability

**Q8: How to measure WER in production without ground truth?**
- Manual labeling is expensive and slow
- Risk: May not detect regressions quickly
- Mitigation: Use confidence scores as proxy; sample low-confidence transcripts for manual review

**Q9: What is impact of accent diversity on overall WER?**
- If 20% of users have underrepresented accents with 20% higher WER, overall WER increases
- Risk: Average WER looks acceptable but significant user segment has poor experience
- Mitigation: Track WER by accent separately; set per-accent thresholds

**Q10: Should we implement real-time accent detection?**
- Detect accent and route to accent-specific model
- Risk: Adds latency; accent detection itself may be inaccurate
- Decision: Defer to post-V1; use general model with diverse training

**Q11: How to handle background speech (non-directed conversation)?**
- User talking to someone else while on call
- Risk: STT transcribes background conversation, confuses LLM
- Mitigation: Speaker diarization? Prompt user to mute? Defer to post-V1?

**Q12: What is optimal custom vocabulary size?**
- More terms = better coverage; too many = false positives
- Risk: Over-boosting causes incorrect transcriptions of similar-sounding phrases
- Mitigation: Start with top 100 terms; measure false positive rate; expand carefully

**Q13: Should we implement domain-specific language model training?**
- Requires large corpus of domain-specific text
- Risk: High effort; unclear ROI vs. custom vocabulary
- Decision: Defer to post-V1; measure WER improvement from custom vocabulary first

**Q14: How to handle long pauses (>2 seconds) within utterance?**
- User thinking, checking information, etc.
- Risk: System finalizes prematurely, user must repeat
- Mitigation: Increase min silence duration for complex input use cases (1500-2000ms)

**Q15: What is impact of lossy codecs on accuracy?**
- Bandwidth constraints may require MP3, AMR, etc.
- Risk: Degraded accuracy, especially with background noise
- Mitigation: Measure WER with lossy codecs; use AMR_WB or OGG_OPUS if necessary (not MP3)
