# Research: Training from Call Data for Voice AI Systems (V2-Capable Architecture)

## Why This Matters for V1

Training from call data is **not a V1 feature**—but V1 data capture and storage decisions will either enable or permanently block safe, compliant training in V2. The core challenge: voice AI systems generate massive amounts of sensitive call data (audio, transcripts, events), but **naive training approaches catastrophically degrade production systems**. Production evidence from 2025-2026 reveals systematic failures: (1) **catastrophic forgetting**—fine-tuning on domain-specific calls causes models to lose general capabilities, requiring 20x more compute to mitigate, (2) **compliance violations**—training on call recordings without proper consent, PII redaction, and retention policies creates GDPR/CCPA liability, (3) **data quality collapse**—training on unfiltered call data amplifies errors (ASR mistakes, failed conversations, edge cases), degrading model performance, and (4) **prompt engineering > fine-tuning**—production voice AI teams achieve 93% conversation breakdown reduction through prompt optimization alone, deferring expensive fine-tuning.

The pattern is clear: **most production voice AI systems improve through prompt engineering, conversation analytics, and human-in-the-loop QA—not LLM fine-tuning**. Research shows voice AI agents achieve only **42% task success rate** (vs 70% for human agents), with **50% of failures in telephony/audio layers** (not LLM). For V1, this means: **capture structured data for analytics and replay, but don't build training pipelines until validated need exists**.

**V1-AWARE Requirements (Must Exist in V1):**
- **Structured event logging** (not just audio/transcripts) with trace_id for replay and analysis
- **PII redaction pipeline** (automatic redaction of sensitive data in transcripts and events)
- **Consent and retention policies** (GDPR/CCPA compliant data capture with configurable retention)
- **Conversation replay capability** (deterministic replay of conversations for debugging and evaluation)
- **Evaluation framework** (automated metrics for task success, latency, quality without training)

**V2-ONLY Features (Explicitly NOT in V1):**
- LLM fine-tuning pipelines
- Human-in-the-loop labeling workflows
- Active learning sample selection
- Automated retraining loops
- Model versioning and A/B testing for fine-tuned models

## What Matters in Production (Facts Only)

### Why Naive Fine-Tuning Often Degrades Voice Agents

**Core Problem (2025-2026):**
Fine-tuning LLMs on domain-specific call data causes **catastrophic forgetting**—models lose general capabilities acquired during pretraining. This severely limits LLM versatility and affects both domain-specific performance and general task capabilities. Production teams discover that fine-tuning often makes agents **worse**, not better.

**Catastrophic Forgetting Mechanics (Verified 2025-2026):**

**1. Power Law Scaling of Forgetting**
- Forgetting scales predictably as power law with fine-tuning parameters and update steps
- Cannot be avoided through early stopping or parameter adjustment alone
- Requires explicit regularization techniques to mitigate

**2. Knowledge Overwriting**
- Fine-tuning overwrites parameters crucial for general knowledge
- Domain adaptation conflicts with knowledge preservation
- Models lose ability to handle out-of-domain queries

**3. Mitigation Requires 20x More Compute**
- Hierarchical layer-wise and element-wise regularization reduces forgetting
- Requires computing element-wise parameter importance (expensive)
- Testing on GPT-J and LLaMA-3: 20x faster than previous methods, still significant overhead
- 10-15% storage requirements for regularization metadata

**Production Evidence (2025-2026):**

**OpenAI Fine-Tuning Incidents:**
- November 14, 2025: Elevated error rates in fine-tuning for OpenAI mini models
- Required mitigation and monitoring to resolve
- Demonstrates fine-tuning is fragile, even for model providers

**Voice AI Performance Gap:**
- Analysis of 50,000 calls (February 2025): Only **42% success rate** for voice agents
- Human call center agents: **70% first-call resolution rate**
- Performance gap persists despite advances in models
- **50% of incidents occur in telephony and audio layers** (not LLM issues)

**Why Fine-Tuning Fails for Voice AI (Production Insights):**

**1. Wrong Layer of Failure**
- 50% of failures: Telephony and audio (SIP registration, codec problems, WebRTC, VAD)
- 30% of failures: System design (latency, interrupt handling, context loss)
- 20% of failures: LLM behavior (hallucinations, tool calls, prompt following)
- **Fine-tuning only addresses 20% of failures**

**2. Prompt Engineering More Effective**
- Proper voice AI prompt engineering reduces response latency from 1,500ms to <200ms
- Eliminates 93% of conversation breakdowns
- Faster iteration (hours vs weeks for fine-tuning)
- No catastrophic forgetting risk

**3. Data Quality Issues**
- Training on unfiltered call data amplifies errors
- ASR mistakes become training signal (garbage in, garbage out)
- Failed conversations teach model to fail
- Edge cases overrepresented (selection bias)

**4. Compliance and Cost**
- Fine-tuning requires storing call data long-term (compliance risk)
- Compute costs: $10K-$100K+ per fine-tuning run
- Ongoing costs: Retraining as data distribution shifts
- Hosting costs: Fine-tuned models more expensive than base models

**Production Recommendation (2025-2026):**

**Defer Fine-Tuning Until:**
- Prompt engineering exhausted (>10 iterations, A/B tested)
- Conversation analytics identify specific, repeatable LLM failures (not telephony/audio)
- Data quality pipeline validated (PII redacted, errors filtered, balanced sampling)
- Compliance framework in place (consent, retention, audit trail)
- Budget allocated ($50K+ for initial fine-tuning + ongoing retraining)

**V1 Decision**: No LLM fine-tuning in V1. Focus on prompt engineering, conversation analytics, and system-level improvements (latency, audio quality, state machines).

### How Teams Safely Label, Sample, and Replay Call Data

**Core Insight (2025-2026):**
Production teams use **conversation analytics** and **automated QA** to analyze 100% of calls, not manual labeling. Human-in-the-loop labeling reserved for high-value samples (edge cases, failures, compliance audits). Replay capability critical for debugging, not training.

**Production Call Data Pipeline (Verified 2025-2026):**

**Stage 1: Data Capture (V1-AWARE)**

**What to Capture:**
- **Structured events** (not just audio/transcripts): All events with trace_id, sequence numbers, timestamps
- **Audio recordings**: Original audio (if consent obtained), stereo/2-channel for agent and customer
- **Transcripts**: Real-time STT output (partials and finals) with word-level timestamps
- **Conversation state**: State machine transitions, LLM inputs/outputs, tool calls, errors
- **Metadata**: user_id, session_id, agent_id, call duration, outcome, quality metrics

**Storage Architecture:**
- **Hot storage (0-45 days)**: PostgreSQL for events, S3 for audio, Redis for real-time metrics
- **Cold storage (46-365 days)**: S3 Glacier for compliance retention, compressed and encrypted
- **Retention policy**: 90 days default (configurable per tenant), automatic deletion after retention period

**PII Redaction (V1-AWARE):**
- **Automatic redaction**: NER models detect PII in transcripts (names, phone numbers, SSN, credit cards)
- **Multi-pass approach**: Spacy 3 NER + regex for comprehensive redaction
- **Audio redaction**: Beep-out or silence PII segments in audio (based on word-level timestamps)
- **Validation**: Human review of redaction quality on sample (1-2% of calls)
- **Limitations**: ML-based redaction may miss some PII (not 100% accurate), validate before production

**Consent Management (V1-AWARE):**
- **Pre-call disclosure**: "This call may be recorded for quality and training purposes"
- **Opt-out mechanism**: Customer can request no recording (must still capture events for debugging)
- **Consent tracking**: Store consent status per call (recorded, not_recorded, opt_out)
- **Compliance**: GDPR requires specific, informed consent (not vague "may be recorded")

**Stage 2: Conversation Analytics (V1-AWARE)**

**Automated QA (100% Coverage):**
- **Level AI QA-GPT**: Auto-score 100% of interactions at near 100% accuracy, 100M+ interactions annually
- **Vanie Agentic AI**: 100% automated QA across healthcare, fintech, BFSI, BPO
- **Google Cloud Quality AI**: Analyze conversations against custom scorecards
- **Capabilities**: Handle subjective criteria without keyword matching, provide transparent reasoning

**Analytics Dimensions:**
- **Task success**: First-call resolution (FCR), task completion rate, escalation rate
- **Quality metrics**: Customer sentiment, agent script compliance, call duration, hold time
- **Failure analysis**: Identify failure patterns (telephony, audio, LLM, TTS), root cause distribution
- **Performance trends**: Track metrics over time, detect degradation, identify improvement opportunities

**Benefits:**
- **100% coverage** (vs 1-2% with manual QA)
- **Real-time feedback**: Identify issues within minutes, not weeks
- **Objective scoring**: Eliminate human bias and inconsistency
- **Cost reduction**: Eliminate manual QA labor ($50K-$200K annually per QA analyst)

**Stage 3: Intelligent Sampling (V2-ONLY)**

**When Manual Labeling Required:**
- **Edge cases**: Conversations where automated QA confidence <70%
- **Failures**: Calls with errors, escalations, or customer complaints
- **Compliance audits**: Random sample for regulatory compliance (1-5% of calls)
- **Model evaluation**: Ground truth for benchmarking automated QA accuracy

**Sampling Strategies (Active Learning):**
- **Uncertainty sampling**: Select calls where model confidence low (Bayesian methods)
- **Diversity sampling**: Select calls covering different scenarios (x-vectors clustering)
- **Gradient-based sampling**: Expected Gradient Length (EGL) identifies novel, informative samples
- **Ensemble sampling**: REFINE method combines multiple strategies (uncertainty, representativeness)

**Production Evidence:**
- Training with **17% of carefully selected samples** achieves similar accuracy to entire dataset
- Gradient-based methods reduce word errors by **11%** or cut required samples by **50%**
- Bottleneck: Speech data labeling requires **8+ hours per hour of recordings**

**Stage 4: Conversation Replay (V1-AWARE)**

**Replay Capability (Debugging, Not Training):**
- **Deterministic replay**: Replay conversation with same inputs, verify same outputs
- **Voiceflow pattern**: `replay` command replays recorded conversations against dev or production
- **Use cases**: Test changes, demonstrate flows, debug issues, reproduce failures
- **Storage**: Record conversation with `dialog start --record-file`, replay with `replay` command

**Replay Limitations:**
- **Environment changes**: Replays may differ if project modified since recording
- **External dependencies**: APIs, databases, or external services may return different results
- **Non-deterministic LLM**: Same prompt may produce different outputs (temperature >0)

**Observability Integration:**
- **Distributed tracing**: trace_id correlates events across all components
- **Event sourcing**: Append-only event log enables replay from any point
- **Session replay**: Capture timestamped events, visualize conversation flow
- **Dashboard drill-down**: One-click from metrics to conversation transcript to event log

**V1-AWARE Requirements:**

**1. Structured Event Logging (MUST exist in V1)**
- All components emit structured events with trace_id, sequence numbers, timestamps
- Events stored in append-only log (PostgreSQL or Kafka)
- Enables replay, analytics, and debugging
- **V1 implementation**: research/09-event-spine.md

**2. PII Redaction Pipeline (MUST exist in V1)**
- Automatic redaction of PII in transcripts and events
- NER models + regex for comprehensive redaction
- Validation on sample (1-2% of calls)
- **V1 implementation**: Integrate Amazon Transcribe PII redaction or Spacy 3 NER

**3. Consent and Retention Policies (MUST exist in V1)**
- Pre-call disclosure and consent tracking
- Configurable retention period (90 days default)
- Automatic deletion after retention period
- **V1 implementation**: Consent flag per call, cron job for deletion

**4. Conversation Replay Capability (MUST exist in V1)**
- Deterministic replay from event log
- Replay against dev or production environment
- **V1 implementation**: Replay service reads events, re-executes conversation flow

**5. Automated QA and Analytics (MUST exist in V1)**
- 100% conversation coverage with automated scoring
- Real-time metrics dashboard (FCR, sentiment, latency, errors)
- Failure pattern analysis (telephony, audio, LLM, TTS)
- **V1 implementation**: Integrate Level AI, Vanie, or Google Cloud Quality AI

**V2-ONLY Features:**
- Human-in-the-loop labeling workflows
- Active learning sample selection
- Fine-tuning pipelines
- Model versioning and A/B testing

### Human-in-the-Loop vs Automated Training Loops

**Core Tradeoff (2025-2026):**
Human-in-the-loop (HITL) provides high-quality labels but doesn't scale. Automated loops scale but lack nuance. Production systems use **hybrid approach**: automated QA for 100% coverage, HITL for high-value samples.

**Human-in-the-Loop (HITL) Patterns (Verified 2025-2026):**

**1. RLHF (Reinforcement Learning from Human Feedback)**
- **Pipeline**: Supervised fine-tuning → human feedback collection → reward model training → policy optimization
- **Cost**: OpenAI spends $3B annually on ChatGPT training, much for human feedback
- **Scale**: Requires thousands of human labelers for production-quality models
- **Use case**: Aligning models with human values and preferences

**2. Offline HITL (Asynchronous)**
- **Pattern**: Humans label batches of conversations (100-1000s), model retrained periodically
- **Latency**: Days to weeks from feedback to model update
- **Cost**: $50K-$200K annually per labeler (depending on expertise and location)
- **Use case**: Periodic model improvements, compliance audits

**3. Online HITL (Near Real-Time)**
- **Pattern**: Human experts intervene when model confidence low, interactions logged for training
- **Latency**: Minutes to hours from feedback to model update (if automated retraining)
- **Cost**: Higher (requires 24/7 expert availability)
- **Use case**: High-stakes conversations (healthcare, finance), escalation paths

**4. Constitutional AI (AI-Generated Feedback)**
- **Pattern**: Use instructed LLMs following specific principles to generate feedback
- **Cost**: Lower than human labelers (LLM API costs only)
- **Quality**: Lower than human feedback (LLMs have biases and limitations)
- **Use case**: Supplement human feedback, scale to larger datasets

**Automated Training Loops (V2-ONLY):**

**1. Fully Automated QA (100% Coverage)**
- **Pattern**: AI models auto-score all conversations, no human review
- **Accuracy**: Near 100% for objective criteria, 80-90% for subjective criteria
- **Cost**: $10K-$50K annually (platform subscription)
- **Use case**: Continuous monitoring, real-time feedback, trend analysis

**2. RLAIF (Reinforcement Learning from AI Feedback)**
- **Pattern**: Use specialized AI models to provide feedback instead of humans
- **Cost**: Lower than RLHF (no human labelers)
- **Quality**: Comparable to RLHF for many tasks (2025 research)
- **Use case**: Scale beyond human labeling capacity

**3. DPO (Direct Preference Optimization)**
- **Pattern**: Directly optimize model parameters against preference datasets (no reward modeling)
- **Cost**: Lower than RLHF (simpler training pipeline)
- **Quality**: Comparable to RLHF (2025 research)
- **Use case**: Simpler alternative to RLHF

**4. Automated Retraining (Daily/Weekly)**
- **Pattern**: Continuous data pipeline, automated retraining on schedule
- **Cost**: $10K-$100K per retraining run (compute costs)
- **Risk**: Model staleness if not retrained, catastrophic forgetting if retrained too often
- **Use case**: Production ML systems with shifting data distributions

**Hybrid Approach (Production Recommendation 2025-2026):**

**Pattern**: Automated QA for 100% coverage + HITL for high-value samples

**Implementation**:
- **Tier 1 (100% of calls)**: Automated QA scores all conversations, identifies anomalies
- **Tier 2 (5-10% of calls)**: Automated QA flags low-confidence calls for human review
- **Tier 3 (1-2% of calls)**: Human experts label edge cases, failures, compliance audits
- **Tier 4 (0.1% of calls)**: Domain experts label high-stakes conversations (legal, medical)

**Benefits**:
- **Scalability**: Automated QA handles volume
- **Quality**: Human experts handle nuance
- **Cost**: Optimize labeling budget (focus on high-value samples)
- **Compliance**: Human review for regulatory requirements

**V1-AWARE Decision**:
- V1: Automated QA only (100% coverage, no HITL)
- V1: Human review for debugging and compliance audits (ad-hoc, not systematic)
- V2: Add HITL labeling workflows for fine-tuning (if validated need exists)

### What Training Is Feasible at Small vs Large Scale

**Core Insight (2025-2026):**
Training feasibility depends on data volume, budget, and expertise. Small scale (<10K calls/month): prompt engineering only. Medium scale (10K-100K calls/month): automated QA + prompt optimization. Large scale (>100K calls/month): consider fine-tuning if prompt engineering exhausted.

**Small Scale (<10K Calls/Month) - V1 Target:**

**Feasible:**
- ✅ **Prompt engineering**: Iterate on prompts based on conversation analytics
- ✅ **Automated QA**: 100% conversation coverage with automated scoring
- ✅ **Conversation replay**: Debug failures, reproduce issues
- ✅ **A/B testing**: Test prompt variations, measure impact on metrics
- ✅ **Manual review**: Human review of failures and edge cases (ad-hoc)

**Not Feasible:**
- ❌ **LLM fine-tuning**: Insufficient data for meaningful fine-tuning (need 1K-10K labeled examples)
- ❌ **RLHF**: Too expensive (requires thousands of human labels)
- ❌ **Active learning**: Insufficient data for sample selection algorithms
- ❌ **Automated retraining**: Data distribution too sparse for reliable retraining

**Budget**: $10K-$50K annually (automated QA platform + prompt engineering labor)

**V1 Decision**: Focus on prompt engineering and automated QA. Defer fine-tuning to V2.

**Medium Scale (10K-100K Calls/Month) - V2 Early:**

**Feasible:**
- ✅ All small-scale capabilities
- ✅ **Intelligent sampling**: Active learning for high-value sample selection
- ✅ **HITL labeling**: Human labeling of 1-2% of calls (100-2000 calls/month)
- ✅ **Prompt optimization**: Systematic prompt optimization based on analytics
- ✅ **Synthetic data**: Generate synthetic calls for testing edge cases

**Possibly Feasible:**
- ⚠️ **LLM fine-tuning**: If prompt engineering exhausted and budget allocated ($50K-$100K)
- ⚠️ **RLAIF**: If human labeling too expensive, use AI-generated feedback
- ⚠️ **DPO**: Simpler alternative to RLHF if preference data available

**Not Feasible:**
- ❌ **RLHF**: Still too expensive (need 10K+ human labels, $500K+ annually)
- ❌ **Daily retraining**: Data volume insufficient for daily retraining (weekly at most)

**Budget**: $50K-$200K annually (automated QA + HITL labeling + fine-tuning compute)

**V2 Decision**: Add HITL labeling and intelligent sampling. Consider fine-tuning if validated need.

**Large Scale (>100K Calls/Month) - V2 Mature:**

**Feasible:**
- ✅ All medium-scale capabilities
- ✅ **LLM fine-tuning**: Sufficient data for meaningful fine-tuning
- ✅ **RLHF**: Budget for human labeling at scale (10K+ labels)
- ✅ **Automated retraining**: Weekly or daily retraining on new data
- ✅ **A/B testing**: Test fine-tuned models vs base models, measure impact
- ✅ **Model versioning**: Blue-green deployment of fine-tuned models

**Budget**: $200K-$1M+ annually (automated QA + HITL labeling + fine-tuning + retraining + infrastructure)

**V2 Decision**: Full training pipeline if validated need. Still prioritize prompt engineering first.

**Production Evidence (2025-2026):**

**NVIDIA Riva Pattern:**
- GPU-accelerated deployment scales to hundreds/thousands of parallel streams
- Models fine-tuned on custom datasets, optimized for real-time inference (150ms vs 25s on CPU)
- Daily training and deployment as best practice for production ML pipelines

**Appen Audio Data Pattern:**
- 320+ prepared datasets with 13,000+ hours of speech in 80+ languages
- Global audio collection, transcription, annotation with metadata
- Quality assurance with human-in-the-loop validation

**Key Insight**: Large-scale training requires **specialized infrastructure** and **dedicated teams**. Not feasible for V1 or early V2.

### How Training Interacts with Compliance and Consent

**Core Constraint (2025-2026):**
Training on call recordings requires **explicit consent**, **PII redaction**, and **compliant retention policies**. GDPR/CCPA violations carry fines up to €20M or 4% of global revenue. Compliance is non-negotiable for training.

**Consent Requirements (Verified 2025-2026):**

**GDPR (EU) Requirements:**
- **Explicit consent**: Customers must be clearly informed why recording occurs
- **Genuine choice**: Must be able to refuse without service degradation
- **Specific and informed**: Vague "this call may be recorded" insufficient
- **Freely given**: No coercion or negative consequences for refusal

**Legal Bases for Recording:**
1. **Consent**: Customer explicitly agrees to recording for quality and training
2. **Contract performance**: Recording necessary to document agreed terms or verify transactions
3. **Legitimate interest**: Organization justifies recording (e.g., service improvement) if interest outweighs privacy rights

**CCPA (California) Requirements:**
- **Notice**: Inform customers of data collection and use
- **Opt-out**: Provide mechanism for customers to opt out of data sale/sharing
- **Deletion rights**: Customers can request deletion of their data

**Pre-Call Disclosure (Best Practice 2026):**
- "This call will be recorded for quality assurance and training purposes. By continuing, you consent to recording. If you do not consent, please let us know and we will not record this call."
- Store consent status per call: `recorded`, `not_recorded`, `opt_out`
- If customer opts out, still capture events for debugging (not audio/transcripts)

**PII Redaction Requirements (V1-AWARE):**

**What Constitutes PII:**
- **Direct identifiers**: Names, phone numbers, email addresses, SSN, credit card numbers
- **Indirect identifiers**: Account numbers, order IDs, addresses, dates of birth
- **Sensitive data**: Health information (HIPAA), financial data (PCI-DSS), biometric data

**Redaction Techniques (Production Standard 2026):**

**1. Transcript Redaction (Automatic):**
- **NER models**: Spacy 3, Amazon Comprehend, or custom models detect PII entities
- **Multi-pass approach**: NER + regex for comprehensive coverage
- **Redaction format**: Replace PII with `[REDACTED]` or `[NAME]`, `[PHONE]`, `[SSN]`
- **Validation**: Human review of redaction quality on sample (1-2% of calls)

**2. Audio Redaction (Automatic):**
- **Word-level timestamps**: STT provides timestamps for each word
- **Beep-out or silence**: Replace PII segments in audio with beep or silence
- **Challenges**: Requires accurate STT timestamps, may miss PII if STT errors

**3. Event Redaction (Automatic):**
- **Structured data**: Redact PII in event payloads (user_id, account_number, etc.)
- **Hashing**: Replace PII with hashed values for correlation without exposing raw data
- **Encryption**: Encrypt PII at rest, decrypt only for authorized access

**Limitations:**
- **ML-based redaction not 100% accurate**: May miss some PII or over-redact
- **Context-dependent PII**: "John called about his account" - is "John" PII? Depends on context
- **Not HIPAA-compliant**: Amazon Transcribe redaction does not meet HIPAA de-identification requirements

**Retention Policy Requirements (V1-AWARE):**

**Industry Standards (2025-2026):**
- **Default retention**: 90 days for quality assurance purposes
- **Extended retention**: Up to 7 years for compliance (financial services, healthcare)
- **Minimum retention**: 30 days for debugging and analytics
- **Maximum retention**: Varies by jurisdiction (GDPR: as short as possible for purpose)

**Retention Tiers:**
- **Tier 1 (0-45 days)**: Hot storage, full access for debugging and analytics
- **Tier 2 (46-365 days)**: Cold storage, limited access for compliance audits
- **Tier 3 (>365 days)**: Archival or deletion, only if legally required

**Automatic Deletion:**
- **Cron job**: Daily job deletes recordings older than retention period
- **Soft delete**: Mark as deleted, purge after grace period (7-30 days)
- **Audit trail**: Log all deletions for compliance

**Training-Specific Retention:**
- **Training datasets**: May require longer retention (1-3 years) for model retraining
- **Consent required**: Explicit consent for training use (separate from quality assurance)
- **Anonymization**: Anonymize training data (remove all PII) before long-term storage

**Compliance Audit Requirements:**

**What Must Be Auditable:**
- **Consent records**: Who consented, when, for what purpose
- **Redaction logs**: What PII was redacted, when, by what method
- **Access logs**: Who accessed recordings, when, for what purpose
- **Deletion logs**: What recordings were deleted, when, why
- **Training logs**: What data used for training, when, what model

**Audit Frequency:**
- **Internal audits**: Quarterly or annually
- **External audits**: Regulatory audits (varies by jurisdiction)
- **Incident response**: Immediate audit if data breach or compliance violation

**V1-AWARE Requirements:**

**1. Consent Management (MUST exist in V1)**
- Pre-call disclosure and consent tracking
- Opt-out mechanism (customer can refuse recording)
- Consent status stored per call: `recorded`, `not_recorded`, `opt_out`
- **V1 implementation**: Consent flag in database, pre-call announcement

**2. PII Redaction Pipeline (MUST exist in V1)**
- Automatic redaction of PII in transcripts, audio, and events
- NER models + regex for comprehensive coverage
- Validation on sample (1-2% of calls)
- **V1 implementation**: Integrate Amazon Transcribe PII redaction or Spacy 3 NER

**3. Retention Policy Enforcement (MUST exist in V1)**
- Configurable retention period (90 days default)
- Automatic deletion after retention period
- Audit trail for all deletions
- **V1 implementation**: Cron job for deletion, deletion logs in database

**4. Access Control and Audit Logs (MUST exist in V1)**
- Role-based access control (RBAC) for recordings
- Audit logs for all access (who, when, what)
- Encryption at rest and in transit
- **V1 implementation**: PostgreSQL RLS, audit logs in database

**V2-ONLY Features:**
- Training-specific consent (separate from quality assurance)
- Anonymization pipeline for training datasets
- Compliance dashboard (consent rates, redaction quality, retention compliance)

## Common Failure Modes (Observed in Real Systems)

### 1. Catastrophic Forgetting from Naive Fine-Tuning (Power Law Scaling)
**Symptom**: Fine-tune LLM on domain-specific call data. Model improves on domain tasks but loses general capabilities. Cannot handle out-of-domain queries.

**Root cause**: Fine-tuning overwrites parameters crucial for general knowledge. Forgetting scales as power law with fine-tuning parameters and update steps.

**Production impact**: Model becomes brittle, only works for narrow domain. Must retrain from scratch or use expensive regularization (20x compute overhead).

**Observed in**: LLM fine-tuning across all model families (GPT, LLaMA, Gemma). Cannot be avoided through early stopping alone.

**Mitigation**:
- Use hierarchical layer-wise and element-wise regularization (20x faster than previous methods)
- Train with LLM-generated data (reduces forgetting vs ground truth data alone)
- Mask high-perplexity tokens in training data
- Consider prompt engineering instead of fine-tuning (no forgetting risk)

---

### 2. Training on Unfiltered Call Data Amplifies Errors (Garbage In, Garbage Out)
**Symptom**: Fine-tune on all call recordings. Model learns ASR mistakes, failed conversations, edge cases. Performance degrades on production calls.

**Root cause**: Unfiltered data contains errors (ASR mistakes, failed calls, anomalies). Model learns to replicate errors, not correct behavior.

**Production impact**: Model worse than base model. Wasted compute ($10K-$100K per fine-tuning run).

**Observed in**: Production voice AI teams that fine-tune without data quality pipeline.

**Mitigation**:
- Filter training data: Only successful calls (FCR >80%), high-quality transcripts (WER <5%)
- Balance dataset: Equal representation of scenarios (not overweighting edge cases)
- Validate data quality: Human review of sample (1-2% of training data)
- Use synthetic data: Generate clean examples for underrepresented scenarios

---

### 3. Compliance Violations from Training Without Consent (GDPR/CCPA Fines)
**Symptom**: Train on call recordings without explicit consent. Customer files complaint. Regulatory investigation, fines up to €20M or 4% of global revenue.

**Root cause**: Training on call data requires explicit consent (GDPR) or notice + opt-out (CCPA). Vague "this call may be recorded" insufficient.

**Production impact**: Legal liability, fines, reputational damage, must delete all training data.

**Observed in**: Companies that treat training as "quality assurance" (different legal basis).

**Mitigation**:
- Explicit consent for training: "This call will be recorded for quality assurance and training purposes"
- Separate consent for training vs quality assurance (GDPR best practice)
- Opt-out mechanism: Customer can refuse recording
- Retention policy: Delete recordings after retention period (90 days default)
- Audit trail: Log consent, redaction, access, deletion

---

### 4. PII Leakage in Training Data (Data Breach, Compliance Violation)
**Symptom**: Train on call recordings with PII (names, phone numbers, SSN). Model memorizes PII, leaks in responses. Data breach, GDPR violation.

**Root cause**: Insufficient PII redaction. ML-based redaction not 100% accurate, misses some PII.

**Production impact**: Data breach, fines, reputational damage, must retrain model without PII.

**Observed in**: Production systems that rely on automatic redaction without validation.

**Mitigation**:
- Automatic redaction: NER models + regex for comprehensive coverage
- Validation: Human review of redaction quality on sample (1-2% of training data)
- Anonymization: Replace PII with synthetic data (fake names, phone numbers)
- Differential privacy: Add noise to training data to prevent memorization
- Access control: Limit access to unredacted data (only authorized personnel)

---

### 5. Training on Biased Data Amplifies Bias (Fairness Issues)
**Symptom**: Train on call recordings from specific demographics (e.g., English speakers, young adults). Model performs poorly on underrepresented groups (accents, elderly).

**Root cause**: Training data not representative of production distribution. Model learns biases in data.

**Production impact**: Poor performance for underrepresented groups, fairness complaints, reputational damage.

**Observed in**: Voice AI systems trained on narrow datasets (single language, single accent).

**Mitigation**:
- Diverse training data: Multiple languages, accents, ages, genders, contexts
- Balance dataset: Equal representation of demographics (not overweighting majority)
- Fairness metrics: Measure performance across demographics, identify disparities
- Synthetic data: Generate examples for underrepresented groups
- Human review: Validate model behavior across demographics

---

### 6. Overfitting to Training Data (Poor Generalization)
**Symptom**: Fine-tune on small dataset (<1K examples). Model memorizes training data, performs poorly on new calls.

**Root cause**: Insufficient training data for generalization. Model overfits to training examples.

**Production impact**: Model works in testing, fails in production. Wasted compute.

**Observed in**: Small-scale fine-tuning (<10K calls/month) without sufficient data.

**Mitigation**:
- Larger training dataset: 1K-10K labeled examples minimum for fine-tuning
- Regularization: Dropout, weight decay, early stopping to prevent overfitting
- Validation set: Hold out 20% of data for validation, stop training when validation loss increases
- Cross-validation: Train on multiple splits, average performance
- Defer fine-tuning: Use prompt engineering until sufficient data available

---

### 7. Model Staleness from Lack of Retraining (Performance Degradation)
**Symptom**: Fine-tune model once, deploy to production. Over time, performance degrades as data distribution shifts.

**Root cause**: Data distribution changes (new products, new customer demographics, new failure modes). Model trained on old data, doesn't generalize to new data.

**Production impact**: Gradual performance degradation, customer complaints, must retrain.

**Observed in**: Production systems without automated retraining pipelines.

**Mitigation**:
- Automated retraining: Weekly or daily retraining on new data
- Drift detection: Monitor performance metrics, alert when degradation detected
- A/B testing: Test new model vs old model, measure impact before full deployment
- Model versioning: Blue-green deployment, rollback if new model worse
- Continuous data pipeline: Capture and label new data for retraining

---

### 8. Insufficient Data for Fine-Tuning (Wasted Compute)
**Symptom**: Fine-tune on <1K examples. Model doesn't improve over base model. Wasted compute ($10K-$100K).

**Root cause**: Insufficient data for meaningful fine-tuning. Need 1K-10K labeled examples minimum.

**Production impact**: No improvement, wasted budget, delayed timeline.

**Observed in**: Small-scale deployments (<10K calls/month) that attempt fine-tuning too early.

**Mitigation**:
- Defer fine-tuning: Use prompt engineering until sufficient data available
- Data requirements: 1K-10K labeled examples minimum for fine-tuning
- Synthetic data: Generate synthetic examples to augment training data
- Transfer learning: Fine-tune on related domain first, then target domain

---

### 9. No Evaluation Framework for Fine-Tuned Models (Cannot Measure Impact)
**Symptom**: Fine-tune model, deploy to production. Cannot determine if model better or worse than base model.

**Root cause**: No evaluation framework. No metrics, no benchmarks, no A/B testing.

**Production impact**: Cannot justify fine-tuning investment, cannot optimize model.

**Observed in**: Production systems that fine-tune without evaluation.

**Mitigation**:
- Evaluation framework: Define metrics (FCR, latency, quality, cost) before fine-tuning
- Benchmarks: Measure base model performance, set improvement targets
- A/B testing: Test fine-tuned model vs base model, measure impact
- Validation set: Hold out 20% of data for validation, measure performance
- Continuous monitoring: Track metrics in production, alert on degradation

---

### 10. Training Pipeline Complexity Blocks V1 Launch (Over-Engineering)
**Symptom**: Build complex training pipeline (HITL labeling, active learning, fine-tuning, retraining) before V1 launch. Delays launch by 6-12 months.

**Root cause**: Over-engineering. Training not needed for V1 (prompt engineering sufficient).

**Production impact**: Delayed launch, wasted resources, opportunity cost.

**Observed in**: Teams that treat training as V1 requirement (not V2 extension).

**Mitigation**:
- Defer training to V2: Focus on prompt engineering and automated QA for V1
- V1-AWARE architecture: Capture data for training, but don't build training pipeline
- Validate need: Exhaust prompt engineering before investing in fine-tuning
- Incremental approach: Add training capabilities in V2 based on validated need

## Proven Patterns & Techniques

### 1. Structured Event Logging for Replay and Analytics (V1-AWARE)
**Pattern**: Emit structured events (not just audio/transcripts) with trace_id, sequence numbers, timestamps. Store in append-only log for replay and analytics.

**Implementation**:
- All components emit events: STT (partials, finals), LLM (inputs, outputs), TTS (chunks), state machine (transitions)
- Event schema: `{trace_id, sequence_number, timestamp, event_type, payload}`
- Storage: PostgreSQL (structured queries) or Kafka (streaming analytics)
- Retention: 90 days hot storage, 365 days cold storage

**Benefits**:
- **Replay**: Deterministic replay of conversations for debugging
- **Analytics**: Query events for failure patterns, performance trends
- **Compliance**: Audit trail for all actions
- **Training**: Structured data for future training pipelines

**V1 implementation**: research/09-event-spine.md

---

### 2. Automatic PII Redaction Pipeline (V1-AWARE)
**Pattern**: Automatically redact PII in transcripts, audio, and events using NER models + regex. Validate redaction quality on sample.

**Implementation**:
- **Transcript redaction**: Spacy 3 NER or Amazon Transcribe PII redaction
- **Audio redaction**: Beep-out or silence PII segments (based on word-level timestamps)
- **Event redaction**: Hash or encrypt PII in event payloads
- **Validation**: Human review of 1-2% of redacted data

**Benefits**:
- **Compliance**: GDPR/CCPA compliant data capture
- **Security**: Prevent PII leakage in training data
- **Trust**: Customers trust system with sensitive data

**V1 implementation**: Integrate Amazon Transcribe PII redaction or Spacy 3 NER

---

### 3. Consent Management with Opt-Out Mechanism (V1-AWARE)
**Pattern**: Pre-call disclosure with explicit consent for recording and training. Provide opt-out mechanism for customers who refuse.

**Implementation**:
- **Pre-call announcement**: "This call will be recorded for quality assurance and training purposes. By continuing, you consent to recording. If you do not consent, please let us know."
- **Consent tracking**: Store consent status per call: `recorded`, `not_recorded`, `opt_out`
- **Opt-out handling**: If customer opts out, don't record audio/transcripts (still capture events for debugging)

**Benefits**:
- **Compliance**: GDPR/CCPA compliant consent
- **Trust**: Customers feel in control
- **Legal protection**: Clear consent reduces liability

**V1 implementation**: Consent flag in database, pre-call announcement via TTS

---

### 4. Automated QA with 100% Conversation Coverage (V1-AWARE)
**Pattern**: Use AI-powered QA platforms to auto-score 100% of conversations. Eliminate manual QA labor.

**Implementation**:
- **Platforms**: Level AI QA-GPT, Vanie Agentic AI, Google Cloud Quality AI
- **Capabilities**: Auto-score subjective criteria, provide transparent reasoning, handle multiple channels
- **Integration**: API integration with conversation analytics pipeline
- **Metrics**: FCR, sentiment, script compliance, call duration, errors

**Benefits**:
- **100% coverage**: Analyze all calls, not just 1-2% sample
- **Real-time feedback**: Identify issues within minutes
- **Objective scoring**: Eliminate human bias
- **Cost reduction**: Eliminate manual QA labor ($50K-$200K annually per analyst)

**V1 implementation**: Integrate Level AI, Vanie, or Google Cloud Quality AI

---

### 5. Conversation Replay for Debugging (V1-AWARE)
**Pattern**: Replay conversations from event log for debugging. Verify same inputs produce same outputs.

**Implementation**:
- **Record**: Capture all events with `dialog start --record-file`
- **Replay**: Replay conversation with `replay` command against dev or production
- **Validation**: Verify outputs match original conversation (within tolerance for non-deterministic LLM)
- **Use cases**: Test changes, demonstrate flows, debug failures, reproduce issues

**Benefits**:
- **Debugging**: Reproduce failures deterministically
- **Testing**: Verify changes don't break existing flows
- **Demonstration**: Show conversation flows to stakeholders

**V1 implementation**: Replay service reads events from database, re-executes conversation flow

---

### 6. Prompt Engineering Before Fine-Tuning (V1-AWARE)
**Pattern**: Exhaust prompt engineering (>10 iterations, A/B tested) before investing in fine-tuning. Prompt engineering faster, cheaper, lower risk.

**Implementation**:
- **Iteration**: Test prompt variations, measure impact on metrics (FCR, latency, quality)
- **A/B testing**: Test prompts against production traffic, measure statistical significance
- **Voice-specific**: Optimize for conciseness, prosody, turn-taking, interruption handling
- **Latency**: Reduce response latency from 1,500ms to <200ms through prompt optimization

**Benefits**:
- **Faster**: Hours to iterate prompts vs weeks for fine-tuning
- **Cheaper**: No compute costs for fine-tuning
- **Lower risk**: No catastrophic forgetting
- **Effective**: 93% conversation breakdown reduction through prompt optimization

**V1 implementation**: Prompt engineering workflow with A/B testing framework

---

### 7. Intelligent Sampling with Active Learning (V2-ONLY)
**Pattern**: Use active learning to select high-value samples for human labeling. Reduce labeling effort by 50-80%.

**Implementation**:
- **Uncertainty sampling**: Select calls where model confidence low (Bayesian methods)
- **Diversity sampling**: Select calls covering different scenarios (x-vectors clustering)
- **Gradient-based sampling**: Expected Gradient Length (EGL) identifies novel samples
- **Ensemble sampling**: REFINE method combines multiple strategies

**Benefits**:
- **Efficiency**: Train with 17% of carefully selected samples, achieve same accuracy as entire dataset
- **Cost reduction**: Reduce labeling effort by 50-80%
- **Quality**: Focus on informative samples, not random samples

**V2 implementation**: Active learning pipeline with sample selection algorithms

---

### 8. HITL Labeling for High-Value Samples (V2-ONLY)
**Pattern**: Human experts label high-value samples (edge cases, failures, compliance audits). Automated QA handles volume.

**Implementation**:
- **Tier 1 (100%)**: Automated QA scores all conversations
- **Tier 2 (5-10%)**: Automated QA flags low-confidence calls for human review
- **Tier 3 (1-2%)**: Human experts label edge cases, failures, compliance audits
- **Tier 4 (0.1%)**: Domain experts label high-stakes conversations (legal, medical)

**Benefits**:
- **Scalability**: Automated QA handles volume
- **Quality**: Human experts handle nuance
- **Cost optimization**: Focus labeling budget on high-value samples

**V2 implementation**: HITL labeling workflow with tiered review

---

### 9. Fine-Tuning with Catastrophic Forgetting Mitigation (V2-ONLY)
**Pattern**: If fine-tuning required, use regularization techniques to prevent catastrophic forgetting.

**Implementation**:
- **Hierarchical regularization**: Layer-wise and element-wise regularization (20x faster than previous methods)
- **LLM-generated data**: Train with LLM-generated data (reduces forgetting vs ground truth alone)
- **High-perplexity masking**: Mask high-perplexity tokens in training data
- **Validation**: Hold out 20% of data for validation, stop training when validation loss increases

**Benefits**:
- **Preserve general capabilities**: Model retains general knowledge while learning domain-specific tasks
- **Efficiency**: 20x faster than previous regularization methods
- **Quality**: Comparable performance to naive fine-tuning without forgetting

**V2 implementation**: Fine-tuning pipeline with regularization

---

### 10. Model Versioning and A/B Testing (V2-ONLY)
**Pattern**: Version fine-tuned models, A/B test against base model, measure impact before full deployment.

**Implementation**:
- **Versioning**: Immutable model versions (model_v1.0, model_v1.1, model_v2.0)
- **A/B testing**: Route 10% traffic to new model, 90% to old model
- **Metrics**: Measure FCR, latency, quality, cost for both models
- **Statistical significance**: Require p-value <0.05 for deployment decision
- **Rollback**: If new model worse, rollback to old model (blue-green deployment)

**Benefits**:
- **Risk mitigation**: Test before full deployment
- **Data-driven**: Measure impact, not assumptions
- **Rollback capability**: Quick rollback if new model worse

**V2 implementation**: Model versioning with A/B testing framework

## Engineering Rules (Binding)

### R1: V1 MUST Capture Structured Events with trace_id (Not Just Audio/Transcripts)
**Rule**: All components MUST emit structured events with trace_id, sequence numbers, timestamps. Events MUST be stored in append-only log.

**Rationale**: Enables replay, analytics, and future training. Audio/transcripts alone insufficient for debugging and training.

**Implementation**: research/09-event-spine.md

**Verification**: All events have trace_id. Can query events by trace_id, replay conversations.

---

### R2: V1 MUST Implement Automatic PII Redaction Pipeline
**Rule**: PII MUST be automatically redacted in transcripts, audio, and events. Redaction quality MUST be validated on sample (1-2% of calls).

**Rationale**: GDPR/CCPA compliance. Prevent PII leakage in training data.

**Implementation**: Integrate Amazon Transcribe PII redaction or Spacy 3 NER.

**Verification**: PII redacted in transcripts. Human review validates redaction quality.

---

### R3: V1 MUST Implement Consent Management with Opt-Out Mechanism
**Rule**: Pre-call disclosure MUST include explicit consent for recording and training. Customers MUST be able to opt out.

**Rationale**: GDPR/CCPA compliance. Explicit consent required for training.

**Implementation**: Consent flag in database, pre-call announcement via TTS.

**Verification**: Consent status stored per call. Opt-out mechanism tested.

---

### R4: V1 MUST Implement Configurable Retention Policy with Automatic Deletion
**Rule**: Retention period MUST be configurable (90 days default). Recordings MUST be automatically deleted after retention period.

**Rationale**: GDPR/CCPA compliance. Data minimization principle.

**Implementation**: Cron job for deletion, deletion logs in database.

**Verification**: Recordings deleted after retention period. Audit trail for deletions.

---

### R5: V1 MUST Implement Automated QA with 100% Conversation Coverage
**Rule**: All conversations MUST be analyzed by automated QA. Manual QA reserved for high-value samples.

**Rationale**: 100% coverage identifies failures faster. Manual QA doesn't scale.

**Implementation**: Integrate Level AI, Vanie, or Google Cloud Quality AI.

**Verification**: All conversations scored. Metrics dashboard shows FCR, sentiment, errors.

---

### R6: V1 MUST Implement Conversation Replay Capability
**Rule**: Conversations MUST be replayable from event log. Replay MUST be deterministic (within tolerance for non-deterministic LLM).

**Rationale**: Debugging requires reproducibility. Cannot debug without replay.

**Implementation**: Replay service reads events, re-executes conversation flow.

**Verification**: Replay produces same outputs as original conversation (within tolerance).

---

### R7: V1 MUST NOT Implement LLM Fine-Tuning Pipelines
**Rule**: V1 MUST NOT include LLM fine-tuning pipelines. Focus on prompt engineering and automated QA.

**Rationale**: Fine-tuning not needed for V1. Prompt engineering sufficient. Defer to V2.

**Implementation**: No fine-tuning code in V1. Capture data for V2 training.

**Verification**: No fine-tuning pipelines in V1 codebase.

---

### R8: V2 Fine-Tuning MUST Only Proceed After Prompt Engineering Exhausted
**Rule**: Fine-tuning MUST NOT be attempted until prompt engineering exhausted (>10 iterations, A/B tested).

**Rationale**: Prompt engineering faster, cheaper, lower risk. Fine-tuning only if prompt engineering insufficient.

**Implementation**: Prompt engineering workflow with A/B testing. Document prompt iterations.

**Verification**: >10 prompt iterations documented. A/B test results show prompt engineering exhausted.

---

### R9: V2 Training Data MUST Be Filtered for Quality
**Rule**: Training data MUST be filtered: Only successful calls (FCR >80%), high-quality transcripts (WER <5%), balanced dataset.

**Rationale**: Unfiltered data amplifies errors. Garbage in, garbage out.

**Implementation**: Data quality pipeline filters training data. Validation on sample.

**Verification**: Training data filtered. Metrics show FCR >80%, WER <5%.

---

### R10: V2 Fine-Tuning MUST Use Catastrophic Forgetting Mitigation
**Rule**: Fine-tuning MUST use regularization techniques to prevent catastrophic forgetting (hierarchical regularization, LLM-generated data, high-perplexity masking).

**Rationale**: Naive fine-tuning causes catastrophic forgetting. Model loses general capabilities.

**Implementation**: Fine-tuning pipeline with regularization.

**Verification**: Validation set shows model retains general capabilities after fine-tuning.

## Metrics & Signals to Track

### Data Capture Metrics (V1-AWARE)

**Event Capture Rate:**
- Events captured per call (target: 50-200 events per call)
- Event capture latency (P50/P95/P99, target: <100ms)
- Event loss rate (target: <0.1%)

**Consent Metrics:**
- Consent rate (percentage of customers who consent to recording)
- Opt-out rate (percentage of customers who opt out)
- Target: >95% consent rate, <5% opt-out rate

**PII Redaction Metrics:**
- PII entities detected per call (names, phone numbers, SSN, credit cards)
- Redaction accuracy (validated on sample, target: >95%)
- False positive rate (over-redaction, target: <5%)
- False negative rate (missed PII, target: <1%)

**Retention Compliance:**
- Recordings deleted on schedule (target: 100%)
- Retention policy violations (target: 0)
- Audit trail completeness (target: 100%)

### Conversation Analytics Metrics (V1-AWARE)

**Task Success:**
- First-call resolution (FCR, target: >85%)
- Task completion rate (target: >90%)
- Escalation rate (target: <10%)

**Quality Metrics:**
- Customer sentiment (positive, neutral, negative)
- Agent script compliance (target: >90%)
- Call duration (P50/P95/P99)
- Hold time (P50/P95/P99)

**Failure Analysis:**
- Failure rate by layer (telephony, audio, LLM, TTS)
- Root cause distribution (target: identify top 3 root causes)
- Time to resolution (P50/P95/P99)

**Performance Trends:**
- Metrics over time (daily, weekly, monthly)
- Degradation detection (alert if metrics decline >10%)
- Improvement tracking (measure impact of changes)

### Replay Metrics (V1-AWARE)

**Replay Success Rate:**
- Percentage of conversations that replay successfully (target: >95%)
- Replay failures (cannot reproduce, environment changes, external dependencies)

**Replay Accuracy:**
- Percentage of replays that produce same outputs (within tolerance, target: >90%)
- Divergence rate (replays produce different outputs)

**Replay Latency:**
- Time to replay conversation (P50/P95/P99, target: <10 seconds)

### Training Data Quality Metrics (V2-ONLY)

**Data Volume:**
- Calls captured per month (target: >10K for fine-tuning)
- Labeled examples per month (target: >1K for fine-tuning)
- Training dataset size (target: 1K-10K labeled examples)

**Data Quality:**
- Successful calls (FCR >80%, target: >80% of training data)
- High-quality transcripts (WER <5%, target: >90% of training data)
- Balanced dataset (equal representation of scenarios, target: <2x imbalance)

**Labeling Efficiency:**
- Labeling throughput (examples per hour, target: >10 examples/hour)
- Labeling cost (cost per example, target: <$5/example)
- Inter-annotator agreement (Cohen's Kappa, target: >0.8)

### Fine-Tuning Metrics (V2-ONLY)

**Model Performance:**
- Task success rate (FCR, target: >85%)
- Latency (P50/P95/P99, target: <1 second)
- Quality (MOS, sentiment, target: >4.0)
- Cost per call (target: <$0.20)

**Catastrophic Forgetting:**
- General capability retention (validated on held-out set, target: >90%)
- Domain performance (validated on domain-specific set, target: >90%)

**Training Efficiency:**
- Training time (hours, target: <24 hours)
- Training cost (compute, target: <$50K per run)
- Retraining frequency (target: weekly or monthly)

### A/B Testing Metrics (V2-ONLY)

**Experiment Setup:**
- Traffic split (e.g., 10% new model, 90% old model)
- Sample size (target: >1K calls per variant)
- Experiment duration (target: 1-2 weeks)

**Statistical Significance:**
- P-value (target: <0.05 for deployment decision)
- Confidence interval (target: 95%)
- Effect size (target: >10% improvement)

**Deployment Decision:**
- Deploy if new model significantly better (p <0.05, effect size >10%)
- Rollback if new model significantly worse
- Continue testing if no significant difference

## V1 Decisions / Constraints

### D-TRAIN-001 V1 MUST Capture Structured Events for Future Training
**Decision**: All components emit structured events with trace_id, sequence numbers, timestamps. Store in append-only log for replay and analytics.

**Rationale**: Enables future training without migration. Audio/transcripts alone insufficient.

**Constraints**: research/09-event-spine.md

---

### D-TRAIN-002 V1 MUST Implement Automatic PII Redaction
**Decision**: Automatic redaction of PII in transcripts, audio, and events using NER models + regex. Validate on sample (1-2% of calls).

**Rationale**: GDPR/CCPA compliance. Prevent PII leakage in training data.

**Constraints**: Integrate Amazon Transcribe PII redaction or Spacy 3 NER.

---

### D-TRAIN-003 V1 MUST Implement Consent Management with Opt-Out
**Decision**: Pre-call disclosure with explicit consent for recording and training. Provide opt-out mechanism.

**Rationale**: GDPR/CCPA compliance. Explicit consent required for training.

**Constraints**: Consent flag in database, pre-call announcement via TTS.

---

### D-TRAIN-004 V1 MUST Implement Configurable Retention Policy
**Decision**: Retention period configurable (90 days default). Automatic deletion after retention period.

**Rationale**: GDPR/CCPA compliance. Data minimization principle.

**Constraints**: Cron job for deletion, deletion logs in database.

---

### D-TRAIN-005 V1 MUST Implement Automated QA with 100% Coverage
**Decision**: All conversations analyzed by automated QA (Level AI, Vanie, or Google Cloud Quality AI).

**Rationale**: 100% coverage identifies failures faster. Manual QA doesn't scale.

**Constraints**: API integration with conversation analytics pipeline.

---

### D-TRAIN-006 V1 MUST Implement Conversation Replay Capability
**Decision**: Conversations replayable from event log. Deterministic replay (within tolerance for non-deterministic LLM).

**Rationale**: Debugging requires reproducibility.

**Constraints**: Replay service reads events, re-executes conversation flow.

---

### D-TRAIN-007 V1 MUST NOT Implement LLM Fine-Tuning Pipelines
**Decision**: No LLM fine-tuning in V1. Focus on prompt engineering and automated QA.

**Rationale**: Fine-tuning not needed for V1. Defer to V2.

**Constraints**: No fine-tuning code in V1 codebase.

---

### D-TRAIN-008 V1 MUST Prioritize Prompt Engineering Over Fine-Tuning
**Decision**: Exhaust prompt engineering (>10 iterations, A/B tested) before considering fine-tuning in V2.

**Rationale**: Prompt engineering faster, cheaper, lower risk. 93% conversation breakdown reduction through prompt optimization.

**Constraints**: Prompt engineering workflow with A/B testing framework.

---

### D-TRAIN-009 V1 MUST Focus on System-Level Improvements (Not LLM)
**Decision**: V1 improvements focus on telephony, audio, latency, state machines (not LLM fine-tuning).

**Rationale**: 50% of failures in telephony/audio, 30% in system design, 20% in LLM. Fine-tuning only addresses 20%.

**Constraints**: Prioritize improvements in research/04.5-telephony-infrastructure.md, research/02-audio-latency.md, research/07-state-machines.md.

---

### D-TRAIN-010 V2 Fine-Tuning MUST Only Proceed After Validation
**Decision**: Fine-tuning only if prompt engineering exhausted, conversation analytics identify specific LLM failures, data quality pipeline validated, compliance framework in place, budget allocated ($50K+).

**Rationale**: Fine-tuning expensive and risky. Only proceed if validated need.

**Constraints**: Document prompt engineering iterations, conversation analytics findings, data quality metrics, compliance audit.

---

### D-TRAIN-011 V2 Training Data MUST Be Filtered for Quality
**Decision**: Training data filtered: Only successful calls (FCR >80%), high-quality transcripts (WER <5%), balanced dataset.

**Rationale**: Unfiltered data amplifies errors.

**Constraints**: Data quality pipeline with filtering, validation on sample.

---

### D-TRAIN-012 V2 Fine-Tuning MUST Use Catastrophic Forgetting Mitigation
**Decision**: Fine-tuning uses regularization techniques (hierarchical regularization, LLM-generated data, high-perplexity masking).

**Rationale**: Naive fine-tuning causes catastrophic forgetting.

**Constraints**: Fine-tuning pipeline with regularization.

---

### D-TRAIN-013 V2 MUST Implement Intelligent Sampling with Active Learning
**Decision**: Use active learning for sample selection (uncertainty, diversity, gradient-based, ensemble).

**Rationale**: Reduce labeling effort by 50-80%. Train with 17% of carefully selected samples.

**Constraints**: Active learning pipeline with sample selection algorithms.

---

### D-TRAIN-014 V2 MUST Implement HITL Labeling for High-Value Samples
**Decision**: Human experts label high-value samples (edge cases, failures, compliance audits). Automated QA handles volume.

**Rationale**: Scalability + quality. Focus labeling budget on high-value samples.

**Constraints**: HITL labeling workflow with tiered review.

---

### D-TRAIN-015 V2 MUST Implement Model Versioning and A/B Testing
**Decision**: Version fine-tuned models, A/B test against base model, measure impact before full deployment.

**Rationale**: Risk mitigation. Test before full deployment.

**Constraints**: Model versioning with A/B testing framework, blue-green deployment.

## Open Questions / Risks

### Q1: When Is Fine-Tuning Actually Worth It for Voice AI?
**Question**: At what scale and with what evidence should we invest in fine-tuning? What's the ROI threshold?

**Risk**: Fine-tune too early → wasted budget, no improvement. Fine-tune too late → miss optimization opportunity.

**Mitigation options**:
- Threshold: >10K calls/month, prompt engineering exhausted (>10 iterations), conversation analytics show specific LLM failures (not telephony/audio)
- ROI calculation: Fine-tuning cost ($50K-$100K) vs expected improvement (>10% FCR increase)
- A/B test: Measure actual impact, not assumptions

**V2 decision**: Fine-tuning only if prompt engineering exhausted, validated LLM failures, budget allocated, ROI >2x.

---

### Q2: How to Balance Data Retention for Training vs Compliance Minimization?
**Question**: GDPR requires data minimization (delete ASAP), but training requires long retention (1-3 years). How to balance?

**Risk**: Short retention → insufficient training data. Long retention → compliance risk, higher storage costs.

**Mitigation options**:
- Separate retention for training vs quality assurance (explicit consent for training)
- Anonymization: Anonymize training data (remove all PII) for long-term storage
- Synthetic data: Generate synthetic examples instead of storing real calls
- Tiered retention: 90 days for quality assurance, 1-3 years for anonymized training data

**V2 decision**: Separate consent for training, anonymize training data, 1-year retention for anonymized data.

---

### Q3: How to Handle Multi-Tenant Training Data Isolation?
**Question**: Should training data be pooled across tenants or isolated per tenant? Pooled data improves model, but risks data leakage.

**Risk**: Pooled data → potential data leakage, compliance issues. Isolated data → insufficient data per tenant, poor model quality.

**Mitigation options**:
- Pooled data with strict anonymization (remove all tenant-specific identifiers)
- Isolated data for high-security tenants (healthcare, finance)
- Hybrid: Pool data for general capabilities, fine-tune per tenant for specific capabilities
- Federated learning: Train on tenant data without centralizing (privacy-preserving)

**V2 decision**: Pooled data with anonymization for V2. Isolated data for high-security tenants in V3.

---

### Q4: How to Measure Training Data Quality Objectively?
**Question**: What metrics determine if training data is "high quality"? How to validate before fine-tuning?

**Risk**: Train on low-quality data → model degradation. Discard high-quality data → insufficient training data.

**Mitigation options**:
- Objective metrics: FCR >80%, WER <5%, call duration within normal range, no errors
- Subjective metrics: Human review of sample (1-2% of training data), inter-annotator agreement >0.8
- Automated filtering: Filter out failed calls, poor transcripts, anomalies
- Validation: Train on sample, measure performance on validation set before full fine-tuning

**V2 decision**: Objective metrics (FCR, WER) + human validation on sample (1-2%).

---

### Q5: How to Handle ASR Errors in Training Data?
**Question**: ASR makes mistakes (WER 5-10%). Should we correct errors before training or train on raw transcripts?

**Risk**: Train on errors → model learns mistakes. Correct errors → expensive, time-consuming.

**Mitigation options**:
- Filter out poor transcripts (WER >10%)
- Human correction of high-value samples (edge cases, failures)
- Train on raw transcripts with confidence scores (weight high-confidence tokens more)
- Use audio features directly (not transcripts) for training

**V2 decision**: Filter out poor transcripts (WER >10%), human correction of high-value samples.

---

### Q6: How to Handle Synthetic Data for Training?
**Question**: Should we generate synthetic call data to augment training data? What's the quality vs cost tradeoff?

**Risk**: Synthetic data too different from real data → poor generalization. Real data insufficient → underfitting.

**Mitigation options**:
- Synthetic data for underrepresented scenarios (edge cases, rare intents)
- Validate synthetic data quality (human review, automated metrics)
- Mix synthetic and real data (e.g., 20% synthetic, 80% real)
- Use LLM-generated data (reduces catastrophic forgetting vs ground truth alone)

**V2 decision**: Synthetic data for underrepresented scenarios, validate quality, mix with real data.

---

### Q7: How to Handle Model Staleness and Retraining Frequency?
**Question**: How often should we retrain models? Daily, weekly, monthly? What triggers retraining?

**Risk**: Retrain too often → high compute costs, catastrophic forgetting. Retrain too rarely → model staleness, performance degradation.

**Mitigation options**:
- Drift detection: Monitor performance metrics, retrain when degradation detected (>10% FCR decline)
- Scheduled retraining: Weekly or monthly retraining on new data
- Adaptive retraining: Retrain when sufficient new data available (e.g., >1K new labeled examples)
- Cost-benefit analysis: Retrain only if expected improvement > retraining cost

**V2 decision**: Drift detection + scheduled retraining (monthly), adaptive retraining if sufficient new data.

---

### Q8: How to Handle Fine-Tuning for Multiple Languages?
**Question**: Should we fine-tune separate models per language or single multilingual model? What's the quality vs cost tradeoff?

**Risk**: Separate models → high compute costs, maintenance burden. Single model → lower quality per language.

**Mitigation options**:
- Single multilingual model for V2 (lower cost, simpler maintenance)
- Separate models for high-volume languages in V3 (if validated need)
- Language-specific prompts (optimize prompts per language before fine-tuning)
- Evaluate per-language performance, fine-tune only if multilingual model insufficient

**V2 decision**: Single multilingual model, language-specific prompts, evaluate per-language performance.

---

### Q9: How to Handle Training for Edge Cases vs Common Cases?
**Question**: Should we oversample edge cases in training data to improve edge case performance? What's the tradeoff?

**Risk**: Oversample edge cases → poor performance on common cases. Undersample edge cases → poor edge case performance.

**Mitigation options**:
- Balanced dataset: Equal representation of common and edge cases
- Weighted sampling: Weight edge cases higher during training (without oversampling)
- Separate models: Base model for common cases, fine-tuned model for edge cases
- Evaluate on both common and edge cases, optimize for overall performance

**V2 decision**: Balanced dataset, evaluate on both common and edge cases.

---

### Q10: How to Handle Compliance Audits for Training Data?
**Question**: What audit trail is required for training data? How to prove compliance with GDPR/CCPA?

**Risk**: Insufficient audit trail → compliance violations, fines. Excessive audit trail → high storage costs.

**Mitigation options**:
- Audit trail: Log consent, redaction, access, deletion, training use
- Compliance dashboard: Show consent rates, redaction quality, retention compliance, training data usage
- Regular audits: Quarterly internal audits, annual external audits
- Incident response: Immediate audit if data breach or compliance violation

**V2 decision**: Audit trail for all training data operations, compliance dashboard, quarterly internal audits.
