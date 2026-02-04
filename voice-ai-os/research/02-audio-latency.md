# Research: End-to-End Audio Latency in Real-Time Voice AI

**🟢 LOCKED** - Production-validated research based on WebRTC latency budgets, Voice AI Leaderboard (1M+ calls), Silero VAD v6.2, production benchmarks. Updated February 2026.

---

## Why This Matters for V1

Latency is the defining constraint in voice AI systems. Humans respond within 200-300ms in natural conversation, and delays beyond 500ms cause users to perceive systems as broken. Production data shows that response delays over 1 second cause users to hang up 40% more frequently. For WebRTC-based voice AI, achieving sub-500ms end-to-end latency determines whether the system feels conversational or unusable. Current industry reality is sobering: median latency is 1.4-1.7 seconds—5x slower than human expectation—with 10% of calls exceeding 3-5 seconds.

## What Matters in Production (Facts Only)

**Human Conversation Timing Baseline:**
- Natural human pause between speakers: 200-500ms
- Acceptable response time: <500ms
- Noticeable degradation: 500-800ms
- Unacceptable (users disengage): >1500ms
- ITU-T G.114 standard: One-way delay should stay below 150ms for acceptable quality; 150-400ms acceptable with impact; >600ms unacceptable

**Cascaded Architecture Latency Stack (STT → LLM → TTS):**

| Component | Typical Range | Sub-Second Target | Best-in-Class |
|-----------|---------------|-------------------|---------------|
| Audio capture | 10-50ms | 10-30ms | - |
| Network upload | 20-100ms | 20-50ms | - |
| End-of-utterance detection | 100-300ms | 150-200ms | 150ms |
| STT processing | 100-500ms | 100-200ms | 150ms (Deepgram Nova-3) |
| LLM TTFT (time-to-first-token) | 200-800ms / 350-1000ms | 150-300ms | 320ms (GPT-4o edge) |
| TTS TTFB (time-to-first-byte) | 75-200ms / 90-200ms | 80-150ms | 40ms (Cartesia Sonic) |
| Network download | 20-100ms | 20-50ms | - |

**Sequential vs. Streaming Processing:**
- Sequential (naive): 6+ seconds total (1500ms silence timeout + 600ms STT + 3000ms LLM + 1000ms TTS)
- Streaming (optimized): <1000ms (200ms detection + parallel STT/LLM/TTS execution)
- Streaming enables TTS to begin speaking early LLM tokens while later tokens still generate

**Production Latency Percentile Targets:**
- P50 (median): <500ms end-to-end turn latency
- P95: <800ms end-to-end turn latency
- P99: <1000ms end-to-end turn latency
- P95 TTFB (STT): ≤300ms for 3-second utterances
- P95 Final transcript: ≤800ms for 3-second utterances
- Real-Time Factor (RTF) for STT: <1.0 in production

**Provider Latency Benchmarks (2026):**

*STT Providers:*
- Deepgram Nova-3: ~150ms (optimized for latency)
- AssemblyAI Universal-2: 300-600ms (higher accuracy)
- GPT-4o-transcribe: Highest accuracy, latency not specified

*LLM Providers (TTFT):*
- GPT-4o: ~320ms (edge optimized)
- Gemini 1.5 Pro: ~400ms
- Claude 3.5: ~480ms
- Average across 26+ models: 695ms
- Fastest (Grok 4 Fast): 207ms
- Slowest (Gemini 2.5 Pro): 2,889ms

*TTS Providers (TTFB):*
- Cartesia Sonic Turbo: 40ms model latency, 128-135ms TTFA (P90, global)
- ElevenLabs Flash v2: 75ms (plus network)
- ElevenLabs Full: 300ms+
- PlayHT: 190-200ms (plus network)

**WebRTC-Specific Characteristics:**
- WebRTC reduces latency by up to 300ms compared to traditional telephony
- WebRTC beats WebSockets by 50% in lossy network conditions
- NetEQ adaptive jitter buffer: Continuously optimizes buffering delay based on network conditions
- Jitter buffer operations: Reordering, timing normalization, loss detection/concealment
- Jitter buffer adds minimal latency but ensures smooth playout
- WebRTC uses UDP for real-time communication to minimize latency (vs. TCP's reliability overhead)
- Opus codec: Standard for WebRTC audio, low-latency encoding/decoding

**Network Latency Factors:**
- PSTN telephony: ~500ms network latency before any agent processing
- Regional deployment eliminates 60-80ms round-trip latency
- Mumbai to US Virginia: 150ms+ each direction for network transit alone
- Each network hop between services: 20-50ms per hop (250ms minimum round-trip for distributed architecture)
- Network jitter: Short-term variance in packet arrival times (distinct from average RTT)
- Packet loss and bandwidth constraints affect quality but WebRTC's congestion control (GCC) adapts

**Cold Start Impact:**
- Cold start penalty: 2-3 seconds for instance initialization
- Includes: Container init, image pull, runtime init, model artifact fetch, GPU memory allocation, weight transfer
- Warm instance pools eliminate startup overhead but increase infrastructure costs (especially for GPU workloads)
- TTFT inflates during cold starts as model weights must be loaded into GPU memory

**Infrastructure Optimization Impact:**
- Co-located infrastructure (GPU + telephony): Eliminates intermediate network hops
- Local STT deployment: ~110ms vs. ~250ms via external API (140ms savings)
- Local LLM deployment: ~300ms TTFT vs. 700-1500ms for cloud APIs
- Edge/regional deployment: Required for sub-500ms global latency

## Common Failure Modes (Observed in Real Systems)

**1. The Average Latency Trap (Most Dangerous)**
- Teams track only average latency (e.g., 300ms average)
- Reality: 10% of calls spike to 1500ms, users perceive system as broken
- Root cause: Averages hide tail latency distribution
- Impact: False confidence in system performance, undetected user frustration

**2. Sequential Processing Accumulation**
- Each component waits for previous to complete before starting
- Example: 1500ms silence timeout + 600ms STT + 3000ms LLM + 1000ms TTS = 6+ seconds
- Root cause: Lack of streaming/parallel architecture
- Impact: Completely unusable system, immediate user abandonment

**3. Naive Silence Timeout Waste**
- Fixed 1-1.5 second silence timeouts before processing begins
- Wastes half the total latency budget before any work starts
- Root cause: Simple VAD without ML-based end-of-utterance detection
- Impact: 1-1.5 seconds added to every turn, conversation feels laggy

**4. Network Hop Multiplication**
- Distributed architecture with STT, LLM, TTS in different regions/clouds
- Each hop adds 20-50ms; 5+ hops = 250ms+ just for network transit
- Example: User → WebRTC server (Region A) → STT API (Region B) → LLM API (Region C) → TTS API (Region D) → WebRTC server → User
- Root cause: Lack of co-located or regional deployment strategy
- Impact: 200-500ms of unavoidable network latency before any processing

**5. Cold Start Latency Spikes**
- First request after idle period or scale-from-zero incurs 2-3 second penalty
- Subsequent requests are fast, but intermittent users experience degradation
- Root cause: On-demand instance scaling without warm pools
- Impact: P99 latency spikes, inconsistent user experience

**6. WebRTC Jitter Buffer Underruns**
- Insufficient jitter buffer size causes audio dropouts during network variance
- Oversized jitter buffer adds unnecessary latency
- Root cause: Static buffer configuration not adapted to network conditions
- Impact: Choppy audio or increased latency

**7. LLM TTFT Variability**
- Same LLM provider shows 200ms TTFT in testing, 800ms+ in production
- Root cause: Shared infrastructure contention, cold starts, prompt length variance
- Impact: Unpredictable conversation flow, inconsistent UX

**8. TTS Sentence Buffering**
- System waits for complete LLM response before starting TTS
- Root cause: Lack of sentence-level streaming from LLM to TTS
- Impact: 1-3 seconds of unnecessary delay while LLM completes full response

**9. Regional Mismatch**
- User in Asia, all infrastructure in US/Europe
- 150-300ms of network latency in each direction
- Root cause: Single-region deployment for global users
- Impact: 300-600ms added to every turn, unusable for non-local users

**10. Packet Loss Cascade**
- Network packet loss triggers retransmissions and jitter buffer adjustments
- Degrades both latency and audio quality simultaneously
- Root cause: Poor network conditions without adequate error concealment
- Impact: Stuttering audio with increased latency, conversation breakdown

**11. Monitoring Blind Spots**
- Teams monitor end-to-end latency but not per-component breakdown
- Cannot identify which component (STT, LLM, TTS) is bottleneck
- Root cause: Lack of distributed tracing with correlation IDs
- Impact: Slow incident response, ineffective optimization efforts

**12. Echo Cancellation Latency**
- Acoustic Echo Cancellation (AEC) processing adds 10-50ms
- Imperfect AEC causes feedback loops requiring additional processing
- Root cause: Trade-off between AEC aggressiveness and speech preservation
- Impact: Increased latency or degraded audio quality

## Proven Patterns & Techniques

**1. Streaming Architecture with Parallel Execution**
- STT streams partial transcripts immediately (<100ms for first words)
- LLM begins processing on partial transcripts for intent detection
- TTS starts speaking early LLM tokens while later tokens still generate
- Verified: Reduces perceived latency from 6+ seconds to <1000ms

**2. Smart End-of-Utterance Detection**
- ML-based VAD models (Silero v6.2, LiveKit Turn Detector v1.3.12, Pipecat Smart Turn V3) replace fixed silence timeouts
- Reduces detection from 1500ms to 150-200ms
- Verified: Saves 1-1.5 seconds per turn

**3. Sentence-Level Streaming (LLM → TTS)**
- LLM transmits generated sentences incrementally to TTS
- TTS begins audio output before LLM completes full response
- Verified: Reduces TTFB by 1-3 seconds depending on response length

**4. Regional/Edge Deployment**
- Deploy STT, LLM, TTS in same region as users
- Co-locate GPU inference with telephony/WebRTC infrastructure
- Verified: Eliminates 60-80ms round-trip latency per hop; 140ms savings for STT alone

**5. Warm Instance Pools**
- Maintain pre-initialized containers with models loaded in GPU memory
- Eliminates 2-3 second cold start penalty
- Verified: Consistent TTFT, improved P99 latency

**6. Provider Selection by Latency Profile**
- Choose STT/LLM/TTS providers based on latency requirements, not just accuracy
- Example: Cartesia (40ms) vs. ElevenLabs (75ms) vs. PlayHT (190ms) for TTS
- Verified: 50-150ms difference in TTFB based on provider choice

**7. WebRTC Over WebSockets**
- Use WebRTC for audio transport instead of WebSockets
- Verified: 50% better performance in lossy network conditions

**8. Distributed Tracing with Correlation IDs**
- Generate trace ID at audio capture, propagate through all API calls
- Track latency per component (STT, LLM, TTS) separately
- Verified: Enables rapid incident diagnosis; 4x faster resolution time

**9. Percentile-Based Monitoring**
- Track P50, P95, P99 separately for each pipeline stage
- Set alerts on P95 thresholds, not averages
- Verified: Catches tail latency issues before they impact large user populations

**10. Model Quantization (4-bit LLM)**
- Reduce LLM memory footprint and inference latency via quantization
- Verified: Maintains quality while reducing GPU memory and TTFT

**11. WebSocket Pre-Connection for TTS**
- Establish WebSocket connection to TTS provider in advance
- Verified: Saves ~200ms by avoiding connection latency overhead (Cartesia recommendation)

**12. Concurrent Module Execution**
- Use non-blocking producer-consumer patterns for STT/LLM/TTS
- Each module operates independently with queues between them
- Verified: Enables true parallel processing, reduces total latency

**13. Local SSD for Container Images**
- Use local SSDs for faster container image pulls during scaling
- Verified: Reduces cold start latency by 30-50%

**14. Separation of Initialization Work**
- Move kernel compilation, graph capture, KV cache init to deployment time
- Don't perform initialization on first request
- Verified: Reduces first-request TTFT by 1-2 seconds

**15. Adaptive Jitter Buffer (NetEQ)**
- WebRTC's NetEQ continuously optimizes buffer size based on network conditions
- Balances latency vs. resilience to jitter
- Verified: Built into WebRTC, provides smooth audio with minimal latency overhead

## Engineering Rules (Binding)

**R1: Never use sequential processing for STT → LLM → TTS pipeline**
- Minimum requirement: Streaming STT with partial transcripts
- Required: Parallel LLM processing while STT runs, sentence-level LLM → TTS streaming

**R2: End-to-end turn latency targets (user stops speaking → agent starts speaking):**
- P50: <500ms (required)
- P95: <800ms (required)
- P99: <1000ms (stretch goal)
- If P95 exceeds 800ms, system is not production-ready

**R3: Never use fixed silence timeouts >300ms for end-of-utterance detection**
- Maximum: 300ms for fast interaction, 500ms for standard conversation
- Must use ML-based VAD (Silero, TurnDetector) not simple amplitude thresholding

**R4: Always track latency percentiles (P50, P95, P99), never just averages**
- Set alerts on P95 thresholds
- Monitor per-component latency separately (STT, LLM, TTS)
- Track TTFB and TTFT separately from total latency

**R5: Deploy infrastructure regionally, never single-region for global users**
- Maximum acceptable network latency: 50ms one-way
- If users in Asia, must have Asia deployment; if users in Europe, must have Europe deployment
- Co-locate STT, LLM, TTS in same region/availability zone

**R6: Implement distributed tracing with correlation IDs across all components**
- Generate trace ID at audio capture
- Propagate through STT API, LLM API, TTS API calls
- Store per-component latency for every request

**R7: Use WebRTC for audio transport, not WebSockets or HTTP polling**
- WebRTC provides lower latency and better handling of packet loss
- Use Opus codec for audio encoding

**R8: Maintain warm instance pools for LLM inference**
- Never scale-from-zero for production traffic
- Pre-load model weights into GPU memory
- Accept infrastructure cost trade-off for consistent latency

**R9: Provider selection must consider latency, not just accuracy/quality**
- Document latency SLA for each provider (STT, LLM, TTS)
- Test providers under production load, not just synthetic benchmarks
- Have fallback providers if primary exceeds latency SLA

**R10: Implement sentence-level streaming from LLM to TTS**
- TTS must begin speaking before LLM completes full response
- Use sentence delimiters (periods, question marks) as streaming boundaries
- Never buffer entire LLM response before TTS starts

**R11: Cold start latency must be <500ms or use warm pools**
- If cold start >500ms, must maintain warm instance pools
- Monitor cold start rate and P99 latency separately
- Set alerts if cold start rate exceeds 5% of requests

**R12: Network hops between components must be <3 for critical path**
- Critical path: User → WebRTC → STT → LLM → TTS → WebRTC → User
- Maximum 3 hops (ideally 1: co-located infrastructure)
- Each additional hop adds 20-50ms

**R13: WebRTC jitter buffer must be adaptive, not static**
- Use NetEQ or equivalent adaptive jitter buffer
- Monitor buffer underruns and overruns
- Balance latency vs. packet loss resilience

**R14: STT Real-Time Factor (RTF) must be <1.0 in production**
- RTF = processing_time / audio_duration
- RTF >1.0 means system cannot keep up with real-time audio
- Set alerts if RTF exceeds 0.8 (80% utilization)

**R15: End-of-utterance detection latency budget: 150-200ms maximum**
- Use smart VAD models, not naive silence detection
- 200ms is acceptable; 300ms is marginal; >300ms is unacceptable

## Metrics & Signals to Track

**Latency Metrics (P50, P95, P99 for each):**
- Audio capture latency: Target <30ms
- Network upload latency: Target <50ms
- End-of-utterance detection: Target 150-200ms
- STT processing time (TTFB): Target 100-200ms
- STT final transcript time: Target <800ms for 3-second utterance
- LLM time-to-first-token (TTFT): Target 150-300ms
- LLM tokens-per-second: Target >20 tokens/sec
- TTS time-to-first-byte (TTFB): Target 80-150ms
- TTS time-to-first-audio (TTFA): Target 128-200ms
- Network download latency: Target <50ms
- End-to-end turn latency: Target P50 <500ms, P95 <800ms

**Per-Component Breakdown:**
- STT latency as % of total
- LLM latency as % of total
- TTS latency as % of total
- Network latency as % of total
- Identify dominant bottleneck

**Infrastructure Metrics:**
- Cold start rate: Target <5% of requests
- Cold start latency: Target <500ms
- Warm instance pool utilization: Target 60-80%
- Instance scaling lag: Time from demand spike to new instance ready

**Network Quality Metrics:**
- Round-trip time (RTT): Target <100ms
- Jitter: Target <30ms
- Packet loss rate: Target <1%
- Jitter buffer underruns: Target <0.1%
- Jitter buffer size (adaptive): Monitor for tuning

**WebRTC-Specific Metrics:**
- Audio codec (should be Opus)
- Bitrate adaptation events
- Echo cancellation (AEC) latency: Target <50ms
- Audio frame drops: Target <0.1%

**Provider SLA Tracking:**
- STT provider latency (P95): Compare against SLA
- LLM provider TTFT (P95): Compare against SLA
- TTS provider TTFB (P95): Compare against SLA
- Provider timeout rate: Target <0.1%
- Provider error rate: Target <0.5%

**Quality vs. Latency Trade-offs:**
- STT Word Error Rate (WER) vs. latency
- LLM response quality vs. TTFT
- TTS voice quality vs. TTFB
- Monitor for regressions when optimizing latency

**User Experience Proxies:**
- Call abandonment rate (>1s latency correlates with 40% higher abandonment)
- Re-prompt rate (latency causes users to repeat themselves)
- Conversation duration (excessive latency extends calls)
- User sentiment (frustration correlates with tail latency)

**Distributed Tracing Metrics:**
- Trace completion rate: Target >99%
- Correlation ID propagation success: Target 100%
- Tracing overhead: Target <5% latency impact

**Real-Time Factor (RTF):**
- STT RTF: Target <1.0 (ideally <0.8)
- TTS RTF: Target <1.0
- Overall system RTF: Target <1.0

## V1 Decisions / Constraints

**Decision: Target P95 end-to-end turn latency <800ms**
- Rationale: Balance between "feels natural" (<500ms) and technical feasibility
- Constraint: Requires streaming architecture, regional deployment, warm pools

**Decision: Use streaming architecture with parallel STT/LLM/TTS execution**
- Rationale: Sequential processing (6+ seconds) is completely unusable
- Constraint: Increased complexity, requires careful state management

**Decision: Deploy in 3 regions (US, Europe, Asia) with co-located infrastructure**
- Rationale: Single-region deployment adds 150-300ms for non-local users
- Constraint: 3x infrastructure cost, operational complexity

**Decision: Maintain warm instance pools for LLM inference**
- Rationale: Cold start penalty (2-3 seconds) unacceptable for P95 target
- Constraint: Higher infrastructure cost (~30-50% GPU utilization vs. on-demand)

**Decision: Use Deepgram Nova-3 for STT (150ms target)**
- Rationale: Best latency profile for real-time voice AI
- Constraint: Vendor lock-in, API costs, accuracy trade-offs vs. slower models

**Decision: Use GPT-4o for LLM (320ms TTFT target)**
- Rationale: Best balance of latency, quality, and streaming support
- Constraint: Cost, rate limits, no self-hosting option

**Decision: Use Cartesia Sonic for TTS (40ms model latency, 128ms TTFA)**
- Rationale: Lowest latency TTS provider with acceptable quality
- Constraint: Limited language support (15 languages), fewer voices (~130)

**Decision: Implement distributed tracing from day 1**
- Rationale: Cannot optimize what you cannot measure; incident response requires per-component visibility
- Constraint: 1-5% latency overhead, engineering effort

**Decision: Use Silero VAD v6.2 for end-of-utterance detection (150-200ms target)**
- Rationale: ML-based detection required to avoid 1-1.5 second naive timeout waste; v6.2 (Nov 2025) improves edge cases, child voices, phone calls
- Constraint: ~260K parameters, requires Python ≥3.8, additional inference cost

**Decision: Set P95 latency alerts at 800ms, P99 at 1000ms**
- Rationale: Catch degradation before it impacts large user populations
- Constraint: Requires robust monitoring infrastructure, on-call rotation

**Decision: WebRTC for audio transport (not WebSockets)**
- Rationale: Lower latency, better packet loss handling
- Constraint: More complex client integration, browser compatibility considerations

**Decision: Defer multi-region failover to post-V1**
- Rationale: Adds significant complexity; focus on single-region reliability first
- Constraint: Regional outages will impact users in that region

**Decision: Defer edge deployment (beyond 3 regions) to post-V1**
- Rationale: 3 regions cover 90%+ of users within 50ms network latency
- Constraint: Users in underserved regions (Africa, South America) will have higher latency

**Decision: Accept 1-5% latency overhead for distributed tracing**
- Rationale: Observability is non-negotiable for production system
- Constraint: Slightly higher latency, but necessary trade-off

## Open Questions / Risks

**Q1: What is acceptable P99 latency for production?**
- Target is <1000ms, but is this sufficient for user satisfaction?
- Risk: P99 represents 1 in 100 requests; high-value users may disproportionately hit tail latency
- Mitigation: Monitor call abandonment rate and user sentiment by latency bucket

**Q2: How to handle LLM TTFT variability (200ms → 800ms spikes)?**
- Same provider shows inconsistent TTFT under production load
- Risk: P95 target violated during peak hours or provider contention
- Mitigation: Multi-provider fallback? Pre-warming requests? Rate limiting?

**Q3: What is optimal warm pool size vs. cost trade-off?**
- Warm pools eliminate cold starts but increase infrastructure cost by 30-50%
- Risk: Over-provisioning wastes money; under-provisioning causes latency spikes
- Mitigation: Need production traffic patterns to right-size pools

**Q4: Should we implement request-level timeouts?**
- If STT takes >500ms, should we abort and retry with different provider?
- Risk: Retries add latency; but waiting for slow request also adds latency
- Mitigation: Needs experimentation with real traffic patterns

**Q5: How to handle network partition between regions?**
- If US region fails, can we route to Europe with acceptable latency?
- Risk: Cross-region latency (100-150ms) may violate P95 target
- Mitigation: Defer to post-V1; focus on single-region reliability

**Q6: What is impact of prompt length on LLM TTFT?**
- Longer conversation history increases TTFT
- Risk: Multi-turn conversations may degrade latency over time
- Mitigation: Prompt compression? Context window management? Needs testing

**Q7: Should we implement speculative decoding for LLM?**
- Speculative decoding can reduce TTFT by 20-40%
- Risk: Adds complexity; not all providers support it
- Decision: Defer to post-V1; focus on streaming first

**Q8: How to balance TTS quality vs. latency?**
- Cartesia (40ms) vs. ElevenLabs (75ms) vs. PlayHT (190ms)
- Risk: Users may prefer higher-quality voice even with latency trade-off
- Mitigation: A/B test with real users; measure quality vs. latency satisfaction

**Q9: What is impact of WebRTC jitter buffer size on latency?**
- Larger buffer = smoother audio but higher latency
- Smaller buffer = lower latency but more dropouts
- Risk: Optimal size varies by network conditions
- Mitigation: NetEQ adaptive buffer should handle this, but needs validation

**Q10: Should we implement client-side audio preprocessing?**
- Noise suppression, echo cancellation on client before upload
- Risk: Adds client-side latency; not all clients support it
- Mitigation: Needs testing on target devices (mobile, desktop, browser)

**Q11: How to handle mobile network variability?**
- 4G/5G networks have higher jitter and packet loss than WiFi
- Risk: P95 latency may be acceptable on WiFi but unacceptable on mobile
- Mitigation: Need separate latency targets by network type?

**Q12: What is impact of concurrent calls on shared infrastructure?**
- Multiple calls on same GPU may increase TTFT due to batching
- Risk: P95 latency degrades under load even with warm pools
- Mitigation: Load testing required to determine capacity limits

**Q13: Should we implement latency-based routing?**
- Route requests to fastest provider based on real-time latency monitoring
- Risk: Adds complexity; may cause inconsistent voice/quality across turns
- Decision: Defer to post-V1; use single provider per component initially

**Q14: How to measure true end-to-end latency in production?**
- Client-side timestamp vs. server-side timestamp (clock skew)
- Risk: Inaccurate measurements lead to false confidence or unnecessary optimization
- Mitigation: Use word-level timestamp analysis from STT as ground truth

**Q15: What is acceptable tracing overhead?**
- Current estimate: 1-5% latency overhead
- Risk: Tracing itself may cause P95 violations
- Mitigation: Measure tracing overhead separately; optimize or sample if necessary
