# Research Vault

This folder contains **binding, production-grade research** that directly informs implementation of the SpotFunnel Voice AI OS.

**This is not a hobby project. This is production-grade voice AI infrastructure.**

Research here is not exploratory notes or theoretical exercises.
It defines **engineering rules, constraints, metrics, and failure modes** used by the Voice Kernel, Control Plane, and dashboards.

Every research document is based on:
- **Real production deployments** handling 1M+ calls
- **Named enterprise customers** with measured usage data
- **Actual failure modes** from production incident response
- **Measured performance** (P50/P95/P99 latency, not averages)
- **Proven patterns** from Pipecat, Twilio, Telnyx, SignalWire production systems

---

## Rules (Production-Grade Standards)

**Non-Negotiable Requirements:**
- No subsystem may be implemented without relevant research.
- Every research file must follow `TEMPLATE.md`.
- Research conclusions that affect behavior, latency, cost, or safety MUST be recorded in `docs/DECISIONS.md`.
- Research is referenced during implementation.

**Production-Grade Quality Standards:**
- **Research must be production-validated**: Based on actual deployments with named customers, measured performance, and usage data. No marketing claims, no theoretical comparisons, no hobby project examples.
- **Research must be community-guided**: Prioritize what production practitioners actually use (Pipecat community, Twilio enterprise deployments, Modal production examples). If there are no production examples, it's a red flag.
- **Research must include failure modes**: Real production issues from 1M+ calls analyzed via 4-Stack Incident Response Framework. Not just success cases—document what breaks and why.
- **Research must include SLA/uptime data**: 99.95% SLA (Twilio), 99.8% uptime targets, P50/P95/P99 latency measurements. No averages that hide worst-case performance.
- **Research must include cost data**: Real production costs per minute, hidden fees, carrier billing quirks. Not just pricing page numbers.
- **Research must cite specific versions**: "Pipecat Smart Turn V3", "Silero VAD v6.2", "Cartesia Sonic 3 Oct 2025". No vague "latest version" references.

**What Disqualifies Research:**
- ❌ No production deployments with named customers
- ❌ Only marketing claims or vendor whitepapers
- ❌ Theoretical comparisons without measured data
- ❌ Hobby project examples or personal blog posts
- ❌ Missing failure modes and incident data
- ❌ No community adoption signals (zero Pipecat examples)
- ❌ Averages without P50/P95/P99 breakdowns
- ❌ Cost estimates without real production billing data

---

## Research Methodology

### Deep Research Requirements

All research must be **production-validated** and **community-guided**, not based on marketing claims or theoretical specs.

**Production-Validated Means (Enterprise-Grade):**
- Based on actual production deployments with **named enterprise customers** and measured usage data (e.g., "PolyAI + Twilio: 463k min/month, 6 languages, 50% call resolution")
- Includes **measured performance** with P50/P95/P99 latency (not averages), throughput under load, error rates in production
- References **real-world failure modes** from production incident response (1M+ calls analyzed via 4-Stack Framework)
- Cites **specific versions and release dates** (e.g., "Pipecat Smart Turn V3", "Silero VAD v6.2", "Cartesia Sonic 3 Oct 2025")
- Includes **actual production costs** with hidden fees, carrier billing quirks, not just pricing page numbers
- Documents **SLA/uptime guarantees** (e.g., "Twilio 99.95% SLA", "Target 99.8% uptime = ≤8 hours 45 min downtime/year")
- Includes **compliance requirements** (STIR/SHAKEN, E911, GDPR, HIPAA) with regulatory citations

**Community-Guided Means (Production Practitioners, Not Hobbyists):**
- Prioritize what **production practitioners actually deploy at scale** (Pipecat official integrations, Twilio enterprise customers, Modal production blog posts)
- Reference **official production documentation** (not personal blogs), verified GitHub examples with production usage, enterprise case studies
- Include what **managed platforms use** (Retell AI, VAPI, Bland AI backend choices—these are production-validated by definition)
- Cite **production benchmarks** from Voice AI Leaderboard (1M+ calls), real latency measurements with P50/P95/P99
- Avoid "shallow research" based only on tokens/sec and pricing—dig into **streaming behavior under load**, **function calling reliability in production**, **TTFT measurements**, **failover behavior**
- Verify **community adoption signals**: If there are zero Pipecat examples, zero production case studies, zero enterprise customers—it's not production-ready

**Research Sources (In Priority Order - Production-Grade Only):**
1. **Enterprise production deployments**: Named customers with measured usage data (e.g., "PolyAI + Twilio: 463k min/month, 6 languages, 50% call resolution rate")
2. **Official production integrations**: Pipecat supported transports (documented in official docs), framework quickstarts used in production
3. **Production code examples**: GitHub repos with production usage (Modal production blog, Twilio production tutorials), enterprise reference architectures
4. **Independent benchmarks**: Voice AI Leaderboard (1M+ calls analyzed), third-party latency measurements with P50/P95/P99, Metrigy CPaaS reports
5. **Vendor documentation with production backing**: Only when citing production case studies, SLA guarantees, measured performance
6. **Regulatory/compliance sources**: FCC mandates (STIR/SHAKEN, E911), GDPR requirements, HIPAA guidelines
7. **Marketing claims**: **DISQUALIFIED** unless verified against production data

**Sources That Disqualify Research:**
- ❌ Personal blog posts or Medium articles (not production-validated)
- ❌ Hobby project GitHub repos with <100 stars (not production-scale)
- ❌ Vendor whitepapers without customer names or usage data
- ❌ Theoretical comparisons or benchmarks without real production workloads
- ❌ "Getting started" tutorials that aren't used in production
- ❌ Reddit/forum discussions without production validation
- ❌ Any source that doesn't cite production usage, customer names, or measured performance

**What to Avoid:**
- ❌ Choosing models based only on tokens/sec and pricing
- ❌ Relying on marketing claims without production validation
- ❌ Ignoring production failure patterns (50% of issues are telephony, not AI)
- ❌ Theoretical comparisons without real-world measurements
- ❌ Missing community adoption signals (no Pipecat examples = red flag)

**Research Depth Checklist (Production-Grade Validation):**
- [ ] Found **3+ enterprise production deployments** with named customers and usage data
- [ ] Identified **actual measured performance** with P50/P95/P99 latency (not averages, not vendor claims)
- [ ] Documented **common failure modes** from production incident response (1M+ calls analyzed)
- [ ] Verified **community adoption at scale** (Pipecat official support, managed platform usage, enterprise examples)
- [ ] Included **actual production costs** with hidden fees, carrier billing quirks, overage charges
- [ ] Cited **specific versions and release dates** (no vague "latest version" references)
- [ ] Compared against **what production practitioners actually deploy** (not hobby projects)
- [ ] Included **SLA/uptime guarantees** (e.g., 99.95% SLA, target 99.8% uptime)
- [ ] Documented **compliance requirements** (STIR/SHAKEN, E911, GDPR, HIPAA with regulatory citations)
- [ ] Verified **no disqualifying sources** (no personal blogs, hobby projects, unverified marketing claims)
- [ ] Included **failover and redundancy patterns** from production systems achieving 99.8%+ uptime
- [ ] Documented **monitoring and observability** requirements (CDR, MOS scores, jitter, packet loss)

**Example: Model Stack Optimization Research**
- ❌ Shallow: "Gemini 2.5 Flash-Lite is 7x faster and 3x cheaper than GPT-4o Mini"
- ✅ Deep: "GPT-4o is proven in production (Pipecat quickstart, Twilio ConversationRelay, Modal examples) with measured 76 tokens/sec, 0.49s TTFT. Gemini 2.5 Flash-Lite has zero documented production voice AI usage in Pipecat community, unknown streaming behavior for voice, unknown function calling reliability."

**Example: Telephony Infrastructure Research**
- ❌ Shallow (Hobby Project): "Twilio is the market leader"
- ✅ Production-Grade: "Twilio #1 in Metrigy 2025 CPaaS report (independent benchmark), 99.95% SLA guarantee, 13.8T+ API calls/year at scale. Enterprise production: PolyAI 463k min/month, 6 languages, 50% call resolution rate (measured). Latency: >3 sec median (public internet routing). Telnyx: <1 sec median (private backbone), co-located GPUs eliminate 250ms+ network delays. Critical insight: 50% of voice AI incidents occur in telephony layer, not AI/LLM (4-Stack Incident Response Framework from 1M+ calls analyzed). Compliance: STIR/SHAKEN Full Attestation (A) required by FCC June 30, 2021. Cost: $0.0085-$0.0140/min + hidden carrier rounding fees (61 sec = 2 min billed)."

**Example: Model Stack Research**
- ❌ Shallow (Hobby Project): "GPT-4o is good for voice AI"
- ✅ Production-Grade: "GPT-4o proven in production: Pipecat official quickstart, Twilio ConversationRelay (enterprise), Modal production blog (1-sec latency achieved). Measured performance: 76 tokens/sec output, 0.49s TTFT (not theoretical). Function calling: Proven reliable under latency constraints in production. Cost: ~$0.015-$0.020/min in actual production usage (not just pricing page). Alternative Gemini 2.5 Flash-Lite: Zero documented production voice AI usage in Pipecat community (red flag), unknown streaming behavior for voice, unknown function calling reliability. Production validation: PolyAI + Twilio handling 463k min/month proves GPT-4o at scale."

---

## Production-Grade Standards (Not Hobby Project)

**This research vault is for production-grade voice AI infrastructure handling real customer calls at scale.**

**What "Production-Grade" Means:**
- **Enterprise customers**: Named companies (PolyAI, Zillow, PwC, Samsung, Audi) with measured usage
- **Scale**: 1M+ calls analyzed, 463k min/month deployments, 13.8T+ API calls/year
- **SLA guarantees**: 99.95% uptime (Twilio), 99.8% target (≤8 hours 45 min downtime/year)
- **Measured performance**: P50/P95/P99 latency, not averages that hide worst-case
- **Incident response**: 4-Stack Framework from production systems, resolution time targets
- **Compliance**: FCC mandates (STIR/SHAKEN, E911), GDPR, HIPAA with regulatory citations
- **Cost transparency**: Actual production billing with hidden fees, carrier quirks documented
- **Failover tested**: Multi-provider redundancy with monthly chaos engineering validation

**What Disqualifies as "Hobby Project":**
- ❌ Personal blog posts or Medium articles
- ❌ GitHub repos with <100 stars, no production usage
- ❌ "Getting started" tutorials not used in production
- ❌ Theoretical comparisons without real workloads
- ❌ Marketing claims without customer names
- ❌ Averages without P50/P95/P99 breakdowns
- ❌ Cost estimates without real billing data
- ❌ No failure modes or incident data
- ❌ No SLA guarantees or uptime targets
- ❌ No compliance requirements documented

**Production Validation Signals:**
- ✅ Named enterprise customers with usage data
- ✅ Official framework integrations (Pipecat, Twilio)
- ✅ Managed platform usage (Retell, VAPI, Bland AI)
- ✅ Independent benchmarks (Voice AI Leaderboard, Metrigy)
- ✅ Regulatory compliance (FCC, GDPR, HIPAA)
- ✅ SLA guarantees (99.95%, 99.8%)
- ✅ Measured P50/P95/P99 latency
- ✅ Production incident data (1M+ calls)
- ✅ Actual production costs with hidden fees
- ✅ Failover and redundancy patterns

**If Research Lacks These Signals, It's Not Production-Ready.**

---

## Research Lifecycle

Each research file moves through the following states:

- 🔴 Not started
- 🟡 In progress
- 🟢 Locked (decisions extracted)

Only 🟢 Locked research may be relied on for implementation.

---

## Research Topics

### Core Voice & Realtime (V1)
- 01-turn-taking.md — 🟢 Locked (Updated Feb 2026: Silero VAD v6.2, Pipecat Smart Turn V3, LiveKit Turn Detector v1.3.12)
- 02-audio-latency.md — 🟢 Locked (Updated Feb 2026: WebRTC latency budgets, Silero v6.2, production benchmarks)
- 03-stt-best-practices.md — 🟢 Locked (Updated Feb 2026: Deepgram Nova-3 Jan 2026 refinements, phone audio constraints)
- 04-tts-human-likeness.md — 🟢 Locked (Updated Feb 2026: Cartesia Sonic 3 Oct 2025, 90ms TTFA, 42 languages)
- 04.5-telephony-infrastructure.md — 🟢 Locked (NEW Feb 2026: Twilio vs Telnyx vs SignalWire, 50% of incidents, production data)
- 05-llm-behavior.md — 🔴

### Architecture & Platform
- 06-agent-architecture.md — 🔴
- 07-state-machines.md — 🔴
- 08-tool-gateway-design.md — 🔴
- 09-event-spine.md — 🔴

### Quality, Cost, Scale
- 10-stress-testing.md — 🔴
- 11-observability-metrics.md — 🔴
- 12-model-stack-optimization.md — 🟢 Locked (Updated Feb 2026: GPT-4o production-validated, cascaded architecture, real costs)
- 13-knowledge-bases.md — 🔴
- 14-onboarding-compiler.md — 🔴
- 15-dashboard-requirements.md — 🔴
- 16-multi-tenant-isolation.md — 🔴
- 17-cost-guardrails.md — 🔴

### Near-V2 (Created Early, Researched Later)
- 18-squads.md — 🔴
- 19-training-from-data.md — 🔴
- 20-regional-scaling.md — 🔴

### Research Status Summary (Feb 2026) - Production-Grade

**Completed (🟢 Locked - Production-Validated):** 6 research documents
- 01-turn-taking.md — Based on Pipecat Smart Turn V3, Silero VAD v6.2, LiveKit Turn Detector v1.3.12
- 02-audio-latency.md — Based on WebRTC production benchmarks, Voice AI Leaderboard (1M+ calls)
- 03-stt-best-practices.md — Based on Deepgram Nova-3 (Jan 2026), phone audio constraints (8kHz PSTN)
- 04-tts-human-likeness.md — Based on Cartesia Sonic 3 (Oct 2025), 90ms TTFA, 42 languages
- 04.5-telephony-infrastructure.md — Based on Twilio (99.95% SLA), Telnyx, SignalWire, 50% of incidents
- 12-model-stack-optimization.md — Based on GPT-4o production (Pipecat, Twilio, Modal), cascaded architecture

**Production Validation:**
- ✅ All research based on **1M+ calls analyzed** (Voice AI Leaderboard, 4-Stack Incident Response)
- ✅ **Named enterprise customers**: PolyAI (463k min/month), Zillow, PwC, Samsung, Audi, Phoenix Children's
- ✅ **Official integrations**: Pipecat supported transports, Twilio ConversationRelay, Modal production blog
- ✅ **Measured performance**: P50/P95/P99 latency, 76 tokens/sec GPT-4o, 0.49s TTFT, <1 sec Telnyx
- ✅ **SLA guarantees**: Twilio 99.95%, target 99.8% uptime (≤8 hours 45 min downtime/year)
- ✅ **Compliance**: STIR/SHAKEN (FCC June 30, 2021), E911 (47 CFR Part 9), GDPR, HIPAA
- ✅ **Actual costs**: $0.0085-$0.0140/min Twilio, $0.015-$0.020/min GPT-4o, hidden fees documented

**Key Production Insights:**
- 🔴 **50% of incidents occur in telephony layer** (not AI/LLM) — 4-Stack Incident Response Framework
- 🔴 **GPT-4o is production-proven** for voice AI (Pipecat quickstart, Twilio, Modal) — not Gemini 2.5 Flash-Lite
- 🔴 **Cascaded architecture is correct** (40-60% cost savings, independent debugging, full observability)
- 🔴 **Twilio + Telnyx failover** achieves 99.8% uptime (geo-redundant, circuit breakers, monthly testing)
- 🔴 **Opus codec required** for WebRTC (FEC, PLC, superior packet loss resilience vs G.711)

**Remaining (🔴 Not Started):** 14 research documents for V1, 3 for V2
- All future research must meet same production-grade standards (no hobby projects, no marketing claims)
