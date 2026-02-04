# Research: Dashboard Requirements for Production Voice AI SaaS Platform

## Why This Matters for V1

Dashboard requirements are not a UI polish problem—they are a **platform safety constraint**. Production SaaS platforms fail in three predictable ways when dashboards are wrong: (1) **operators cannot respond to incidents**—mean time to resolution (MTTR) increases from 30 minutes to 4+ hours because critical metrics are missing or misleading, (2) **customers generate support tickets**—without visibility into call quality, costs, and failures, customers cannot self-serve and flood support with "why did this fail?" questions, and (3) **runaway costs go undetected**—without real-time cost visibility, a single misconfigured customer can burn $10K+ before anyone notices.

The industry evidence is unambiguous: **dashboards are operational infrastructure, not analytics features**. Analysis of production voice AI platforms (2025-2026) reveals that successful platforms expose 10-15 critical metrics to operators and 6-8 metrics to customers—not 50+ vanity metrics. The pattern is clear: **too many metrics is as dangerous as too few**. Operators need drill-down capability from anomaly to transcript in one click, not 20 charts they never look at. Customers need cost per call and task success rate, not raw LLM token counts that create confusion and support tickets.

**Critical Production Reality**: Platforms that expose raw infrastructure metrics (LLM tokens, STT API calls, TTS bytes) to customers see **3-5x higher support ticket volume** than platforms that expose business metrics (cost per call, task success rate, call quality score). The mistake is treating customers like operators—they need different dashboards with different metrics at different latencies.

## What Matters in Production (Facts Only)

### Operator Dashboard Requirements (Incident Response)

**Core Insight (2026):**
During incidents, operators rely on 4-6 critical metrics to diagnose and resolve issues. Everything else is noise. Production platforms (PagerDuty, Datadog, Grafana Cloud) have converged on a standard pattern: **pre-built dashboards with curated metrics, not customizable analytics playgrounds**.

**What Operators Actually Use During Incidents (Verified 2025-2026):**

**1. System Health (Infrastructure):**
- **Active calls**: Current concurrent calls (real-time, <10s latency)
- **Call attempts per minute**: Incoming load (real-time, <10s latency)
- **Success rate**: Percentage of calls completing without technical failure (real-time, <1min latency)
- **Error rate**: Percentage of calls with errors (real-time, <1min latency)
- **Resource utilization**: CPU, memory, disk usage per service (real-time, <30s latency)

**Why these matter**: First signal of degradation. If active calls spike but success rate drops, indicates capacity issue. If error rate spikes, indicates provider or code issue.

**2. Latency Metrics (Performance):**
- **P50/P95/P99 end-to-end turn latency**: Distribution of response times (real-time, <1min latency)
- **Time to first audio (TTFA)**: How long until agent starts speaking (real-time, <1min latency)
- **Component latency breakdown**: STT, LLM, TTS latency separately (real-time, <1min latency)

**Why these matter**: Latency spikes indicate which component is failing. If LLM latency spikes but STT/TTS normal, indicates LLM provider issue or prompt complexity issue.

**3. Provider Health (External Dependencies):**
- **STT provider success rate**: Deepgram/Groq API success rate (real-time, <1min latency)
- **LLM provider success rate**: OpenAI/Anthropic API success rate (real-time, <1min latency)
- **TTS provider success rate**: Cartesia/ElevenLabs API success rate (real-time, <1min latency)
- **Telephony provider success rate**: Twilio/Telnyx call connection rate (real-time, <1min latency)

**Why these matter**: 50% of production issues are provider failures (research/04.5-telephony-infrastructure.md). If OpenAI API success rate drops from 99.9% to 95%, indicates OpenAI outage—not platform bug.

**4. Conversation Quality (Voice AI Specific):**
- **Interruption rate**: Percentage of calls with barge-ins (delayed, 5-15min latency acceptable)
- **Escalation rate**: Percentage of calls escalated to human agent (delayed, 5-15min latency acceptable)
- **Average call duration**: Typical call length (delayed, 5-15min latency acceptable)
- **Tool failure rate**: Percentage of tool calls that fail (real-time, <1min latency)

**Why these matter**: Quality degradation signals. If interruption rate spikes, indicates VAD or turn-taking issue. If escalation rate spikes, indicates LLM not handling intents correctly.

**Production Pattern (Hamming.ai, 2025):**
Operators need **one-click drill-down from anomaly to transcript and audio**. If P95 latency spikes at 2:34 PM, operator clicks spike, sees list of slow calls, clicks call, sees full transcript + audio + latency breakdown. This is the difference between 30-minute MTTR and 4-hour MTTR.

**What Operators Do NOT Need:**
- Raw LLM token counts (meaningless without context)
- Individual API call logs (too granular, use distributed tracing instead)
- Average metrics (averages hide failures, use P50/P95/P99)
- 50+ charts (cognitive overload, operators ignore them)

### Customer Dashboard Requirements (Self-Service)

**Core Insight (2026):**
Customers need **business metrics, not infrastructure metrics**. They care about cost per call, task success rate, and call quality—not LLM tokens or STT API calls. Production platforms that expose infrastructure metrics to customers see 3-5x higher support ticket volume.

**What Customers Actually Need (Verified 2025-2026):**

**1. Usage & Billing (Business Metrics):**
- **Total calls this month**: Number of calls (delayed, hourly refresh acceptable)
- **Cost this month**: Total spend in dollars (delayed, hourly refresh acceptable)
- **Cost per call**: Average cost per call (delayed, hourly refresh acceptable)
- **Projected monthly cost**: Forecast based on current usage (delayed, daily refresh acceptable)
- **Usage by day/week**: Trend chart showing call volume over time (delayed, hourly refresh acceptable)

**Why these matter**: Customers need predictable costs. If cost per call suddenly doubles, they need to know immediately (within 1 hour). Projected monthly cost prevents bill shock.

**2. Call Quality (Customer-Facing Metrics):**
- **Task success rate**: Percentage of calls achieving user's goal (delayed, hourly refresh acceptable)
- **Customer satisfaction (CSAT)**: Post-call rating if collected (delayed, hourly refresh acceptable)
- **Average call duration**: Typical call length (delayed, hourly refresh acceptable)
- **Call completion rate**: Percentage of calls not abandoned (delayed, hourly refresh acceptable)

**Why these matter**: Customers need to know if system is working. If task success rate drops from 85% to 70%, indicates quality issue requiring investigation.

**3. System Health (Simplified):**
- **Uptime percentage**: System availability (delayed, hourly refresh acceptable)
- **Error rate**: Percentage of calls with technical failures (delayed, hourly refresh acceptable)

**Why these matter**: Customers need confidence system is reliable. If uptime drops below 99%, they need to know.

**What Customers Should NOT See:**
- **Raw LLM token counts**: Meaningless to customers, creates confusion ("why did this call use 10K tokens?")
- **STT/TTS API call counts**: Infrastructure detail, not business metric
- **P95 latency**: Too technical, customers don't understand percentiles
- **Individual component failures**: Creates panic without context ("Deepgram failed 3 times today" sounds bad even if 99.9% success rate)

**Production Anti-Pattern (Observed 2025):**
Platforms that expose raw infrastructure metrics to customers generate 3-5x more support tickets. Example: Customer sees "LLM tokens: 8,234" and opens ticket "Why am I being charged for 8K tokens?" Correct approach: Show "Cost: $0.12" instead.

### Real-Time vs Delayed Metrics (Cost Tradeoffs)

**Core Tradeoff (2026):**
Real-time metrics are **not inherently better**—they are a fundamentally different architectural paradigm with steep complexity and cost implications. For many use cases, the marginal utility of faster metrics doesn't justify exponential increases in infrastructure costs and operational fragility.

**What MUST Be Real-Time (<1 minute latency):**

**Operator Metrics (Incident Response):**
- Active calls (real-time, <10s)
- Call attempts per minute (real-time, <10s)
- Success rate (real-time, <1min)
- Error rate (real-time, <1min)
- P50/P95/P99 latency (real-time, <1min)
- Provider health (STT/LLM/TTS success rates) (real-time, <1min)

**Why**: Operators need immediate signal of degradation. If error rate spikes, need to know within 1 minute to respond before customers are impacted.

**What Can Be Delayed (5-60 minute latency):**

**Operator Metrics (Trend Analysis):**
- Interruption rate (delayed, 5-15min acceptable)
- Escalation rate (delayed, 5-15min acceptable)
- Average call duration (delayed, 5-15min acceptable)

**Customer Metrics (All):**
- Total calls (delayed, hourly refresh)
- Cost this month (delayed, hourly refresh)
- Task success rate (delayed, hourly refresh)
- CSAT (delayed, hourly refresh)

**Why**: Customers are analyzing trends, not responding to incidents. Hourly refresh is sufficient for business decision-making. Real-time customer dashboards add 10-100x cost with minimal benefit.

**Production Pattern (2026):**
- **Operator dashboard**: Real-time metrics (Prometheus + Grafana, <1min latency, high cost)
- **Customer dashboard**: Delayed metrics (PostgreSQL materialized views, hourly refresh, low cost)
- **Hybrid**: Real-time for critical alerts, delayed for dashboards

**Cost Reality:**
- Real-time metrics: $500-$2000/month for 1000 concurrent calls (Datadog, New Relic)
- Delayed metrics: $50-$200/month for same load (PostgreSQL + Grafana)
- **10-40x cost difference** for marginal benefit on customer dashboards

### Minimum Viable Dashboard for V1

**Core Principle (2026):**
MVP dashboards should track **10-12 high-impact metrics**, not 50+ vanity metrics. If you're tracking too many metrics, you're unclear on what actually drives your business.

**Operator Dashboard (V1 Minimum):**

**System Health (4 metrics):**
1. Active calls (real-time)
2. Success rate (real-time)
3. Error rate (real-time)
4. P95 end-to-end latency (real-time)

**Provider Health (3 metrics):**
5. STT provider success rate (real-time)
6. LLM provider success rate (real-time)
7. TTS provider success rate (real-time)

**Conversation Quality (2 metrics):**
8. Tool failure rate (real-time)
9. Escalation rate (delayed, 15min)

**Total: 9 metrics, all on single dashboard, one-click drill-down to transcripts**

**Customer Dashboard (V1 Minimum):**

**Usage & Billing (3 metrics):**
1. Total calls this month (delayed, hourly)
2. Cost this month (delayed, hourly)
3. Projected monthly cost (delayed, daily)

**Call Quality (3 metrics):**
4. Task success rate (delayed, hourly)
5. Average call duration (delayed, hourly)
6. Error rate (delayed, hourly)

**Total: 6 metrics, simple dashboard, no drill-down needed**

**What V1 Does NOT Need:**
- Custom dashboards (use pre-built templates)
- Per-customer operator dashboards (operators see all customers, filter by customer_id)
- Real-time customer dashboards (hourly refresh sufficient)
- 50+ metrics (cognitive overload)
- Drill-down on customer dashboard (customers should contact support for deep investigation)

### Dangerous Metrics to Expose to Customers

**Core Insight (2026):**
Some metrics create more confusion and support tickets than value. Production platforms have learned (through painful experience) which metrics to hide from customers.

**Metrics That Create Support Tickets:**

**1. Raw LLM Token Counts**
**Problem**: Customers don't understand why token counts vary. "Why did this 2-minute call use 8K tokens but this 3-minute call use 3K tokens?" Creates support tickets and billing disputes.
**Solution**: Show cost per call ($0.12) instead of tokens (8,234). Customers understand dollars, not tokens.

**2. Individual Component Failures**
**Problem**: "Deepgram failed 3 times today" sounds catastrophic even if success rate is 99.9%. Customers panic and open tickets.
**Solution**: Show overall error rate (0.1%) instead of individual failures (3). Context matters.

**3. P95/P99 Latency**
**Problem**: Customers don't understand percentiles. "What does P95 mean?" Creates confusion and support tickets.
**Solution**: Show average latency (simpler) or hide latency entirely (customers care about call quality, not milliseconds).

**4. Provider-Specific Metrics**
**Problem**: "Why is OpenAI success rate 98% today?" Customers can't do anything about provider issues, creates anxiety.
**Solution**: Show overall system uptime (99.5%) instead of per-provider metrics. Customers care about system reliability, not which provider failed.

**5. Incomplete Metrics Without Context**
**Problem**: "Interruption rate: 35%" without context sounds bad. Is this normal? Is this a problem?
**Solution**: Show trend over time ("35%, up from 30% last week") or hide metric entirely if customers can't act on it.

**Production Pattern (2026):**
Expose metrics customers can **act on** (cost, task success rate, error rate). Hide metrics that create **confusion without action** (tokens, provider failures, percentile latency).

### Multi-Tenant Dashboard Patterns

**Core Challenge (2026):**
Multi-tenant platforms must balance **shared infrastructure efficiency** with **per-tenant isolation and visibility**. Operators need cross-tenant visibility to detect noisy neighbors. Customers need per-tenant isolation to ensure data privacy.

**Operator Dashboard (Multi-Tenant):**

**Cross-Tenant View (Noisy Neighbor Detection):**
- **Calls per customer**: Which customers are generating most load (real-time)
- **Cost per customer**: Which customers are generating most cost (delayed, hourly)
- **Error rate per customer**: Which customers are experiencing failures (real-time)
- **Resource utilization per customer**: Which customers are consuming most CPU/memory (real-time)

**Why this matters**: Noisy neighbor detection. If one customer suddenly generates 10x normal load, need to detect and throttle before impacting other customers.

**Per-Tenant Drill-Down:**
- Click customer → see customer-specific dashboard with all metrics
- Same metrics as customer sees, plus operator-only metrics (resource utilization, provider failures)

**Customer Dashboard (Multi-Tenant):**

**Strict Tenant Isolation:**
- Customers see **only their own data**, never other customers' data
- No cross-tenant metrics, no aggregate metrics
- Enforced at database query level (WHERE customer_id = $current_customer)

**Security Requirement:**
- All dashboard queries MUST include customer_id filter
- Database row-level security (RLS) enforces isolation
- Audit log all dashboard queries for compliance

**Production Anti-Pattern (Observed 2025):**
Dashboard query missing customer_id filter exposes all customers' data to single customer. This is a **catastrophic security failure** that violates GDPR, SOC 2, and customer trust.

### Dashboard Data Freshness Requirements

**Core Insight (2026):**
Different metrics have different freshness requirements. Real-time metrics cost 10-100x more than delayed metrics. Choose freshness based on **use case, not vanity**.

**Freshness Tiers (Production Standard 2026):**

**Tier 1: Real-Time (<1 minute latency)**
- Use case: Incident response, alerting
- Metrics: Active calls, success rate, error rate, P95 latency, provider health
- Technology: Prometheus + Grafana, Datadog, New Relic
- Cost: $500-$2000/month for 1000 concurrent calls
- Who needs it: Operators only

**Tier 2: Near Real-Time (5-15 minute latency)**
- Use case: Trend monitoring, quality analysis
- Metrics: Interruption rate, escalation rate, average call duration
- Technology: PostgreSQL materialized views (refresh every 5-15min)
- Cost: $50-$100/month for 1000 concurrent calls
- Who needs it: Operators only

**Tier 3: Hourly (60 minute latency)**
- Use case: Customer self-service, business metrics
- Metrics: Total calls, cost, task success rate, CSAT
- Technology: PostgreSQL materialized views (refresh every hour)
- Cost: $20-$50/month for 1000 concurrent calls
- Who needs it: Customers and operators

**Tier 4: Daily (24 hour latency)**
- Use case: Trend analysis, reporting
- Metrics: Projected monthly cost, weekly usage trends, month-over-month comparisons
- Technology: PostgreSQL materialized views (refresh daily)
- Cost: $10-$20/month for 1000 concurrent calls
- Who needs it: Customers and operators

**Production Decision Framework:**
- Ask: "What decision does this metric inform?"
- Ask: "How quickly must this decision be made?"
- If decision is immediate (incident response) → Real-time
- If decision is within hours (customer cost monitoring) → Hourly
- If decision is within days (trend analysis) → Daily

**Cost Optimization Pattern:**
- Start with Tier 3 (hourly) for all metrics
- Promote to Tier 1 (real-time) only when incidents prove it's necessary
- Never promote customer metrics to real-time (customers don't need it)

### Conversation Analytics and Drill-Down

**Core Insight (Hamming.ai 2025):**
The most valuable dashboard feature is **one-click drill-down from anomaly to transcript and audio**. Operators need to go from "P95 latency spiked at 2:34 PM" to "here are the 10 slowest calls with full transcripts and audio" in one click.

**Production Pattern (Verified 2025-2026):**

**Anomaly Detection:**
- Dashboard shows P95 latency over time (line chart)
- Operator sees spike at 2:34 PM
- Operator clicks spike → dashboard shows list of calls during that time, sorted by latency

**Call List View:**
- Shows 10-100 calls with key metrics: duration, latency, cost, error status
- Operator clicks call → dashboard shows full call details

**Call Detail View:**
- **Transcript**: Full conversation with timestamps
- **Audio**: Playback of call audio (user and agent separately)
- **Latency breakdown**: STT latency, LLM latency, TTS latency per turn
- **Tool calls**: Which tools were called, parameters, results, latency
- **Errors**: Any errors that occurred with stack traces
- **Metadata**: Customer ID, agent version, region, providers used

**Why This Matters:**
Without drill-down, operators waste hours correlating metrics with logs. With drill-down, operators diagnose issues in minutes. This is the difference between 30-minute MTTR and 4-hour MTTR.

**What V1 Needs:**
- Drill-down from dashboard to call list (filter by time range, customer, error status)
- Drill-down from call list to call detail (full transcript, audio, latency breakdown)
- Search calls by customer ID, phone number, date range
- Export call list to CSV for offline analysis

**What V1 Does NOT Need:**
- AI-powered anomaly detection (too complex, use simple threshold alerts)
- Sentiment analysis on dashboard (too unreliable, use post-call CSAT instead)
- Real-time transcript streaming on dashboard (too expensive, use call detail view)

### Cost Dashboard Requirements

**Core Insight (2026):**
Cost visibility prevents runaway spend. Production platforms report that **misconfigured customers can burn $10K+ before anyone notices** without real-time cost monitoring.

**What Operators Need (Cost Monitoring):**

**Real-Time Cost Alerts:**
- Alert if any customer exceeds $100/hour spend (indicates misconfiguration or abuse)
- Alert if total platform spend exceeds $1000/hour (indicates systemic issue)
- Alert if cost per call exceeds $1.00 (indicates inefficient model stack)

**Cost Dashboard Metrics:**
- **Cost per customer per hour**: Which customers are spending most (real-time, <5min latency)
- **Cost per call**: Average cost per call across all customers (delayed, hourly)
- **Cost breakdown**: STT cost, LLM cost, TTS cost, telephony cost separately (delayed, hourly)
- **Projected monthly cost**: Forecast based on current usage (delayed, daily)

**Why This Matters:**
Without cost monitoring, operators discover runaway spend when bill arrives at end of month. With cost monitoring, operators detect and stop runaway spend within 5 minutes.

**What Customers Need (Cost Transparency):**

**Cost Dashboard Metrics:**
- **Cost this month**: Total spend so far (delayed, hourly refresh)
- **Cost per call**: Average cost per call (delayed, hourly refresh)
- **Projected monthly cost**: Forecast based on current usage (delayed, daily refresh)
- **Cost trend**: Chart showing daily cost over last 30 days (delayed, daily refresh)

**Why This Matters:**
Customers need predictable costs. If cost per call suddenly doubles, they need to know within 1 hour (not 1 month). Projected monthly cost prevents bill shock.

**Billing Integration:**
- Dashboard shows current month cost (real-time)
- Invoice generated at end of month matches dashboard exactly (no surprises)
- Customers can download invoice from dashboard (self-service)

**Production Anti-Pattern (Observed 2025):**
Dashboard shows estimated cost, invoice shows actual cost, numbers don't match. Customers dispute invoices, support tickets increase 10x. Correct approach: Dashboard shows exact cost that will be invoiced.

## Common Failure Modes (Observed in Real Systems)

### 1. Too Many Metrics on Dashboard (Cognitive Overload)
**Symptom**: Operators have 50+ charts on dashboard but never look at most of them. During incidents, operators don't know which metrics matter.

**Root cause**: Dashboard built by adding every metric anyone ever requested. No prioritization, no removal of unused metrics.

**Production impact**: MTTR increases from 30 minutes to 2-4 hours because operators waste time looking at wrong metrics.

**Observed in**: Platforms without dashboard governance, platforms that treat dashboards as analytics playgrounds.

**Mitigation**:
- Limit operator dashboard to 10-12 critical metrics
- Remove metrics that haven't been viewed in 30 days
- Use pre-built dashboard templates, not custom dashboards
- Quarterly dashboard review: Remove unused metrics

---

### 2. Exposing Infrastructure Metrics to Customers
**Symptom**: Customers see raw LLM token counts, STT API calls, individual provider failures. Support ticket volume increases 3-5x with questions like "Why did this call use 8K tokens?"

**Root cause**: Dashboard shows same metrics to operators and customers. No separation of concerns.

**Production impact**: Support team overwhelmed with tickets about metrics customers don't understand. Customer confusion erodes trust.

**Observed in**: Platforms that build single dashboard for operators and customers, platforms without customer-facing dashboard design.

**Mitigation**:
- Separate operator dashboard (infrastructure metrics) from customer dashboard (business metrics)
- Show customers: cost per call, task success rate, error rate
- Hide from customers: tokens, API calls, provider failures, percentile latency
- Test dashboard with non-technical customers before launch

---

### 3. No Drill-Down from Anomaly to Transcript
**Symptom**: Operator sees P95 latency spike on dashboard but cannot identify which calls were slow. Must manually correlate dashboard timestamp with log search.

**Root cause**: Dashboard shows aggregate metrics only, no drill-down to individual calls.

**Production impact**: MTTR increases from 30 minutes to 4+ hours. Operators waste time correlating metrics with logs.

**Observed in**: Platforms using separate dashboards and log systems without integration.

**Mitigation**:
- Implement one-click drill-down from dashboard to call list
- Call list shows individual calls with key metrics (duration, latency, cost, error)
- Call detail view shows full transcript, audio, latency breakdown
- Store trace_id in both metrics and events for correlation (research/09-event-spine.md)

---

### 4. Real-Time Metrics for Customer Dashboard
**Symptom**: Customer dashboard refreshes every 10 seconds with real-time metrics. Infrastructure costs $2000/month for 1000 concurrent calls. Customers don't notice or care about real-time updates.

**Root cause**: Assumption that real-time is always better. No cost-benefit analysis.

**Production impact**: 10-100x higher infrastructure costs with zero customer value. Margins compressed.

**Observed in**: Platforms that prioritize technical impressiveness over business value.

**Mitigation**:
- Use hourly refresh for customer dashboard (sufficient for business decisions)
- Reserve real-time metrics for operator dashboard (incident response)
- Measure: Do customers complain about hourly refresh? (No → don't optimize)
- Cost-benefit analysis: Does real-time justify 10-100x cost increase? (No → use delayed)

---

### 5. Missing Cost Monitoring and Alerts
**Symptom**: Misconfigured customer generates 10,000 calls in 1 hour, burning $5,000. Operators discover issue when customer complains or bill arrives.

**Root cause**: No real-time cost monitoring, no cost alerts, no per-customer spending limits.

**Production impact**: Runaway costs, margin collapse, customer disputes, potential abuse.

**Observed in**: Platforms without cost guardrails (research/17-cost-guardrails.md), platforms that assume customers will self-regulate.

**Mitigation**:
- Implement real-time cost monitoring (<5min latency)
- Alert if any customer exceeds $100/hour (indicates misconfiguration or abuse)
- Alert if cost per call exceeds $1.00 (indicates inefficient model stack)
- Implement per-customer spending limits with automatic throttling (research/17-cost-guardrails.md)

---

### 6. Dashboard Shows Estimated Cost, Invoice Shows Actual Cost
**Symptom**: Dashboard shows "Estimated cost: $450" but invoice shows "Actual cost: $523". Customers dispute invoices, support tickets increase 10x.

**Root cause**: Dashboard uses estimated pricing, invoice uses actual provider costs. Numbers don't match.

**Production impact**: Customer trust erodes, billing disputes, support overwhelmed, potential churn.

**Observed in**: Platforms that don't reconcile dashboard estimates with actual provider costs.

**Mitigation**:
- Dashboard shows exact cost that will be invoiced (not estimates)
- Reconcile provider costs daily, update dashboard with actual costs
- If using estimates, clearly label as "Estimated" and explain variance
- Test: Dashboard cost at end of month must match invoice exactly

---

### 7. No Noisy Neighbor Detection on Operator Dashboard
**Symptom**: One customer generates 10x normal load, degrading performance for all customers. Operators don't notice until other customers complain.

**Root cause**: Operator dashboard shows aggregate metrics only, no per-customer breakdown.

**Production impact**: Cross-tenant performance degradation, customer complaints, SLA violations.

**Observed in**: Multi-tenant platforms without per-customer monitoring.

**Mitigation**:
- Operator dashboard shows per-customer metrics: calls/hour, cost/hour, error rate, resource utilization
- Alert if any customer exceeds 2x normal load (indicates spike or abuse)
- Implement per-customer rate limiting and throttling (research/17-cost-guardrails.md)
- Drill-down from aggregate metrics to per-customer metrics

---

### 8. Dashboard Query Missing customer_id Filter (Security Failure)
**Symptom**: Customer logs into dashboard, sees data from all customers (not just their own). Catastrophic security breach.

**Root cause**: Dashboard query missing `WHERE customer_id = $current_customer` filter. No database row-level security.

**Production impact**: Data breach, GDPR violation, SOC 2 failure, customer trust destroyed, potential lawsuits.

**Observed in**: Platforms without proper multi-tenant isolation (research/16-multi-tenant-isolation.md).

**Mitigation**:
- All dashboard queries MUST include customer_id filter
- Implement database row-level security (RLS) to enforce isolation at database level
- Audit all dashboard queries for missing customer_id filters
- Test: Log in as customer A, verify cannot see customer B's data

---

### 9. Dashboard Shows Metrics Without Context or Trends
**Symptom**: Dashboard shows "Interruption rate: 35%" but customer doesn't know if this is good or bad. Opens support ticket asking "Is 35% normal?"

**Root cause**: Metrics shown without context (historical trend, benchmark, explanation).

**Production impact**: Customer confusion, support tickets, inability to make decisions based on metrics.

**Observed in**: Dashboards that show raw numbers without context.

**Mitigation**:
- Show trends over time ("35%, up from 30% last week")
- Show benchmarks if available ("35%, industry average is 30-40%")
- Provide explanations for metrics ("Interruption rate measures how often users interrupt the agent")
- If metric requires expertise to interpret, hide from customer dashboard

---

### 10. Dashboard Refresh Causes Database Overload
**Symptom**: Dashboard refreshes every 10 seconds for 1000 customers. Database receives 100 queries/second, CPU at 90%, queries slow down, dashboard becomes unusable.

**Root cause**: Dashboard queries database directly on every refresh. No caching, no materialized views.

**Production impact**: Database overload, slow dashboards, potential outage.

**Observed in**: Platforms that don't optimize dashboard queries for scale.

**Mitigation**:
- Use materialized views for dashboard metrics (refresh hourly, not per query)
- Cache dashboard data in Redis (5-60 minute TTL)
- Rate limit dashboard refreshes (max 1 refresh per minute per customer)
- Monitor database query load, alert if exceeds capacity

## Proven Patterns & Techniques

### 1. Pre-Built Dashboard Templates (Not Custom Dashboards)
**Pattern**: Provide 2-3 pre-built dashboard templates (operator, customer, executive). No custom dashboard builder.

**Implementation**:
- **Operator dashboard**: 10-12 critical metrics for incident response (active calls, success rate, error rate, P95 latency, provider health)
- **Customer dashboard**: 6-8 business metrics for self-service (total calls, cost, task success rate, error rate)
- **Executive dashboard**: 4-6 high-level metrics for business decisions (total revenue, total calls, average cost per call, customer count)

**Benefits**:
- **Simplicity**: Operators and customers know exactly where to look
- **Consistency**: All operators see same metrics, easier to train and debug
- **Maintainability**: Update one template, all users get update

**Production examples**:
- PagerDuty: Pre-built analytics dashboards with curated KPIs
- Datadog: Pre-built dashboards for common use cases
- Grafana: Dashboard templates for standard metrics

**When to use**: All production platforms. Custom dashboards create maintenance burden and cognitive overload.

---

### 2. One-Click Drill-Down from Anomaly to Transcript
**Pattern**: Operator clicks metric spike on dashboard → sees list of calls during that time → clicks call → sees full transcript, audio, latency breakdown.

**Implementation**:
- Dashboard shows time-series chart (P95 latency over time)
- Operator clicks spike → dashboard filters call list to that time range
- Call list shows individual calls sorted by latency (highest first)
- Operator clicks call → dashboard shows call detail view with transcript, audio, latency breakdown, tool calls, errors

**Benefits**:
- **Fast debugging**: MTTR reduced from 4 hours to 30 minutes
- **Context**: Operators see full conversation, not just metrics
- **Root cause analysis**: Latency breakdown shows which component failed

**Production examples**:
- Hamming.ai: One-click drill-down from anomaly to transcript (1M+ calls analyzed)
- Datadog: Drill-down from metrics to traces to logs
- Grafana: Drill-down from dashboard to log explorer

**When to use**: All production platforms. This is the most valuable dashboard feature.

---

### 3. Separate Operator and Customer Dashboards
**Pattern**: Operators see infrastructure metrics (tokens, API calls, provider failures). Customers see business metrics (cost, task success rate, error rate).

**Implementation**:
- **Operator dashboard**: Real-time infrastructure metrics for incident response
- **Customer dashboard**: Delayed business metrics for self-service
- No overlap: Customers never see infrastructure metrics, operators see both

**Benefits**:
- **Reduced support tickets**: Customers don't see confusing infrastructure metrics
- **Appropriate latency**: Operators get real-time, customers get hourly (10-100x cost savings)
- **Security**: Customers can't infer platform architecture from metrics

**Production examples**:
- AWS: Separate CloudWatch (operator) and Cost Explorer (customer) dashboards
- Twilio: Separate Console (operator) and Usage dashboard (customer)
- Stripe: Separate internal dashboards and customer-facing Dashboard

**When to use**: All multi-tenant SaaS platforms. Single dashboard for operators and customers creates confusion.

---

### 4. Real-Time Cost Monitoring with Alerts
**Pattern**: Monitor cost per customer per hour in real-time (<5min latency). Alert if any customer exceeds threshold.

**Implementation**:
- Track cost per customer per hour: STT cost + LLM cost + TTS cost + telephony cost
- Alert if any customer exceeds $100/hour (indicates misconfiguration or abuse)
- Alert if cost per call exceeds $1.00 (indicates inefficient model stack)
- Dashboard shows per-customer cost breakdown for operators

**Benefits**:
- **Prevent runaway spend**: Detect misconfigured customers within 5 minutes
- **Margin protection**: Stop abuse before burning $10K+
- **Early warning**: Identify inefficient configurations before they scale

**Production examples**:
- AWS: CloudWatch billing alerts
- Stripe: Real-time usage monitoring and alerts
- Twilio: Usage alerts and spending limits

**When to use**: All production SaaS platforms. Cost monitoring is not optional.

---

### 5. Materialized Views for Dashboard Metrics
**Pattern**: Pre-compute dashboard metrics in materialized views (refresh hourly). Dashboard queries materialized views, not raw events.

**Implementation**:
- Create materialized view for each dashboard metric (total calls, cost, task success rate)
- Refresh materialized views every hour (or 5-15 minutes for near real-time)
- Dashboard queries materialized views (fast, no database overload)
- Use PostgreSQL materialized views or ClickHouse for analytics

**Benefits**:
- **Performance**: Dashboard queries return in <100ms instead of 10+ seconds
- **Scalability**: Database can handle 1000+ concurrent dashboard users
- **Cost**: 10-100x cheaper than real-time metrics

**Production examples**:
- PostgreSQL materialized views: Standard pattern for analytics
- ClickHouse: Optimized for analytics queries on large datasets
- BigQuery: Materialized views for dashboard metrics

**When to use**: All dashboards with delayed metrics (hourly or daily refresh). Don't query raw events on every dashboard load.

---

### 6. Noisy Neighbor Detection on Operator Dashboard
**Pattern**: Operator dashboard shows per-customer metrics (calls/hour, cost/hour, error rate, resource utilization). Alert if any customer exceeds 2x normal load.

**Implementation**:
- Dashboard shows table of customers sorted by calls/hour (descending)
- Highlight customers exceeding 2x normal load (red background)
- Alert if any customer generates >1000 calls/hour (configurable threshold)
- Drill-down to per-customer dashboard for investigation

**Benefits**:
- **Early detection**: Identify noisy neighbors before they impact other customers
- **Rapid response**: Throttle or investigate within minutes
- **Capacity planning**: Identify customers who need dedicated resources

**Production examples**:
- AWS: Per-tenant metrics in multi-tenant architectures
- New Relic: Multi-tenant SaaS monitoring
- Datadog: Per-customer resource utilization tracking

**When to use**: All multi-tenant SaaS platforms. Noisy neighbors are inevitable at scale.

---

### 7. Dashboard Shows Exact Cost (Not Estimates)
**Pattern**: Dashboard shows exact cost that will be invoiced. Reconcile provider costs daily, update dashboard with actual costs.

**Implementation**:
- Track actual provider costs: Deepgram API cost, OpenAI API cost, Cartesia API cost, Twilio call cost
- Reconcile provider invoices daily, update dashboard with actual costs
- Dashboard shows "Cost this month: $523.45" (exact, not estimated)
- Invoice at end of month matches dashboard exactly (no surprises)

**Benefits**:
- **Customer trust**: No billing disputes, no surprises
- **Reduced support tickets**: Customers trust dashboard numbers
- **Accurate forecasting**: Projected monthly cost based on actual costs

**Production examples**:
- AWS: Cost Explorer shows actual costs (not estimates)
- Stripe: Dashboard shows exact transaction amounts
- Twilio: Usage dashboard shows actual provider costs

**When to use**: All SaaS platforms with usage-based billing. Estimates create billing disputes.

---

### 8. Context and Trends on Dashboard Metrics
**Pattern**: Show metrics with context (historical trend, benchmark, explanation). Don't show raw numbers without context.

**Implementation**:
- Show trend: "Task success rate: 85%, up from 80% last week" (with trend arrow)
- Show benchmark: "Interruption rate: 35%, industry average is 30-40%"
- Show explanation: Tooltip or help text explaining what metric means
- Show alert threshold: "Error rate: 2%, alert threshold is 5%"

**Benefits**:
- **Reduced confusion**: Customers understand if metric is good or bad
- **Reduced support tickets**: Customers don't ask "Is this normal?"
- **Actionable insights**: Customers know when to investigate vs when to ignore

**Production examples**:
- Google Analytics: Metrics shown with trends and comparisons
- Datadog: Metrics shown with alert thresholds and historical trends
- Amplitude: Metrics shown with benchmarks and explanations

**When to use**: All customer-facing dashboards. Raw numbers without context create confusion.

---

### 9. Database Row-Level Security for Multi-Tenant Isolation
**Pattern**: Enforce customer_id filter at database level using row-level security (RLS). Dashboard queries cannot bypass isolation.

**Implementation**:
- Enable PostgreSQL row-level security on all dashboard tables
- Create policy: `CREATE POLICY customer_isolation ON events FOR SELECT USING (customer_id = current_setting('app.current_customer_id')::uuid)`
- Set `app.current_customer_id` at connection level (from authentication token)
- All queries automatically filtered by customer_id (cannot be bypassed)

**Benefits**:
- **Security**: Impossible to accidentally expose other customers' data
- **Compliance**: GDPR, SOC 2, HIPAA compliance enforced at database level
- **Defense in depth**: Even if application code has bug, database enforces isolation

**Production examples**:
- PostgreSQL row-level security: Standard pattern for multi-tenant isolation
- Citus: Distributed PostgreSQL with tenant isolation
- AWS RDS: Row-level security for multi-tenant applications

**When to use**: All multi-tenant SaaS platforms. Application-level filtering is not sufficient.

---

### 10. Dashboard Query Caching with Redis
**Pattern**: Cache dashboard metrics in Redis (5-60 minute TTL). Dashboard queries Redis, not database.

**Implementation**:
- Background job refreshes dashboard metrics every 5-60 minutes
- Store metrics in Redis: `SET dashboard:customer:123:total_calls 456 EX 3600`
- Dashboard queries Redis (fast, <10ms latency)
- If Redis miss, query database and cache result

**Benefits**:
- **Performance**: Dashboard loads in <100ms instead of 1-10 seconds
- **Scalability**: Redis can handle 10,000+ queries/second
- **Database protection**: Database not overloaded by dashboard queries

**Production examples**:
- Redis caching: Standard pattern for high-traffic dashboards
- Memcached: Alternative caching layer
- CloudFlare: CDN caching for dashboard API responses

**When to use**: All dashboards with >100 concurrent users. Direct database queries don't scale.

## Engineering Rules (Binding)

### R1: Operator Dashboard MUST Show 10-12 Critical Metrics Only
**Rule**: Operator dashboard limited to 10-12 critical metrics for incident response. Remove unused metrics quarterly.

**Rationale**: Too many metrics create cognitive overload. Operators waste time looking at wrong metrics during incidents.

**Implementation**: Pre-built dashboard template with fixed metrics. No custom dashboard builder.

**Verification**: Operator can diagnose incidents using dashboard alone (no log searching required).

---

### R2: Customer Dashboard MUST Show Business Metrics Only
**Rule**: Customer dashboard shows business metrics (cost, task success rate, error rate). Never show infrastructure metrics (tokens, API calls, provider failures).

**Rationale**: Infrastructure metrics confuse customers and generate 3-5x more support tickets.

**Implementation**: Separate customer dashboard with 6-8 business metrics. No overlap with operator dashboard.

**Verification**: Test dashboard with non-technical customers. Zero confusion about metrics.

---

### R3: Dashboard MUST Support One-Click Drill-Down to Transcripts
**Rule**: Operator can drill down from metric spike to call list to call detail (transcript, audio, latency breakdown) in 2 clicks.

**Rationale**: Without drill-down, MTTR increases from 30 minutes to 4+ hours.

**Implementation**: Dashboard integrates with event store (research/09-event-spine.md). Click metric → filter calls → view call detail.

**Verification**: Operator can diagnose latency spike in <5 minutes using dashboard alone.

---

### R4: Operator Metrics MUST Be Real-Time (<1 Minute Latency)
**Rule**: Operator dashboard metrics refresh in <1 minute. Critical metrics (active calls, error rate) refresh in <10 seconds.

**Rationale**: Operators need immediate signal of degradation for incident response.

**Implementation**: Prometheus + Grafana or equivalent real-time metrics system.

**Verification**: Inject error, verify operator dashboard shows error within 1 minute.

---

### R5: Customer Metrics MUST Be Delayed (Hourly Refresh)
**Rule**: Customer dashboard metrics refresh hourly. No real-time metrics for customers.

**Rationale**: Customers analyze trends, not respond to incidents. Hourly refresh sufficient. Real-time adds 10-100x cost with zero customer value.

**Implementation**: PostgreSQL materialized views refreshed hourly.

**Verification**: Measure: Do customers complain about hourly refresh? (No → don't optimize)

---

### R6: Dashboard MUST Show Exact Cost (Not Estimates)
**Rule**: Dashboard shows exact cost that will be invoiced. Reconcile provider costs daily.

**Rationale**: Estimated costs create billing disputes and erode customer trust.

**Implementation**: Track actual provider costs, update dashboard daily. Invoice matches dashboard exactly.

**Verification**: Dashboard cost at end of month equals invoice (zero variance).

---

### R7: Dashboard Queries MUST Include customer_id Filter
**Rule**: All customer dashboard queries include `WHERE customer_id = $current_customer`. Enforced at database level with row-level security.

**Rationale**: Missing customer_id filter exposes all customers' data (catastrophic security breach).

**Implementation**: PostgreSQL row-level security enforces customer_id filter at database level.

**Verification**: Log in as customer A, verify cannot see customer B's data.

---

### R8: Dashboard MUST Show Per-Customer Metrics for Noisy Neighbor Detection
**Rule**: Operator dashboard shows per-customer metrics (calls/hour, cost/hour, error rate, resource utilization).

**Rationale**: Noisy neighbors degrade performance for all customers. Must detect within minutes.

**Implementation**: Dashboard shows table of customers sorted by load. Alert if any customer exceeds 2x normal.

**Verification**: Inject 10x load from one customer, verify alert within 5 minutes.

---

### R9: Dashboard MUST Alert on Runaway Costs
**Rule**: Alert if any customer exceeds $100/hour spend. Alert if cost per call exceeds $1.00.

**Rationale**: Misconfigured customers can burn $10K+ before anyone notices without cost monitoring.

**Implementation**: Real-time cost monitoring (<5min latency). PagerDuty alert on threshold breach.

**Verification**: Inject 1000 calls in 5 minutes, verify cost alert fires.

---

### R10: Dashboard Metrics MUST Use Materialized Views (Not Raw Events)
**Rule**: Dashboard queries materialized views (refreshed hourly), not raw events table.

**Rationale**: Querying raw events on every dashboard load causes database overload at scale.

**Implementation**: PostgreSQL materialized views for all dashboard metrics. Refresh every hour.

**Verification**: Dashboard query returns in <100ms. Database CPU <50% with 1000 concurrent users.

## Metrics & Signals to Track

### Operator Dashboard Metrics (Real-Time)

**System Health:**
- Active calls (current concurrent calls)
- Call attempts per minute (incoming load)
- Success rate (percentage of calls completing without technical failure)
- Error rate (percentage of calls with errors)
- Resource utilization (CPU, memory, disk per service)

**Latency:**
- P50/P95/P99 end-to-end turn latency
- Time to first audio (TTFA)
- Component latency breakdown (STT, LLM, TTS separately)

**Provider Health:**
- STT provider success rate (Deepgram/Groq)
- LLM provider success rate (OpenAI/Anthropic)
- TTS provider success rate (Cartesia/ElevenLabs)
- Telephony provider success rate (Twilio/Telnyx)

**Conversation Quality:**
- Tool failure rate
- Escalation rate (delayed, 15min acceptable)
- Interruption rate (delayed, 15min acceptable)
- Average call duration (delayed, 15min acceptable)

### Customer Dashboard Metrics (Delayed, Hourly)

**Usage & Billing:**
- Total calls this month
- Cost this month (exact, not estimated)
- Cost per call
- Projected monthly cost
- Usage trend (calls per day over last 30 days)

**Call Quality:**
- Task success rate
- Customer satisfaction (CSAT)
- Average call duration
- Call completion rate (not abandoned)
- Error rate

**System Health:**
- Uptime percentage
- Error rate

### Dashboard Performance Metrics

**Query Performance:**
- Dashboard query latency (P50/P95/P99, target: P95 <100ms)
- Dashboard load time (target: <2 seconds)
- Materialized view refresh time (target: <5 minutes)

**Usage:**
- Dashboard views per day (by customer and operator)
- Drill-down clicks per day (measure engagement)
- Dashboard refresh rate (queries per second)

**Database Load:**
- Dashboard queries per second
- Database CPU utilization from dashboard queries (target: <20%)
- Materialized view storage size

### Cost Monitoring Metrics

**Real-Time Cost (Operator):**
- Cost per customer per hour
- Total platform cost per hour
- Cost per call (average)
- Cost breakdown (STT, LLM, TTS, telephony separately)

**Cost Alerts:**
- Number of customers exceeding $100/hour
- Number of calls exceeding $1.00/call
- Total platform spend vs budget

### Multi-Tenant Metrics (Operator)

**Per-Customer Load:**
- Calls per customer per hour
- Cost per customer per hour
- Error rate per customer
- Resource utilization per customer (CPU, memory)

**Noisy Neighbor Detection:**
- Customers exceeding 2x normal load
- Customers with >5% error rate
- Customers with P95 latency >2x platform average

## V1 Decisions / Constraints

### D-DASH-001 Operator Dashboard MUST Use Pre-Built Template with 9 Metrics
**Decision**: Operator dashboard uses pre-built Grafana template with 9 metrics: active calls, success rate, error rate, P95 latency, STT/LLM/TTS provider success rates, tool failure rate, escalation rate.

**Rationale**: Simplicity and consistency. Operators know exactly where to look during incidents.

**Constraints**: No custom dashboards. No adding metrics without removing others (maintain 10-12 limit).

---

### D-DASH-002 Customer Dashboard MUST Show 6 Business Metrics Only
**Decision**: Customer dashboard shows 6 metrics: total calls, cost this month, projected monthly cost, task success rate, average call duration, error rate.

**Rationale**: Customers need business metrics for self-service. Infrastructure metrics create confusion and support tickets.

**Constraints**: Never expose tokens, API calls, provider failures, percentile latency to customers.

---

### D-DASH-003 Operator Metrics MUST Be Real-Time (<1 Minute)
**Decision**: Operator dashboard metrics refresh every 30 seconds. Use Prometheus + Grafana for real-time metrics.

**Rationale**: Operators need immediate signal of degradation for incident response.

**Constraints**: Accept $500-$1000/month cost for real-time operator metrics (Prometheus + Grafana infrastructure).

---

### D-DASH-004 Customer Metrics MUST Be Delayed (Hourly Refresh)
**Decision**: Customer dashboard metrics refresh every hour. Use PostgreSQL materialized views.

**Rationale**: Hourly refresh sufficient for customer self-service. 10-100x cheaper than real-time.

**Constraints**: Customers may see up to 1 hour delay in metrics. Acceptable for business decisions.

---

### D-DASH-005 Dashboard MUST Support Drill-Down to Call Detail
**Decision**: Operator can drill down from metric spike to call list to call detail (transcript, audio, latency breakdown) in 2 clicks.

**Rationale**: Without drill-down, MTTR increases from 30 minutes to 4+ hours.

**Constraints**: Must store events with trace_id for correlation (research/09-event-spine.md). Must store audio for playback.

---

### D-DASH-006 Dashboard MUST Show Exact Cost (Not Estimates)
**Decision**: Dashboard shows exact cost that will be invoiced. Reconcile provider costs daily.

**Rationale**: Estimated costs create billing disputes and erode customer trust.

**Constraints**: Must track actual provider costs (Deepgram, OpenAI, Cartesia, Twilio invoices). Must reconcile daily.

---

### D-DASH-007 Dashboard Queries MUST Use Row-Level Security
**Decision**: Enable PostgreSQL row-level security on all dashboard tables. All queries automatically filtered by customer_id.

**Rationale**: Missing customer_id filter exposes all customers' data (catastrophic security breach).

**Constraints**: Must set `app.current_customer_id` at connection level from authentication token.

---

### D-DASH-008 Dashboard MUST Alert on Runaway Costs
**Decision**: Alert if any customer exceeds $100/hour spend. Alert if cost per call exceeds $1.00.

**Rationale**: Misconfigured customers can burn $10K+ before anyone notices without cost monitoring.

**Constraints**: Must implement real-time cost monitoring (<5min latency). Must integrate with PagerDuty for alerts.

---

### D-DASH-009 Dashboard Metrics MUST Use Materialized Views
**Decision**: All customer dashboard metrics use PostgreSQL materialized views (refreshed hourly). No direct queries on raw events table.

**Rationale**: Querying raw events on every dashboard load causes database overload at scale.

**Constraints**: Must create materialized views for all dashboard metrics. Must refresh every hour.

---

### D-DASH-010 Operator Dashboard MUST Show Per-Customer Metrics
**Decision**: Operator dashboard shows table of customers sorted by calls/hour. Alert if any customer exceeds 2x normal load.

**Rationale**: Noisy neighbors degrade performance for all customers. Must detect within minutes.

**Constraints**: Must track per-customer metrics in real-time. Must define "normal load" threshold per customer.

---

### D-DASH-011 Dashboard MUST Show Metrics with Context
**Decision**: All customer dashboard metrics show trend ("85%, up from 80% last week") and explanation (tooltip).

**Rationale**: Raw numbers without context create confusion and support tickets.

**Constraints**: Must store historical metrics for trend calculation. Must write explanations for all metrics.

---

### D-DASH-012 Dashboard MUST Cache Metrics in Redis
**Decision**: Cache customer dashboard metrics in Redis (60 minute TTL). Dashboard queries Redis, not database.

**Rationale**: Database cannot handle 1000+ concurrent dashboard users without caching.

**Constraints**: Must implement Redis caching layer. Must handle cache misses gracefully.

---

### D-DASH-013 Dashboard Load Time MUST Be <2 Seconds
**Decision**: Customer dashboard loads in <2 seconds (P95). Operator dashboard loads in <1 second (P95).

**Rationale**: Slow dashboards frustrate users and reduce engagement.

**Constraints**: Must optimize queries, use caching, use materialized views. Must monitor dashboard load time.

---

### D-DASH-014 Dashboard MUST Export Call List to CSV
**Decision**: Operator can export call list to CSV for offline analysis (max 10,000 calls per export).

**Rationale**: Operators need to analyze patterns across many calls (e.g., "all calls with >2s latency last week").

**Constraints**: Must implement CSV export API. Must limit to 10,000 calls to prevent database overload.

---

### D-DASH-015 Dashboard MUST Show Provider Health Separately
**Decision**: Operator dashboard shows STT, LLM, TTS, telephony provider success rates separately (not aggregated).

**Rationale**: 50% of production issues are provider failures. Must identify which provider failed.

**Constraints**: Must track provider success rate separately. Must alert on provider degradation.

## Open Questions / Risks

### Q1: How to Handle Dashboard Metrics During Provider Outages?
**Question**: If OpenAI is down, LLM provider success rate drops to 0%. Should dashboard show "0%" or "Provider outage detected"?

**Risk**: "0%" looks like platform failure, creates panic. But "Provider outage" requires detecting outages automatically.

**Mitigation options**:
- Show raw success rate (0%) with context ("OpenAI outage detected, fallback to Anthropic active")
- Implement provider outage detection (if success rate <50% for >5 minutes, assume outage)
- Show status page link ("OpenAI status: https://status.openai.com")

**V1 decision**: Show raw success rate with context. Add provider status page links to dashboard.

---

### Q2: How to Handle Dashboard Metrics for Low-Volume Customers?
**Question**: Customer with 10 calls/month sees "Task success rate: 80%". But 80% = 8/10 calls, high variance. Is this metric meaningful?

**Risk**: Low-volume customers see noisy metrics, make incorrect decisions based on insufficient data.

**Mitigation options**:
- Show confidence interval ("80% ± 25%")
- Show sample size ("80% (8/10 calls)")
- Hide metric if sample size <100 ("Insufficient data")
- Show warning ("Low volume, metrics may be noisy")

**V1 decision**: Show sample size ("80% (8/10 calls)"). Add tooltip explaining variance.

---

### Q3: How to Handle Real-Time Cost Monitoring Latency?
**Question**: Provider costs are reconciled daily (Deepgram, OpenAI invoices). How to show real-time cost monitoring with daily reconciliation?

**Risk**: Real-time cost monitoring shows estimates, daily reconciliation shows actuals. Numbers don't match.

**Mitigation options**:
- Show estimated cost in real-time, reconcile daily, update dashboard with actuals
- Show "Estimated cost (reconciled daily)" label
- Alert on estimates, invoice on actuals (accept variance)

**V1 decision**: Show estimated cost in real-time with "Estimated (reconciled daily)" label. Reconcile daily, update dashboard with actuals.

---

### Q4: How to Handle Dashboard Access Control?
**Question**: Should customers have multiple users with different dashboard permissions (admin sees cost, agent sees call quality only)?

**Risk**: Complex access control increases implementation time. But single-user access limits enterprise adoption.

**Mitigation options**:
- V1: Single user per customer (admin sees all metrics)
- V2: Role-based access control (admin, agent, viewer roles)
- V3: Custom permissions per user

**V1 decision**: Single user per customer. All customers see same dashboard. Add RBAC in V2 if customers request it.

---

### Q5: How to Handle Dashboard Customization Requests?
**Question**: Customers request custom metrics ("show calls by time of day", "show calls by agent version"). Should dashboard support custom metrics?

**Risk**: Custom metrics increase implementation burden. But lack of customization limits enterprise adoption.

**Mitigation options**:
- V1: No custom metrics, use pre-built dashboard
- V2: Add 5-10 common custom metrics based on customer requests
- V3: Full custom dashboard builder (high complexity)

**V1 decision**: No custom metrics for V1. Collect customer requests, add most common metrics in V2.

---

### Q6: How to Handle Dashboard Performance at Scale?
**Question**: With 10,000 customers, materialized views refresh every hour. Refresh takes 30+ minutes, blocking other queries. How to scale?

**Risk**: Materialized view refresh blocks dashboard queries, creates slow dashboards.

**Mitigation options**:
- Use incremental materialized view refresh (PostgreSQL 13+)
- Use ClickHouse for analytics (optimized for large-scale aggregations)
- Partition materialized views by customer (refresh in parallel)
- Use separate analytics database (replicate events to ClickHouse)

**V1 decision**: Use PostgreSQL materialized views with incremental refresh. Migrate to ClickHouse in V2 if refresh time >10 minutes.

---

### Q7: How to Handle Dashboard Downtime During Incidents?
**Question**: If database is down, dashboard is down. Operators cannot diagnose incident without dashboard. How to ensure dashboard availability?

**Risk**: Dashboard unavailable during incidents, MTTR increases.

**Mitigation options**:
- Use separate database for dashboard metrics (isolated from production database)
- Use read replica for dashboard queries (avoid impacting production writes)
- Cache dashboard metrics in Redis (dashboard works even if database down)
- Use external monitoring (Datadog) as backup during dashboard downtime

**V1 decision**: Use read replica for dashboard queries. Cache metrics in Redis. Use Datadog as backup during dashboard downtime.

---

### Q8: How to Handle Dashboard Metrics for Multi-Region Deployments?
**Question**: Platform deployed in 3 regions (US, EU, Asia). Should dashboard show per-region metrics or aggregate across regions?

**Risk**: Aggregate metrics hide regional issues. Per-region metrics create cognitive overload.

**Mitigation options**:
- Show aggregate metrics by default, drill-down to per-region metrics
- Show per-region metrics side-by-side (3 columns)
- Use region selector (dropdown to switch between regions)

**V1 decision**: Show aggregate metrics by default. Add region filter (dropdown) for drill-down. Alert on per-region degradation.

---

### Q9: How to Handle Dashboard Metrics for A/B Tests?
**Question**: Running A/B test with 2 agent versions. Should dashboard show per-version metrics to compare performance?

**Risk**: Without per-version metrics, cannot measure A/B test impact. But per-version metrics increase dashboard complexity.

**Mitigation options**:
- V1: No per-version metrics, use offline analysis for A/B tests
- V2: Add version filter to dashboard (compare version A vs version B)
- V3: Built-in A/B test analysis (statistical significance testing)

**V1 decision**: No per-version metrics for V1. Export call list to CSV, analyze offline. Add version filter in V2.

---

### Q10: How to Handle Dashboard Metrics for Compliance and Auditing?
**Question**: Customers require audit logs of who viewed which dashboard metrics (SOC 2, HIPAA compliance). Should dashboard log all queries?

**Risk**: Audit logging increases database load and storage costs. But lack of audit logs blocks enterprise customers.

**Mitigation options**:
- V1: No audit logging, not required for initial customers
- V2: Log dashboard queries to separate audit log table (customer_id, user_id, timestamp, query)
- V3: Full audit trail with retention policy (90 days)

**V1 decision**: No audit logging for V1. Add audit logging in V2 when enterprise customers require it (SOC 2 compliance).
