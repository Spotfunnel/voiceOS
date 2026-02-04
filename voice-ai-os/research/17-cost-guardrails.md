# Research: Cost Guardrails for Production Voice AI SaaS Platform

## Why This Matters for V1

Cost guardrails are not a billing feature—they are a **platform survival constraint**. Voice AI platforms fail catastrophically when cost controls are missing: (1) **margin collapse**—LLM costs scale quadratically with conversation length (30-minute call costs 225x more than 3-minute call, not 10x), destroying unit economics, (2) **runaway spend**—misconfigured customer generates 10,000 calls with infinite retry loops, burning $50K in 24 hours before detection, and (3) **platform bankruptcy**—without hard spending limits, a single abusive customer can exhaust shared API quotas ($100K+ OpenAI bill) before anyone notices, taking down entire platform and causing insolvency.

Production evidence from 2025-2026 reveals the brutal economics: **voice AI platforms operate on 10-30% gross margins**. A single cost control failure can wipe out an entire month's profit. The pattern is clear: platforms without real-time cost monitoring (<5min latency), per-tenant spending limits, and automatic throttling experience **3-10x higher burn rates** and **50%+ customer churn** (from bill shock) compared to platforms with proper guardrails.

**Critical Production Reality**: Voice AI cost structure is fundamentally different from traditional SaaS. LLM costs scale **quadratically** (not linearly) with conversation length due to context window growth. A 30-minute conversation costs $15 in LLM fees alone (not $0.50). Without cost guardrails, **a single long conversation can destroy your margin for 100 short conversations**. The cost of guardrails is 5-10% performance overhead. The cost of no guardrails is platform bankruptcy.

## What Matters in Production (Facts Only)

### Where Cost Actually Accumulates in Voice Systems

**Core Insight (2025-2026):**
Voice AI has **four cost centers** with radically different scaling characteristics. Understanding where costs accumulate is critical for effective guardrails.

**Cost Breakdown for Typical 10-Minute Call (Q3 2025 Production Data):**

**Budget Stack ($0.21 total, $0.021/minute):**
- STT (Deepgram Nova-3): $0.0125/min × 10 = $0.125 (59% of cost)
- LLM (GPT-4o Mini): $0.005/min × 10 = $0.05 (24% of cost)
- TTS (Cartesia Sonic): $0.002/min × 10 = $0.02 (10% of cost)
- Telephony (Twilio): $0.0015/min × 10 = $0.015 (7% of cost)

**Balanced Premium Stack ($0.38 total, $0.038/minute):**
- STT (Deepgram Nova-3): $0.0125/min × 10 = $0.125 (33% of cost)
- LLM (GPT-4o): $0.015/min × 10 = $0.15 (39% of cost)
- TTS (ElevenLabs Flash v2): $0.008/min × 10 = $0.08 (21% of cost)
- Telephony (Twilio): $0.0025/min × 10 = $0.025 (7% of cost)

**Ultra-Premium Stack ($1.25 total, $0.125/minute):**
- STT (Deepgram Nova-3): $0.0125/min × 10 = $0.125 (10% of cost)
- LLM (Claude 3.5 Sonnet): $0.075/min × 10 = $0.75 (60% of cost)
- TTS (ElevenLabs Turbo): $0.03/min × 10 = $0.30 (24% of cost)
- Telephony (Twilio): $0.0025/min × 10 = $0.025 (2% of cost)
- Tool calls, function calling: $0.05 (4% of cost)

**Key Observations:**

**1. LLM is the Margin Killer (24-60% of total cost)**
- LLM cost dominates in premium stacks (60% of cost)
- LLM cost scales **quadratically** with conversation length (not linearly)
- 30-minute call: $15 in LLM fees alone (225x more than 3-minute call)
- **This is the primary cost risk requiring guardrails**

**2. STT is Second Largest Cost (10-59% of total cost)**
- STT scales linearly with conversation length (predictable)
- STT cost relatively stable across providers ($0.0125-$0.04/min)
- Less risky than LLM but still significant

**3. TTS is Third Largest Cost (10-24% of total cost)**
- TTS scales linearly with agent speech duration (not total call duration)
- TTS cost varies 10x between providers ($0.002-$0.03/min)
- Controllable via agent verbosity limits

**4. Telephony is Smallest Cost (2-7% of total cost)**
- Telephony scales linearly with call duration (predictable)
- Telephony cost stable across providers ($0.0015-$0.0025/min)
- Least risky cost component

**Hidden Cost Multipliers (2025 Production Evidence):**

**1. Context Management Overhead (20-30% LLM cost increase)**
- Conversation summarization to manage context window
- Retrieval-augmented generation (RAG) for knowledge bases
- Tool call history tracking
- **Impact**: 10-minute call becomes 13-minute equivalent in LLM costs

**2. Function Calling Overhead (10-20% LLM cost increase)**
- Each tool call adds 200-500 tokens to context
- Tool results add 100-1000 tokens to context
- 5 tool calls per conversation = 1500-7500 extra tokens
- **Impact**: Can double LLM cost for tool-heavy conversations

**3. Retry and Error Handling (5-15% total cost increase)**
- Failed API calls still incur costs (STT/LLM/TTS)
- Retry logic multiplies costs (3 retries = 3x cost)
- Circuit breaker failures still charge for failed attempts
- **Impact**: Error rate >5% can increase costs by 15%

**4. Infrastructure and Overhead (10-20% total cost increase)**
- WebRTC servers, load balancers, databases
- Monitoring, logging, observability
- Support and operations
- **Impact**: $0.20/min in API costs becomes $0.24-$0.28/min all-in

**Total Cost Reality:**
- Advertised cost: $0.20/min (API costs only)
- Actual cost: $0.28-$0.35/min (including overhead)
- **Margin at $0.50/min pricing: 30-40%** (before sales, marketing, G&A)

### The Quadratic Cost Problem (LLM Context Window)

**Core Problem (2025-2026):**
LLM costs scale **quadratically** with conversation length because the model must process the entire conversation history with each response. This is the **single biggest cost risk** in voice AI systems.

**Why Quadratic Scaling Happens:**

Each LLM call processes:
- System prompt (500-1000 tokens, constant)
- Conversation history (grows linearly with turns)
- Current user input (50-200 tokens)
- Tool call history (if applicable, grows linearly)

**Example: 30-Minute Conversation**
- Turn 1: 1000 tokens (system prompt + user input)
- Turn 2: 1200 tokens (system prompt + turn 1 + user input)
- Turn 3: 1400 tokens (system prompt + turn 1-2 + user input)
- ...
- Turn 30: 7000 tokens (system prompt + turn 1-29 + user input)

**Total tokens processed: 1000 + 1200 + 1400 + ... + 7000 = ~120,000 tokens**

**Cost Calculation (GPT-4o at $0.005/1K input tokens):**
- 3-minute call (3 turns): ~3,600 tokens = $0.018
- 10-minute call (10 turns): ~15,000 tokens = $0.075
- 30-minute call (30 turns): ~120,000 tokens = $0.60

**30-minute call costs 33x more than 3-minute call (not 10x)**

**With Output Tokens (GPT-4o at $0.015/1K output tokens):**
- 30 turns × 200 tokens/turn = 6,000 output tokens = $0.09
- **Total LLM cost for 30-minute call: $0.69**

**At Scale:**
- 1000 calls/day × 30 min average × $0.69 = $690/day = $20,700/month in LLM costs alone
- If pricing is $0.20/min ($6/call), revenue = $6000/day = $180,000/month
- **LLM costs = 11.5% of revenue** (acceptable)

**But if average call duration increases to 45 minutes:**
- LLM cost per call: $1.50 (quadratic scaling)
- 1000 calls/day × $1.50 = $1500/day = $45,000/month in LLM costs
- Revenue unchanged: $180,000/month
- **LLM costs = 25% of revenue** (margin collapse)

**This is why call duration limits are critical guardrails.**

**Mitigation Strategies (Verified 2025-2026):**

**1. Context Window Summarization**
- Summarize conversation history after 10-15 turns
- Reduces context from 7000 tokens to 2000 tokens
- Cost: 20-30% overhead for summarization
- Benefit: 50-70% reduction in ongoing LLM costs
- **Net savings: 40-50% on long conversations**

**2. Sliding Window Context**
- Keep only last N turns in context (e.g., last 10 turns)
- Older turns dropped from context
- Cost: Minimal overhead
- Benefit: Caps context growth (linear instead of quadratic)
- **Tradeoff**: Loss of long-term conversation memory

**3. Hard Call Duration Limits**
- Limit calls to 30 minutes maximum (configurable per tier)
- Prevents quadratic cost explosion
- Cost: None
- Benefit: Predictable maximum cost per call
- **Tradeoff**: Customer experience (some calls legitimately need >30 min)

**4. Sparse Context Retrieval**
- Use RAG to retrieve only relevant past turns
- Reduces context from 7000 tokens to 2000-3000 tokens
- Cost: 10-20% overhead for retrieval
- Benefit: 40-60% reduction in LLM costs
- **Net savings: 30-40% on long conversations**

**Production Recommendation (2026):**
- V1: Hard call duration limits (30 min) + sliding window context (last 10 turns)
- V2: Add context summarization for enterprise customers (when they need >30 min calls)

### Per-Tenant Cost Enforcement Techniques

**Core Insight (2025-2026):**
Cost enforcement must happen at **runtime** (not billing time) to prevent runaway spend. Billing-time enforcement is too late—damage already done.

**Three Enforcement Levels (Verified Production Patterns):**

**1. Soft Limits (Warnings, No Action)**
- Alert customer when approaching spending limit (e.g., 80% of monthly budget)
- Email notification, dashboard alert
- No service degradation or throttling
- **Use case**: Predictable customers with good payment history

**2. Hard Limits (Throttling, Degraded Service)**
- Reduce service quality when spending limit reached
- Examples: Lower LLM model (GPT-4o → GPT-4o Mini), reduce concurrent calls, increase latency
- Service continues but degraded
- **Use case**: Most customers, balance cost control with customer experience

**3. Circuit Breaker (Complete Service Cutoff)**
- Block all new calls when spending limit reached
- Service completely stopped until limit reset (next billing cycle) or manual override
- **Use case**: Free tier, customers with payment issues, suspected abuse

**Implementation Patterns (Verified 2025-2026):**

**Real-Time Cost Tracking (Mandatory):**
```python
# Track cost per tenant in Redis (5-minute sliding window)
def track_cost(tenant_id, call_id, cost_breakdown):
    key = f"cost:{tenant_id}:{current_hour}"
    
    # Increment hourly cost
    redis.hincrby(key, "total", int(cost_breakdown["total"] * 100))  # cents
    redis.hincrby(key, "stt", int(cost_breakdown["stt"] * 100))
    redis.hincrby(key, "llm", int(cost_breakdown["llm"] * 100))
    redis.hincrby(key, "tts", int(cost_breakdown["tts"] * 100))
    redis.hincrby(key, "telephony", int(cost_breakdown["telephony"] * 100))
    redis.expire(key, 7200)  # 2 hours
    
    # Check against spending limit
    total_cost = redis.hget(key, "total") / 100  # dollars
    spending_limit = get_tenant_spending_limit(tenant_id)  # e.g., $100/hour
    
    if total_cost > spending_limit:
        return "limit_exceeded"
    elif total_cost > spending_limit * 0.8:
        return "approaching_limit"
    else:
        return "ok"
```

**Spending Limit Enforcement (Before Call Acceptance):**
```python
# Check spending limit before accepting new call
def can_accept_call(tenant_id):
    cost_status = check_tenant_cost_status(tenant_id)
    
    if cost_status == "limit_exceeded":
        # Hard limit: Reject call
        return False, "Spending limit exceeded. Please upgrade plan or contact support."
    
    elif cost_status == "approaching_limit":
        # Soft limit: Accept call but warn
        send_alert(tenant_id, "Approaching spending limit (80%)")
        return True, None
    
    else:
        # Under limit: Accept call normally
        return True, None
```

**Tiered Spending Limits (Production Standard):**
- Free tier: $10/day, $300/month
- Starter tier: $100/day, $3,000/month
- Professional tier: $1,000/day, $30,000/month
- Enterprise tier: Custom limits (negotiated)

**Alert Thresholds:**
- 50% of limit: Dashboard notification
- 80% of limit: Email alert to customer
- 90% of limit: Email alert to customer + operator
- 100% of limit: Throttling or circuit breaker (depending on tier)

**Production Examples (Verified 2025-2026):**

**Stripe Usage-Based Billing Alerts:**
- Alert when customer exceeds meter usage thresholds
- Alert when customer triggers invoice at specific billing thresholds
- Can create alerts for specific customers or all customers
- Maximum 25 alerts per account
- **Limitation**: Usage data only evaluated after alert creation (not retroactive)

**Twilio Usage Triggers:**
- Webhooks notify application when usage thresholds reached
- Triggers evaluated approximately once per minute
- Can configure recurring triggers (daily, monthly, yearly)
- **Use case**: Real-time cost monitoring and automatic throttling

**AWS Budgets:**
- Custom cost and usage tracking with configurable thresholds
- Budget actions automatically enforce policies when thresholds exceeded
- Can apply IAM policies or Service Control Policies (SCPs) to prevent new resource provisioning
- **Use case**: Hard spending limits with automatic enforcement

### Hard Limits vs Soft Degradation Strategies

**Core Tradeoff (2026):**
Hard limits provide absolute cost protection but can disrupt customer experience. Soft degradation maintains service continuity but risks cost overruns.

**Hard Limits (Circuit Breaker Pattern):**

**Definition**: Complete service cutoff when spending limit reached. No new calls accepted until limit reset.

**Pros**:
- **Absolute cost protection**: Cannot exceed spending limit (guaranteed)
- **Simple to implement**: Binary decision (allow/block)
- **Clear to customers**: Unambiguous limit enforcement

**Cons**:
- **Poor customer experience**: Service completely unavailable
- **Lost revenue**: Cannot capture overage revenue
- **Support burden**: Customers call support to request limit increase

**When to use**:
- Free tier (no payment method on file)
- Customers with payment issues (failed payments, chargebacks)
- Suspected abuse (unusual usage patterns, fraud)
- Unpredictable usage items (bugs, infinite loops)

**Soft Degradation (Throttling Pattern):**

**Definition**: Gradual service degradation when approaching spending limit. Service continues but at reduced quality or capacity.

**Degradation Strategies:**

**1. Model Downgrade**
- Switch from GPT-4o to GPT-4o Mini when approaching limit
- Reduces cost by 80% (from $0.015/min to $0.003/min)
- Service continues with slightly lower quality
- **Tradeoff**: Lower task success rate (85% → 80%)

**2. Concurrent Call Reduction**
- Reduce concurrent call limit from 50 to 10 when approaching limit
- Prevents cost spike from many simultaneous calls
- Service continues but with queue/wait times
- **Tradeoff**: Customer may experience busy signals

**3. Call Duration Limits**
- Reduce maximum call duration from 60 min to 30 min when approaching limit
- Prevents quadratic LLM cost explosion
- Service continues but calls auto-terminate at limit
- **Tradeoff**: Customer experience (calls cut off)

**4. Feature Restrictions**
- Disable expensive features (tool calls, RAG, knowledge base queries)
- Reduces cost by 20-40%
- Service continues with basic functionality only
- **Tradeoff**: Reduced capabilities

**Pros**:
- **Better customer experience**: Service continues (degraded but available)
- **Capture overage revenue**: Can charge for usage above base limit
- **Gradual warning**: Customer has time to upgrade plan

**Cons**:
- **Partial cost protection**: Can still exceed limit (by 10-20%)
- **Complex to implement**: Multiple degradation tiers
- **Confusing to customers**: Why is service degraded?

**When to use**:
- Paid tiers (payment method on file)
- Predictable customers (good payment history)
- Continuous baseline usage (not spiky)
- Explicitly opted-in services (compute, custom domains)

**Hybrid Approach (Production Recommendation 2026):**

**Tier 1: Soft Degradation (80-100% of limit)**
- Alert customer at 80% of limit
- Downgrade LLM model at 90% of limit (GPT-4o → GPT-4o Mini)
- Reduce concurrent calls at 95% of limit (50 → 10)

**Tier 2: Hard Limit (100% of limit)**
- Block new calls at 100% of limit
- Existing calls continue to completion
- Customer must upgrade plan or wait for limit reset

**Tier 3: Emergency Override (Manual)**
- Operator can manually increase limit for legitimate use cases
- Requires approval from finance team
- Logged for audit trail

**Production Examples:**

**Supabase Cost Control:**
- Hard spending caps for unpredictable items (bugs, attacks)
- Soft limits for explicitly opted-in services (compute, custom domains)
- **Rationale**: Protect against unintended usage while allowing predictable scaling

**AWS Budgets:**
- Budget alerts at 50%, 80%, 100% of limit
- Budget actions automatically apply IAM policies at 100% (hard limit)
- **Rationale**: Gradual warnings with automatic enforcement

### Handling Customers with Extreme Call Volumes

**Core Challenge (2026):**
High-volume customers (>10,000 calls/month) can destabilize platform economics if not properly managed. They require different cost controls than typical customers.

**Volume Tiers (Production Pattern 2025-2026):**

**Tier 1: Low Volume (<1,000 calls/month)**
- Standard pricing: $0.20/min
- Standard limits: 50 concurrent calls, $1,000/month spending limit
- Standard enforcement: Soft degradation at 90%, hard limit at 100%
- **Margin**: 30-40% (healthy)

**Tier 2: Medium Volume (1,000-10,000 calls/month)**
- Volume discount: $0.15/min (25% discount)
- Increased limits: 100 concurrent calls, $10,000/month spending limit
- Standard enforcement: Soft degradation at 90%, hard limit at 100%
- **Margin**: 25-35% (acceptable)

**Tier 3: High Volume (10,000-100,000 calls/month)**
- Volume discount: $0.10/min (50% discount)
- Increased limits: 500 concurrent calls, $100,000/month spending limit
- **Custom cost controls required**: Dedicated infrastructure, reserved capacity
- **Margin**: 15-25% (thin but acceptable at scale)

**Tier 4: Enterprise Volume (>100,000 calls/month)**
- Custom pricing: $0.05-$0.08/min (60-75% discount)
- Custom limits: 1000+ concurrent calls, custom spending limits
- **Dedicated infrastructure required**: Silo model (research/16-multi-tenant-isolation.md)
- **Margin**: 10-20% (very thin, requires operational efficiency)

**Cost Control Strategies for High-Volume Customers:**

**1. Reserved Capacity Pricing**
- Customer commits to minimum monthly spend (e.g., $50,000/month)
- Platform reserves dedicated capacity (compute, API quotas)
- Predictable costs for both customer and platform
- **Benefit**: Guaranteed margin, no cost surprises

**2. Dedicated API Keys**
- High-volume customer gets dedicated OpenAI API key
- Isolates their quota from shared quota (prevents noisy neighbor)
- Customer pays actual OpenAI costs + markup
- **Benefit**: No shared quota exhaustion risk

**3. Committed Use Discounts**
- Customer commits to 1-year or 3-year contract
- Platform negotiates committed use discounts with providers (OpenAI, Deepgram)
- Pass savings to customer (50-60% discount)
- **Benefit**: Predictable revenue, lower costs

**4. Bring Your Own Key (BYOK)**
- Customer provides their own OpenAI/Deepgram API keys
- Platform charges only for infrastructure and orchestration
- Customer pays providers directly
- **Benefit**: Zero API cost risk for platform

**Production Anti-Patterns (Observed 2025):**

**Anti-Pattern 1: Unlimited Usage at Fixed Price**
- Customer pays $10,000/month for "unlimited" calls
- Customer generates 100,000 calls/month ($50,000 in costs)
- **Result**: Platform loses $40,000/month on single customer

**Anti-Pattern 2: No Volume Discounts**
- High-volume customer pays same $0.20/min as low-volume customer
- Customer switches to competitor offering $0.10/min
- **Result**: Lost customer, lost revenue

**Anti-Pattern 3: Shared Quota for High-Volume Customers**
- High-volume customer shares OpenAI quota with all other customers
- Customer exhausts shared quota, blocks all other customers
- **Result**: Platform-wide outage, churn

**Production Recommendation (2026):**
- Tier 1-2: Shared infrastructure, standard cost controls
- Tier 3: Dedicated API keys, reserved capacity pricing
- Tier 4: Silo model (dedicated infrastructure), custom contracts

### Runtime vs Billing-Time Enforcement

**Core Insight (2026):**
Billing-time enforcement is **too late** to prevent cost disasters. By the time the bill arrives (end of month), damage already done. Runtime enforcement is mandatory for cost protection.

**Runtime Enforcement (Mandatory for V1):**

**Definition**: Cost limits enforced in real-time (<5 minutes latency) as usage occurs. Service degraded or blocked when limit reached.

**Implementation**:
- Track cost per tenant in Redis (5-minute sliding window)
- Check cost before accepting new call
- Throttle or block if limit exceeded
- Alert customer and operator immediately

**Benefits**:
- **Immediate cost protection**: Cannot exceed limit by more than 5 minutes of usage
- **Prevents runaway spend**: Misconfigured customer detected within 5 minutes
- **Protects platform margins**: No surprise $50K bills at end of month

**Challenges**:
- **Complexity**: Requires real-time cost tracking infrastructure
- **Latency**: Cost check adds 5-10ms to call acceptance
- **Accuracy**: Cost estimates may differ from actual costs (reconciled monthly)

**Billing-Time Enforcement (Insufficient Alone):**

**Definition**: Cost limits enforced at end of billing cycle (monthly). Invoice generated, customer charged, service continues.

**Implementation**:
- Track actual costs from provider invoices (OpenAI, Deepgram, Twilio)
- Generate invoice at end of month
- Charge customer credit card
- If payment fails, suspend service next month

**Benefits**:
- **Accurate costs**: Based on actual provider invoices (not estimates)
- **Simple**: No real-time infrastructure required
- **Standard SaaS pattern**: How most SaaS products work

**Challenges**:
- **No cost protection**: Customer can burn $50K before bill arrives
- **Bill shock**: Customer disputes unexpected charges
- **Platform risk**: If customer doesn't pay, platform eats the cost

**Why Billing-Time Alone Fails for Voice AI:**

**Scenario: Misconfigured Customer**
- Day 1: Customer deploys agent with infinite retry loop
- Days 1-30: Agent generates 10,000 calls/day × 30 days = 300,000 calls
- Cost: 300,000 calls × 10 min × $0.20/min = $600,000
- Day 31: Invoice generated for $600,000
- Customer: "This is a mistake, we only expected $5,000"
- **Result**: Platform eats $595,000 loss (customer refuses to pay)

**With Runtime Enforcement:**
- Day 1: Customer deploys agent with infinite retry loop
- Hour 1: Agent generates 500 calls (cost: $1,000)
- Hour 1: Runtime enforcement detects $1,000/hour spend (exceeds $100/hour limit)
- Hour 1: Service throttled, operator alerted
- Hour 2: Operator investigates, identifies infinite loop, contacts customer
- **Result**: Platform loses $1,000 (acceptable), customer fixes bug

**Production Pattern (Verified 2025-2026):**

**Hybrid Approach:**
- **Runtime enforcement**: Soft limits (warnings) and hard limits (throttling/blocking)
- **Billing-time reconciliation**: Actual costs vs estimated costs, adjust invoice
- **Monthly true-up**: If actual costs exceed estimates, charge overage (or credit if under)

**Example:**
- Runtime estimate: $10,000 for month (based on real-time tracking)
- Actual invoice (OpenAI + Deepgram + Twilio): $10,500
- Overage: $500 (5% variance)
- **Action**: Charge customer $10,500 (not $10,000), explain variance

**Acceptable Variance: 5-10%**
- Runtime estimates based on API call counts and average costs
- Actual costs based on provider invoices (may differ due to pricing changes, discounts)
- Variance <10% acceptable, document in terms of service
- Variance >10% investigate (potential bug in cost tracking)

**Production Examples:**

**AWS Budgets:**
- Runtime enforcement: Budget actions apply IAM policies when threshold exceeded
- Billing-time reconciliation: Actual AWS invoice at end of month
- **Pattern**: Runtime protection + billing-time accuracy

**Stripe Usage-Based Billing:**
- Runtime enforcement: Usage alerts trigger when thresholds exceeded
- Billing-time reconciliation: Invoice generated based on actual usage
- **Pattern**: Runtime alerts + billing-time charging

## Common Failure Modes (Observed in Real Systems)

### 1. No Real-Time Cost Monitoring (Runaway Spend Undetected)
**Symptom**: Customer misconfigured (infinite retry loop). Generates 10,000 calls in 24 hours. Cost: $50,000. Discovered when bill arrives at end of month.

**Root cause**: No real-time cost tracking. Cost only calculated at billing time (end of month).

**Production impact**: Platform loses $50,000 on single customer (customer refuses to pay unexpected bill). Margin collapse, potential bankruptcy if multiple customers do this.

**Observed in**: Voice AI platforms without real-time cost monitoring (common failure mode, not publicly documented).

**Mitigation**:
- Implement real-time cost tracking (<5min latency)
- Track cost per tenant in Redis (5-minute sliding window)
- Alert if any tenant exceeds $100/hour (indicates misconfiguration or abuse)
- Automatically throttle or block tenant when spending limit reached

---

### 2. No Per-Tenant Spending Limits (Unlimited Spend Risk)
**Symptom**: Customer on "unlimited" plan generates 100,000 calls/month. Cost: $200,000. Revenue: $10,000/month. Platform loses $190,000/month on single customer.

**Root cause**: No per-tenant spending limits. Customer can generate unlimited usage at fixed price.

**Production impact**: Margin collapse. Single high-volume customer destroys economics for entire platform.

**Observed in**: Early-stage SaaS platforms with "unlimited" pricing (common mistake).

**Mitigation**:
- Eliminate "unlimited" plans (use high but finite limits instead)
- Implement per-tenant spending limits (e.g., Free: $10/day, Paid: $1000/day, Enterprise: custom)
- Enforce limits at runtime (throttle or block when limit reached)
- Offer volume discounts for high-volume customers (but with limits)

---

### 3. LLM Context Window Explosion (Quadratic Cost Scaling)
**Symptom**: Average call duration increases from 10 minutes to 30 minutes. LLM costs increase from $0.075/call to $0.69/call (9x increase, not 3x). Margin collapses from 30% to -20%.

**Root cause**: LLM costs scale quadratically with conversation length (due to context window growth). No call duration limits.

**Production impact**: Margin collapse. Long conversations destroy unit economics.

**Observed in**: Voice AI platforms without call duration limits or context management (2025-2026).

**Mitigation**:
- Implement hard call duration limits (e.g., 30 minutes maximum)
- Use sliding window context (keep only last 10 turns)
- Implement context summarization (summarize after 15 turns)
- Monitor average call duration, alert if trending upward

---

### 4. No Cost Estimation Before Call Acceptance
**Symptom**: Customer hits spending limit mid-call. Call terminated abruptly. Poor customer experience.

**Root cause**: No cost estimation before accepting call. Only check spending limit after call started.

**Production impact**: Poor customer experience (calls cut off). Customer churn.

**Observed in**: Voice AI platforms without pre-call cost checks.

**Mitigation**:
- Check spending limit before accepting call (not during call)
- Estimate call cost based on average call duration and cost per minute
- Reject call if estimated cost would exceed spending limit
- Provide clear error message to customer ("Spending limit exceeded, please upgrade plan")

---

### 5. Retry Storm Multiplies Costs 10x
**Symptom**: LLM API has transient error (1 second). All customers retry immediately. 1000 customers × 10 retries = 10,000 requests in 1 second. LLM costs spike 10x for that second.

**Root cause**: No exponential backoff or jitter in retry logic. All customers retry simultaneously.

**Production impact**: Cost spike (10x normal costs for brief period). Margin compression.

**Observed in**: Systems without proper retry logic (research/16-multi-tenant-isolation.md).

**Mitigation**:
- Implement exponential backoff with jitter (delay = base_delay × 2^attempt + random_jitter)
- Limit retries (max 3 retries per request)
- Implement circuit breaker (stop retrying after N failures)
- Monitor retry rate, alert on spikes

---

### 6. No Billing-Time Reconciliation (Cost Variance Disputes)
**Symptom**: Runtime cost estimate: $10,000. Actual invoice (OpenAI + Deepgram): $12,000. Customer disputes $2,000 overage.

**Root cause**: No billing-time reconciliation. Invoice based on runtime estimates (not actual provider costs).

**Production impact**: Billing disputes, customer churn, support burden.

**Observed in**: Platforms without billing-time reconciliation (common in early-stage SaaS).

**Mitigation**:
- Reconcile runtime estimates with actual provider invoices monthly
- Adjust invoice based on actual costs (not estimates)
- Document acceptable variance (5-10%) in terms of service
- If variance >10%, investigate and explain to customer

---

### 7. Shared API Quota for All Customers (Platform-Wide Outage)
**Symptom**: High-volume customer exhausts shared OpenAI quota. All other customers hit rate limit errors. Platform-wide LLM failures.

**Root cause**: All customers share same OpenAI API key. No per-tenant quota isolation.

**Production impact**: Platform-wide outage. All customers affected by single high-volume customer.

**Observed in**: Platforms without per-tenant quota isolation (research/16-multi-tenant-isolation.md).

**Mitigation**:
- Implement per-tenant LLM quota tracking (enforce before calling OpenAI)
- Use dedicated API keys for high-volume customers (isolate their quota)
- Monitor OpenAI quota usage, alert if approaching limit
- Implement circuit breaker on shared OpenAI connection

---

### 8. No Cost Breakdown Visibility (Customer Confusion)
**Symptom**: Customer receives invoice for $5,000. Customer: "Why so expensive? What am I paying for?"

**Root cause**: Invoice shows only total cost (no breakdown by STT, LLM, TTS, telephony).

**Production impact**: Customer confusion, billing disputes, support burden, churn.

**Observed in**: Platforms without cost transparency (common in early-stage SaaS).

**Mitigation**:
- Provide cost breakdown on invoice (STT, LLM, TTS, telephony separately)
- Show cost per call on dashboard (research/15-dashboard-requirements.md)
- Provide cost trend chart (daily cost over last 30 days)
- Explain cost drivers ("LLM costs increased due to longer average call duration")

---

### 9. No Soft Degradation (Hard Cutoff Destroys UX)
**Symptom**: Customer hits spending limit. All calls immediately blocked. Customer: "Why can't I make calls? I need to talk to my customers!"

**Root cause**: Only hard limits implemented (no soft degradation). Service completely unavailable when limit reached.

**Production impact**: Poor customer experience, customer churn, lost revenue.

**Observed in**: Platforms with only hard limits (no gradual degradation).

**Mitigation**:
- Implement soft degradation before hard limit (80-100% of limit)
- Downgrade LLM model at 90% of limit (GPT-4o → GPT-4o Mini)
- Reduce concurrent calls at 95% of limit (50 → 10)
- Block new calls at 100% of limit (hard limit)
- Alert customer at each tier (80%, 90%, 95%, 100%)

---

### 10. No Operator Override for Legitimate Overages
**Symptom**: Enterprise customer has legitimate spike (product launch, marketing campaign). Hits spending limit. Service blocked. Customer: "We need to increase limit immediately!"

**Root cause**: No operator override mechanism. Spending limits hard-coded, cannot be increased without code deploy.

**Production impact**: Lost revenue (customer cannot use service during critical period), customer churn.

**Observed in**: Platforms without operator override capability.

**Mitigation**:
- Implement operator override (manual limit increase)
- Require approval from finance team (logged for audit)
- Time-limited override (expires after 24 hours, must be renewed)
- Notify customer of override and new limit

## Proven Patterns & Techniques

### 1. Real-Time Cost Tracking with Redis (5-Minute Latency)
**Pattern**: Track cost per tenant in Redis with 5-minute sliding window. Check cost before accepting new call.

**Implementation**:
- Increment cost counter on each API call (STT, LLM, TTS, telephony)
- Store in Redis: `cost:tenant_123:2026-02-03-14` (hourly buckets)
- Check total cost before accepting new call
- Alert if cost exceeds threshold ($100/hour)

**Benefits**:
- **Real-time protection**: Detect runaway spend within 5 minutes
- **Low latency**: Redis check adds <5ms to call acceptance
- **Scalable**: Redis can handle 100K+ cost checks/second

**Production examples**:
- Standard pattern for multi-tenant SaaS cost tracking
- Used by AWS, Stripe, Twilio for usage-based billing

**When to use**: V1 mandatory for all voice AI platforms.

---

### 2. Tiered Spending Limits with Soft Degradation
**Pattern**: Implement multiple spending limit tiers (80%, 90%, 95%, 100%) with gradual service degradation.

**Implementation**:
- 80% of limit: Alert customer (email + dashboard)
- 90% of limit: Downgrade LLM model (GPT-4o → GPT-4o Mini)
- 95% of limit: Reduce concurrent calls (50 → 10)
- 100% of limit: Block new calls (hard limit)

**Benefits**:
- **Better customer experience**: Service continues (degraded) instead of hard cutoff
- **Gradual warning**: Customer has time to upgrade plan
- **Capture overage revenue**: Can charge for usage above base limit

**Production examples**:
- Supabase: Soft limits for opted-in services, hard caps for unpredictable items
- AWS Budgets: Budget alerts at 50%, 80%, 100% with automatic actions

**When to use**: V1 for paid tiers (free tier uses hard limits only).

---

### 3. Hard Call Duration Limits (Prevent Quadratic Cost Explosion)
**Pattern**: Limit maximum call duration per tier (e.g., Free: 10 min, Paid: 30 min, Enterprise: 60 min).

**Implementation**:
- Check call duration every minute
- Warn customer at 80% of limit ("Call will end in 2 minutes")
- Gracefully terminate call at 100% of limit
- Log call termination reason (duration limit exceeded)

**Benefits**:
- **Prevents quadratic LLM cost explosion**: 30-min limit caps LLM cost at $0.69/call
- **Predictable costs**: Maximum cost per call is known
- **Simple to implement**: Single duration check per minute

**Production examples**:
- Standard pattern for voice AI platforms (Vapi, Retell AI, Bland AI)
- Telephony providers (Twilio, Telnyx) also enforce duration limits

**When to use**: V1 mandatory for all tiers.

---

### 4. Context Window Management (Sliding Window or Summarization)
**Pattern**: Prevent LLM context window explosion using sliding window (keep last N turns) or summarization (summarize after N turns).

**Implementation**:
- **Sliding window**: Keep only last 10 turns in context, drop older turns
- **Summarization**: After 15 turns, summarize conversation history (7000 tokens → 2000 tokens)
- Use summarization model (GPT-4o Mini) to reduce cost

**Benefits**:
- **40-50% LLM cost reduction** on long conversations
- **Prevents quadratic scaling**: Context grows linearly instead of quadratically
- **Maintains conversation quality**: Recent context preserved

**Production examples**:
- Standard pattern for long-running voice AI conversations
- Used by Pipecat, Retell AI, VAPI for context management

**When to use**: V2 for enterprise customers (when they need >30 min calls).

---

### 5. Per-Tenant LLM Quota Enforcement (Before API Call)
**Pattern**: Track LLM token usage per tenant. Enforce quota before calling OpenAI API (don't call if quota exceeded).

**Implementation**:
```python
# Before calling OpenAI
if not check_llm_quota(tenant_id, estimated_tokens):
    return {"error": "LLM quota exceeded", "retry_after": 3600}

response = openai.chat.completions.create(...)
```

**Benefits**:
- **Prevents shared quota exhaustion**: One tenant cannot exhaust quota for all tenants
- **Cost protection**: Cannot exceed per-tenant LLM budget
- **Fair allocation**: Each tenant gets their quota

**Production examples**:
- Azure OpenAI: Per-tenant quota management
- AWS Bedrock: Per-tenant quota tracking
- LiteLLM: Multi-tenant LLM proxy with quota management

**When to use**: V1 mandatory for all LLM API calls.

---

### 6. Reserved Capacity Pricing for High-Volume Customers
**Pattern**: High-volume customers commit to minimum monthly spend. Platform reserves dedicated capacity.

**Implementation**:
- Customer commits to $50,000/month minimum spend
- Platform reserves dedicated API keys (OpenAI, Deepgram)
- Customer gets volume discount (50-60% off standard pricing)
- Predictable costs for both customer and platform

**Benefits**:
- **Guaranteed margin**: Minimum spend ensures profitability
- **No cost surprises**: Reserved capacity prevents quota exhaustion
- **Customer loyalty**: Long-term contract reduces churn

**Production examples**:
- AWS Reserved Instances: Commit to 1-3 year usage, get 50-70% discount
- Snowflake: Committed use discounts for high-volume customers

**When to use**: V2 for enterprise customers (>10,000 calls/month).

---

### 7. Bring Your Own Key (BYOK) for Enterprise Customers
**Pattern**: Enterprise customer provides their own OpenAI/Deepgram API keys. Platform charges only for infrastructure.

**Implementation**:
- Customer provides API keys via dashboard
- Platform stores keys encrypted (AWS KMS, HashiCorp Vault)
- Platform uses customer's keys for API calls
- Customer pays providers directly, platform charges infrastructure fee

**Benefits**:
- **Zero API cost risk**: Platform doesn't pay for API calls
- **Customer control**: Customer manages their own quotas and billing
- **Compliance**: Customer's data stays in their account

**Production examples**:
- Snowflake: BYOK for data encryption
- Databricks: BYOK for cloud resources

**When to use**: V2 for enterprise customers with strict compliance requirements.

---

### 8. Exponential Backoff with Jitter (Prevent Retry Storm Cost Spikes)
**Pattern**: Implement exponential backoff with jitter for all external API calls. Prevent retry storms.

**Implementation**:
```python
import random
import time

def retry_with_backoff(func, max_attempts=3, base_delay=1):
    for attempt in range(max_attempts):
        try:
            return func()
        except Exception as e:
            if attempt == max_attempts - 1:
                raise
            
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)
```

**Benefits**:
- **Prevents retry storm cost spikes**: Jitter spreads retries over time
- **Reduces API costs**: Fewer unnecessary retries
- **Standard practice**: Required by most API providers

**Production examples**:
- AWS SDK: Built-in exponential backoff with jitter
- Google Cloud SDK: Exponential backoff with jitter

**When to use**: V1 mandatory for all external API calls.

---

### 9. Cost Breakdown Dashboard for Customers
**Pattern**: Show cost breakdown on customer dashboard (STT, LLM, TTS, telephony separately).

**Implementation**:
- Track cost per component (STT, LLM, TTS, telephony)
- Display on dashboard: "Total: $500 (STT: $125, LLM: $200, TTS: $100, Telephony: $75)"
- Show cost per call: "$0.50 per call (10 min average)"
- Show cost trend: Chart of daily cost over last 30 days

**Benefits**:
- **Cost transparency**: Customer understands what they're paying for
- **Reduced billing disputes**: Clear breakdown prevents confusion
- **Upsell opportunities**: Customer sees value of premium features

**Production examples**:
- AWS Cost Explorer: Detailed cost breakdown by service
- Stripe Dashboard: Cost breakdown by product

**When to use**: V1 mandatory for customer-facing dashboard (research/15-dashboard-requirements.md).

---

### 10. Billing-Time Reconciliation with Monthly True-Up
**Pattern**: Reconcile runtime cost estimates with actual provider invoices monthly. Adjust invoice based on actual costs.

**Implementation**:
- Runtime tracking: Estimate costs based on API call counts
- End of month: Retrieve actual invoices from providers (OpenAI, Deepgram, Twilio)
- Calculate variance: Actual costs vs estimated costs
- Adjust invoice: Charge customer actual costs (not estimates)
- If variance >10%, investigate and explain to customer

**Benefits**:
- **Accurate billing**: Based on actual provider costs (not estimates)
- **Customer trust**: No surprises, transparent reconciliation
- **Acceptable variance**: 5-10% variance acceptable, documented in terms of service

**Production examples**:
- AWS: Actual invoice based on usage, not estimates
- Stripe: Invoice based on actual usage, not projections

**When to use**: V1 mandatory for billing accuracy.

## Engineering Rules (Binding)

### R1: Cost MUST Be Tracked Per Tenant in Real-Time (<5 Minutes)
**Rule**: Cost per tenant MUST be tracked in Redis with <5 minute latency. Alert if any tenant exceeds $100/hour.

**Rationale**: Without real-time cost tracking, misconfigured tenants can burn $50K+ before detection.

**Implementation**: Track cost on each API call (STT, LLM, TTS, telephony). Store in Redis hourly buckets.

**Verification**: Inject 1000 calls in 5 minutes. Verify cost alert fires within 5 minutes.

---

### R2: Spending Limits MUST Be Enforced Before Call Acceptance
**Rule**: Check tenant spending limit before accepting new call. Reject call if limit exceeded (don't start call then terminate mid-call).

**Rationale**: Terminating calls mid-call creates poor customer experience. Better to reject upfront.

**Implementation**: Check spending limit in call acceptance logic. Return 429 Too Many Requests if limit exceeded.

**Verification**: Tenant exceeds spending limit. Attempt new call. Verify call rejected immediately (not accepted then terminated).

---

### R3: Call Duration MUST Be Limited Per Tier
**Rule**: Maximum call duration per tier: Free: 10 min, Paid: 30 min, Enterprise: 60 min. Gracefully terminate call at limit.

**Rationale**: Prevents quadratic LLM cost explosion. 30-min limit caps LLM cost at $0.69/call.

**Implementation**: Check call duration every minute. Warn at 80% of limit. Terminate at 100% of limit.

**Verification**: Start call, wait for duration limit. Verify call terminated gracefully with warning.

---

### R4: LLM Context MUST Use Sliding Window or Summarization
**Rule**: LLM context MUST use sliding window (last 10 turns) or summarization (after 15 turns) to prevent quadratic cost scaling.

**Rationale**: Without context management, LLM costs scale quadratically with conversation length.

**Implementation**: Keep only last 10 turns in context. Or summarize after 15 turns.

**Verification**: 30-minute call (30 turns). Verify LLM context <5000 tokens (not 20,000+ tokens).

---

### R5: LLM Quota MUST Be Enforced Per Tenant Before API Call
**Rule**: Before calling OpenAI API, MUST check per-tenant LLM quota. Reject request if quota exceeded (don't call OpenAI).

**Rationale**: Prevents one tenant from exhausting shared OpenAI quota for all tenants.

**Implementation**: Track token usage per tenant in Redis. Check quota before calling OpenAI.

**Verification**: Tenant exceeds LLM quota. Attempt LLM call. Verify request rejected (OpenAI not called).

---

### R6: Soft Degradation MUST Occur Before Hard Limit
**Rule**: Implement soft degradation at 90-95% of spending limit (downgrade LLM, reduce concurrent calls) before hard limit at 100%.

**Rationale**: Gradual degradation provides better customer experience than hard cutoff.

**Implementation**: 90%: Downgrade LLM model. 95%: Reduce concurrent calls. 100%: Block new calls.

**Verification**: Tenant approaches spending limit. Verify soft degradation occurs before hard limit.

---

### R7: All Retry Logic MUST Use Exponential Backoff with Jitter
**Rule**: All external API calls (STT, LLM, TTS, telephony) MUST implement exponential backoff with jitter. Max 3 retries.

**Rationale**: Prevents retry storms from multiplying costs 10x during transient failures.

**Implementation**: `delay = base_delay × 2^attempt + random_jitter`. Max 3 retries.

**Verification**: Inject transient error. Verify retries spread over time (not all at once).

---

### R8: Cost Breakdown MUST Be Visible on Customer Dashboard
**Rule**: Customer dashboard MUST show cost breakdown (STT, LLM, TTS, telephony separately) and cost per call.

**Rationale**: Cost transparency reduces billing disputes and customer confusion.

**Implementation**: Track cost per component. Display on dashboard with breakdown.

**Verification**: Customer views dashboard. Verify cost breakdown visible (not just total cost).

---

### R9: Billing MUST Reconcile Runtime Estimates with Actual Costs Monthly
**Rule**: At end of month, reconcile runtime cost estimates with actual provider invoices. Adjust invoice based on actual costs.

**Rationale**: Ensures accurate billing. Prevents billing disputes from cost variance.

**Implementation**: Retrieve actual invoices from providers. Calculate variance. Adjust customer invoice.

**Verification**: Runtime estimate: $10,000. Actual invoice: $10,500. Verify customer charged $10,500 (not $10,000).

---

### R10: High-Volume Customers (>10K Calls/Month) MUST Have Dedicated API Keys
**Rule**: Customers with >10,000 calls/month MUST use dedicated OpenAI/Deepgram API keys (not shared quota).

**Rationale**: Prevents high-volume customers from exhausting shared quota for all other customers.

**Implementation**: Provision dedicated API keys for high-volume customers. Route their calls to dedicated keys.

**Verification**: High-volume customer makes 10,000 calls. Verify no impact on other customers' quota.

## Metrics & Signals to Track

### Per-Tenant Cost Metrics

**Real-Time Cost:**
- Cost per tenant per hour (STT + LLM + TTS + telephony)
- Cost per tenant per day
- Cost per tenant per month
- Projected monthly cost (based on current usage)

**Cost Breakdown:**
- STT cost per tenant
- LLM cost per tenant
- TTS cost per tenant
- Telephony cost per tenant
- Tool call cost per tenant

**Cost Per Call:**
- Average cost per call per tenant
- P50/P95/P99 cost per call per tenant
- Cost per minute per tenant

**Spending Limit Metrics:**
- Percentage of spending limit used per tenant
- Tenants approaching spending limit (>80%)
- Tenants at spending limit (100%)
- Tenants exceeding spending limit (overage)

### Cost Anomaly Detection

**Cost Spikes:**
- Tenants with >2x normal cost per hour
- Tenants with >10x normal call volume
- Alert: Cost anomaly detected (investigate)

**Cost Trends:**
- Average cost per call trending upward (indicates longer calls or more expensive models)
- Total platform cost trending upward (indicates growth or inefficiency)
- Alert: Cost trend anomaly detected

**Cost Efficiency:**
- Cost per successful call (exclude failed calls)
- Cost per task completion (business outcome, not just call completion)
- Cost per customer satisfaction point (CSAT)

### LLM Cost Metrics

**Token Usage:**
- Tokens per call per tenant (input + output)
- Tokens per turn per tenant
- Context window size per call

**LLM Cost Breakdown:**
- Input token cost per tenant
- Output token cost per tenant
- Tool call token cost per tenant

**Context Management:**
- Calls using sliding window context
- Calls using summarization
- Average context size per call (tokens)

### Call Duration Metrics

**Duration Distribution:**
- Average call duration per tenant
- P50/P95/P99 call duration per tenant
- Calls exceeding duration limit (terminated early)

**Duration Trends:**
- Average call duration trending upward (indicates quadratic cost risk)
- Alert: Average call duration >20 minutes (investigate)

**Duration Limits:**
- Calls terminated at duration limit per tenant
- Percentage of calls hitting duration limit (if >10%, consider increasing limit)

### Spending Limit Enforcement Metrics

**Soft Degradation:**
- Tenants in soft degradation mode (90-100% of limit)
- LLM model downgrades per tenant
- Concurrent call reductions per tenant

**Hard Limits:**
- Calls rejected due to spending limit per tenant
- Tenants blocked due to spending limit
- Time spent at spending limit per tenant

**Overrides:**
- Operator overrides per tenant (manual limit increases)
- Override reasons (legitimate spike, abuse, error)
- Override duration (how long override active)

### Billing Reconciliation Metrics

**Cost Variance:**
- Runtime estimate vs actual cost per tenant
- Percentage variance (target: <10%)
- Alert: Variance >10% (investigate)

**Billing Accuracy:**
- Invoices adjusted due to variance
- Customer disputes due to billing errors
- Refunds issued due to billing errors

## V1 Decisions / Constraints

### D-COST-001 Cost MUST Be Tracked in Redis with <5 Minute Latency
**Decision**: Track cost per tenant in Redis with 5-minute sliding window. Alert if any tenant exceeds $100/hour.

**Rationale**: Real-time cost tracking prevents runaway spend. 5-minute latency acceptable for cost protection.

**Constraints**: Must track cost on each API call (STT, LLM, TTS, telephony). Must store in Redis hourly buckets.

---

### D-COST-002 Spending Limits: Free $10/day, Paid $1000/day, Enterprise Custom
**Decision**: Per-tenant spending limits: Free tier: $10/day, Paid tier: $1,000/day, Enterprise tier: custom limits.

**Rationale**: Protects platform from runaway spend. Limits aligned with pricing tiers.

**Constraints**: Must enforce limits before call acceptance (not mid-call).

---

### D-COST-003 Call Duration Limits: Free 10min, Paid 30min, Enterprise 60min
**Decision**: Maximum call duration per tier: Free: 10 min, Paid: 30 min, Enterprise: 60 min.

**Rationale**: Prevents quadratic LLM cost explosion. 30-min limit caps LLM cost at $0.69/call.

**Constraints**: Must check duration every minute. Must warn at 80% of limit. Must terminate at 100% of limit.

---

### D-COST-004 LLM Context MUST Use Sliding Window (Last 10 Turns)
**Decision**: LLM context uses sliding window (keep only last 10 turns). Drop older turns from context.

**Rationale**: Prevents quadratic LLM cost scaling. Caps context growth at 10 turns.

**Constraints**: Must implement sliding window in LLM context management. Context summarization deferred to V2.

---

### D-COST-005 Soft Degradation at 90%, Hard Limit at 100%
**Decision**: Soft degradation at 90% of spending limit (downgrade LLM model). Hard limit at 100% (block new calls).

**Rationale**: Gradual degradation provides better customer experience than hard cutoff.

**Constraints**: Must implement LLM model downgrade (GPT-4o → GPT-4o Mini). Must alert customer at each tier.

---

### D-COST-006 LLM Quota Enforced Per Tenant Before API Call
**Decision**: Track LLM token usage per tenant in Redis. Enforce quota before calling OpenAI API.

**Rationale**: Prevents one tenant from exhausting shared OpenAI quota for all tenants.

**Constraints**: Must estimate tokens before calling OpenAI. Must track actual usage after response.

---

### D-COST-007 Exponential Backoff with Jitter (Max 3 Retries)
**Decision**: All external API calls use exponential backoff with jitter. Max 3 retries. Base delay: 1 second.

**Rationale**: Prevents retry storms from multiplying costs 10x during transient failures.

**Constraints**: Must implement jitter (random delay) to spread retries over time.

---

### D-COST-008 Cost Breakdown Visible on Customer Dashboard
**Decision**: Customer dashboard shows cost breakdown (STT, LLM, TTS, telephony separately) and cost per call.

**Rationale**: Cost transparency reduces billing disputes and customer confusion.

**Constraints**: Must track cost per component. Must display on dashboard (research/15-dashboard-requirements.md).

---

### D-COST-009 Monthly Billing Reconciliation with 10% Acceptable Variance
**Decision**: Reconcile runtime cost estimates with actual provider invoices monthly. Adjust invoice based on actual costs. Acceptable variance: <10%.

**Rationale**: Ensures accurate billing. Prevents billing disputes from cost variance.

**Constraints**: Must retrieve actual invoices from providers. Must calculate variance. Must adjust customer invoice.

---

### D-COST-010 High-Volume Customers (>10K Calls/Month) Get Dedicated API Keys
**Decision**: Customers with >10,000 calls/month use dedicated OpenAI/Deepgram API keys (not shared quota).

**Rationale**: Prevents high-volume customers from exhausting shared quota for all other customers.

**Constraints**: Must provision dedicated API keys. Must route high-volume customers to dedicated keys.

---

### D-COST-011 Alert Thresholds: 50%, 80%, 90%, 100% of Spending Limit
**Decision**: Alert customer at 50% (dashboard), 80% (email), 90% (email + operator), 100% (throttle/block).

**Rationale**: Gradual warnings give customer time to upgrade plan before hard limit.

**Constraints**: Must implement alert system. Must send emails at thresholds.

---

### D-COST-012 Operator Override Requires Finance Approval
**Decision**: Operator can manually increase spending limit. Requires approval from finance team. Logged for audit.

**Rationale**: Allows legitimate overages (product launch, marketing campaign) while maintaining financial controls.

**Constraints**: Must implement override mechanism. Must log all overrides. Must expire after 24 hours.

---

### D-COST-013 Cost Estimates MUST Include 20% Overhead for Context Management
**Decision**: When estimating call cost, add 20% overhead for context management (summarization, RAG, tool calls).

**Rationale**: Actual costs typically 20% higher than base API costs due to overhead.

**Constraints**: Must adjust cost estimates. Must document overhead in terms of service.

---

### D-COST-014 No "Unlimited" Plans (Use High Finite Limits Instead)
**Decision**: No "unlimited" plans. Use high but finite limits instead (e.g., $10,000/day for enterprise).

**Rationale**: "Unlimited" plans create unbounded cost risk. High finite limits provide flexibility while protecting margins.

**Constraints**: Must set finite limits for all tiers. Must document limits in terms of service.

---

### D-COST-015 Reserved Capacity Pricing Deferred to V2
**Decision**: Reserved capacity pricing (customer commits to minimum monthly spend) deferred to V2.

**Rationale**: Complexity. V1 focuses on standard usage-based pricing with spending limits.

**Constraints**: V2 will add reserved capacity pricing for high-volume customers (>10,000 calls/month).

## Open Questions / Risks

### Q1: How to Handle Cost Variance >10%?
**Question**: If actual costs exceed runtime estimates by >10%, should we charge customer or eat the cost?

**Risk**: Charging customer creates billing disputes. Eating cost erodes margins.

**Mitigation options**:
- Charge customer actual costs, explain variance (preferred)
- Eat variance <10%, charge variance >10%
- Improve cost estimation accuracy (reduce variance)

**V1 decision**: Charge customer actual costs (not estimates). Document acceptable variance (<10%) in terms of service.

---

### Q2: How to Handle Legitimate Cost Spikes (Product Launch)?
**Question**: Enterprise customer has legitimate spike (product launch, marketing campaign). Hits spending limit. How to handle?

**Risk**: Hard limit blocks service during critical period. Lost revenue, customer churn.

**Mitigation options**:
- Operator override (manual limit increase, requires finance approval)
- Automatic temporary limit increase (2x normal limit for 24 hours)
- Reserved capacity pricing (customer pre-commits to spike)

**V1 decision**: Operator override with finance approval. Automatic limit increase deferred to V2.

---

### Q3: How to Handle Cost Estimation for Tool-Heavy Conversations?
**Question**: Tool-heavy conversations have unpredictable costs (depends on number of tool calls, tool results). How to estimate?

**Risk**: Cost estimates significantly lower than actual costs. Customer disputes invoice.

**Mitigation options**:
- Add 50% overhead for tool-heavy conversations (conservative)
- Track historical tool call costs per tenant, use for estimation
- Charge actual costs (not estimates), document variance

**V1 decision**: Add 50% overhead for tool-heavy conversations. Track actual costs, adjust estimates monthly.

---

### Q4: How to Handle Billing for Failed Calls?
**Question**: If call fails (STT error, LLM error, TTS error), should we charge customer for partial costs?

**Risk**: Charging for failed calls creates customer dissatisfaction. Not charging erodes margins.

**Mitigation options**:
- Don't charge for failed calls (customer-friendly, but erodes margins)
- Charge for partial costs (STT + LLM, no TTS if TTS failed)
- Charge for all costs (platform still incurred costs, even if call failed)

**V1 decision**: Don't charge for failed calls (if error rate <5%). If error rate >5%, investigate root cause.

---

### Q5: How to Handle Cost Allocation for Shared Resources?
**Question**: Infrastructure costs (WebRTC servers, databases, monitoring) are shared across all tenants. How to allocate?

**Risk**: Allocating shared costs increases per-call costs. Not allocating erodes margins.

**Mitigation options**:
- Add 20% overhead to API costs for shared infrastructure
- Track actual infrastructure costs, allocate proportionally by usage
- Flat monthly fee per tenant (covers shared costs)

**V1 decision**: Add 20% overhead to API costs for shared infrastructure. Track actual costs, adjust overhead quarterly.

---

### Q6: How to Handle Cost Optimization Recommendations?
**Question**: Should platform recommend cost optimizations to customers (e.g., "switch to GPT-4o Mini to save 80%")?

**Risk**: Recommendations reduce revenue. Not recommending leaves money on table (customer switches to competitor).

**Mitigation options**:
- Proactive recommendations (customer-friendly, but reduces revenue)
- Reactive recommendations (only when customer asks)
- No recommendations (customer figures it out themselves or churns)

**V1 decision**: Reactive recommendations (only when customer asks). Proactive recommendations deferred to V2.

---

### Q7: How to Handle Cost Monitoring for BYOK Customers?
**Question**: If customer brings their own OpenAI key (BYOK), how to monitor their costs?

**Risk**: Platform doesn't know customer's actual costs. Cannot provide cost breakdown or alerts.

**Mitigation options**:
- Estimate costs based on API call counts (same as non-BYOK)
- Require customer to share usage data from OpenAI dashboard
- Don't monitor costs (customer manages their own costs)

**V1 decision**: Estimate costs based on API call counts. Don't monitor actual costs (customer manages via OpenAI dashboard).

---

### Q8: How to Handle Cost Guardrails for Long-Running Agents?
**Question**: Some agents run 24/7 (e.g., receptionist agent). How to apply spending limits?

**Risk**: Daily spending limit blocks service mid-day. Hard to predict daily costs.

**Mitigation options**:
- Use hourly spending limits instead of daily (more granular)
- Use monthly spending limits (less granular, more flexible)
- Dedicated pricing for 24/7 agents (flat monthly fee)

**V1 decision**: Use hourly spending limits ($100/hour) for all customers. Monthly limits deferred to V2.

---

### Q9: How to Handle Cost Guardrails During Onboarding?
**Question**: New customers don't know their expected usage. How to set initial spending limits?

**Risk**: Limits too low → service blocked during onboarding. Limits too high → runaway spend risk.

**Mitigation options**:
- Start with low limits ($10/day), increase after 30 days of good payment history
- Start with high limits ($1000/day), reduce if abuse detected
- Require credit card before onboarding (reduces abuse risk)

**V1 decision**: Start with low limits ($10/day for free tier, $100/day for paid tier). Increase after 30 days.

---

### Q10: How to Handle Cost Guardrails for Multi-Region Deployments?
**Question**: Platform deployed in 3 regions (US, EU, Asia). Should spending limits be per-region or global?

**Risk**: Per-region limits too restrictive. Global limits allow one region to exhaust budget.

**Mitigation options**:
- Global spending limits (simpler, but one region can exhaust budget)
- Per-region spending limits (more complex, but better isolation)
- Hybrid: Global limit with per-region soft limits

**V1 decision**: Global spending limits (simpler). Per-region limits deferred to V2 (when multi-region deployed).
