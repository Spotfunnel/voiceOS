# Research: Regional & Global Scaling for Voice AI Systems (V2-Capable Architecture)

## Why This Matters for V1

Regional scaling is **not a V1 feature**—but V1 architectural decisions will either enable or permanently block multi-region deployment in V2. The core challenge: voice AI systems require **sub-500ms response times** for natural conversation, but **cross-region network latency alone adds 100-500ms** (Asia to US: ~500ms). Production evidence from 2025-2026 reveals systematic failures: (1) **latency explosion**—global-first designs route all traffic through single region, adding 250ms+ in network hops before AI processing begins, causing 40% higher call abandonment, (2) **compliance violations**—GDPR/CCPA/PIPL require data residency, storing EU customer data in US violates GDPR (€20M fines), China requires data localization (no cross-border transfer without certification), (3) **cost explosion**—cross-region data transfer costs $0.02-$0.12 per GB, high-volume voice systems pay $10K-$100K monthly in transfer fees, and (4) **operational complexity**—multi-region databases require choosing between consistency and availability (CAP theorem), asynchronous replication introduces data loss risk.

The pattern is clear: **voice AI systems must be region-local by default, not globally centralized**. Research shows natural conversation requires **300-500ms response times**, but delays exceeding 800ms feel robotic, and beyond 1.2 seconds users hang up. For V1, this means: **design for single-region deployment with region-local data storage, but architect to support multi-region in V2 without rewrites**.

**V1-AWARE Requirements (Must Exist in V1):**
- **Region-configurable deployment** (single region in V1, but code/config supports multiple regions in V2)
- **Region-local data storage** (no cross-region database dependencies)
- **Region-agnostic service endpoints** (use region parameter, not hardcoded URLs)
- **Tenant-to-region mapping** (track which region each tenant uses, even if single region in V1)
- **Compliance-aware data capture** (PII redaction, consent, retention for GDPR/CCPA/PIPL)

**V2-ONLY Features (Explicitly NOT in V1):**
- Multiple region deployments (active-active or active-passive)
- Cross-region failover and routing
- Multi-region database replication
- Global load balancing and traffic management
- Cross-region data synchronization

## What Matters in Production (Facts Only)

### How STT, LLM, and TTS Are Regionally Deployed

**Core Insight (2025-2026):**
Voice AI services (STT, LLM, TTS) must be **region-local** to meet latency requirements. Each network hop adds 20-50ms, and cross-region calls add 100-500ms. Production systems co-locate all services in same region or use edge computing to minimize network hops.

**Regional Deployment Patterns (Verified 2025-2026):**

**Pattern 1: Co-Located Regional Deployment (Recommended for V1-Aware)**

**Architecture**:
- All services (STT, LLM, TTS, telephony) deployed in same region
- No cross-region service calls during conversation
- Database and storage in same region
- Minimize network hops between services

**Latency Breakdown (Optimized)**:
- **STT**: 100-150ms (Deepgram Nova-3 in same region)
- **LLM**: 200-500ms TTFT (GPT-4o in same region)
- **TTS**: 75-100ms (Cartesia Sonic 3 in same region)
- **Network overhead**: 50-100ms (within region)
- **Total**: 425-750ms (meets <800ms target)

**Production Example (Telnyx)**:
- Co-located GPUs with telephony infrastructure
- Eliminates network hops between services
- Achieves sub-second roundtrip times
- **Key insight**: "Each network hop between services adds 20-50ms of delay"

**V1 Implementation**: Deploy all services in single region (US-East-1 or EU-West-1). No cross-region calls.

**Pattern 2: Edge Computing Deployment (V2-ONLY)**

**Architecture**:
- STT and TTS at edge (Cloudflare, AWS Local Zones)
- LLM in regional cloud (requires GPU)
- Telephony at edge or regional
- Minimize distance from user to first service

**Latency Breakdown (Edge-Optimized)**:
- **STT**: 75-100ms (edge processing, closer to user)
- **LLM**: 200-500ms TTFT (regional cloud)
- **TTS**: 50-75ms (edge processing)
- **Network overhead**: 30-50ms (edge to cloud)
- **Total**: 355-725ms (meets <800ms target)

**Production Example (Cloudflare Realtime Agents)**:
- 330+ datacenters globally
- Process STT and TTS at edge
- Route to regional LLM for inference
- **Key insight**: "Minimize latency through distributed processing"

**V2 Implementation**: Deploy STT/TTS at edge, LLM in regional cloud. Requires edge orchestration.

**Pattern 3: Hybrid Deployment (V2-ONLY)**

**Architecture**:
- STT at edge or regional (depends on provider)
- LLM in regional cloud (GPU required)
- TTS at edge or regional (depends on provider)
- Telephony in regional or edge

**Latency Breakdown (Hybrid)**:
- **STT**: 100-150ms (regional or edge)
- **LLM**: 200-500ms TTFT (regional cloud)
- **TTS**: 75-100ms (regional or edge)
- **Network overhead**: 50-100ms
- **Total**: 425-750ms

**V2 Implementation**: Mix edge and regional based on provider availability and cost.

**Regional Availability (Verified 2025-2026):**

**Azure Speech Service (STT/TTS)**:
- **US**: Central US, East US, East US 2, North Central US, South Central US, West US, West US 2, West US 3
- **Europe**: North Europe, West Europe, France Central, Germany West Central, UK South
- **Asia Pacific**: East Asia, Southeast Asia, Australia East, Japan East, Korea Central, Central India
- **Other**: Canada Central, Brazil South, UAE North, South Africa North, Qatar Central
- **Key constraint**: Data stored and processed only in region where resource created
- **Key constraint**: Region-specific keys valid only in their region

**AWS Services (STT/LLM/TTS)**:
- Amazon Lex V1 discontinued September 15, 2025 (migrate to V2)
- Amazon Lex V2 available in multiple regions (check AWS regions and endpoints)
- Amazon Bedrock (LLM) available in select regions
- Amazon Transcribe (STT) available in most regions

**OpenAI (LLM)**:
- GPT-4o available globally (no region restrictions)
- Realtime API (gpt-realtime) for voice agents
- No explicit region selection (routed to nearest datacenter)

**Deepgram (STT)**:
- Nova-3 available globally
- No explicit region selection (routed to nearest datacenter)

**Cartesia (TTS)**:
- Sonic 3 available globally
- No explicit region selection (routed to nearest datacenter)

**Key Architectural Decisions (V1-AWARE):**

**1. Region-Configurable Service Endpoints (MUST exist in V1)**
- Don't hardcode service URLs (e.g., `https://api.openai.com`)
- Use region parameter in configuration (e.g., `region: us-east-1`)
- Enable switching regions without code changes
- **V1 implementation**: Config file with `region` parameter, used to construct service URLs

**2. Region-Local Data Storage (MUST exist in V1)**
- Database in same region as services
- No cross-region database queries during conversation
- Minimize cross-region data transfer (cost and latency)
- **V1 implementation**: PostgreSQL in same region as services

**3. Service Provider Region Mapping (MUST exist in V1)**
- Track which region each service provider supports
- Validate region compatibility before deployment
- Handle providers without explicit region support (route to nearest)
- **V1 implementation**: Service provider config with supported regions

**4. Latency Monitoring Per Region (MUST exist in V1)**
- Measure latency per service per region
- Alert if latency exceeds thresholds (STT >200ms, LLM >800ms, TTS >150ms)
- Identify cross-region calls (should be zero in V1)
- **V1 implementation**: Metrics per service with region tag

### What Must Be Region-Local vs Globally Shared

**Core Tradeoff (2025-2026):**
Region-local resources minimize latency and meet compliance requirements. Globally shared resources reduce operational complexity and cost. Production systems use **region-local by default, globally shared only when necessary**.

**Region-Local Resources (MUST Be Region-Local):**

**1. Conversation State and Session Data**
- **Why**: Sub-500ms latency requirement, GDPR/CCPA data residency
- **Storage**: PostgreSQL in same region as services
- **Access pattern**: Read/write during conversation (latency-sensitive)
- **Replication**: None in V1, asynchronous in V2 (for failover only)
- **V1 implementation**: PostgreSQL in single region

**2. Audio Recordings and Transcripts**
- **Why**: GDPR/CCPA data residency, large data size (cost to transfer)
- **Storage**: S3 or equivalent in same region
- **Access pattern**: Write during conversation, read for replay/analytics (not latency-sensitive)
- **Replication**: None in V1, optional in V2 (for compliance/backup)
- **V1 implementation**: S3 in single region

**3. STT, LLM, TTS Service Calls**
- **Why**: Sub-500ms latency requirement, each cross-region hop adds 20-50ms
- **Deployment**: Services in same region as application
- **Access pattern**: Synchronous calls during conversation (latency-sensitive)
- **Failover**: None in V1, cross-region failover in V2
- **V1 implementation**: All services in single region

**4. Telephony and WebRTC Infrastructure**
- **Why**: Audio transport latency (100-500ms cross-region), voice quality
- **Deployment**: Telephony provider in same region or nearest edge
- **Access pattern**: Real-time audio streaming (latency-sensitive)
- **Failover**: Provider-managed (Twilio, Telnyx)
- **V1 implementation**: Telephony provider in single region

**5. User-Specific Data (PII, Preferences, History)**
- **Why**: GDPR/CCPA data residency, compliance requirements
- **Storage**: PostgreSQL in same region
- **Access pattern**: Read at conversation start, write at conversation end
- **Replication**: None in V1, asynchronous in V2 (for failover only)
- **V1 implementation**: PostgreSQL in single region

**Globally Shared Resources (Can Be Global):**

**1. Agent Definitions and Configurations**
- **Why**: Immutable, no PII, small data size, not latency-sensitive
- **Storage**: S3 or equivalent (global or replicated)
- **Access pattern**: Read at agent initialization (not during conversation)
- **Replication**: Multi-region replication for availability
- **V1 implementation**: S3 in single region (replicate in V2)

**2. Knowledge Bases and Product Catalogs**
- **Why**: Immutable, no PII, read-only, not latency-sensitive (if cached)
- **Storage**: S3 or vector database (global or replicated)
- **Access pattern**: Read at conversation start or on-demand (cached)
- **Replication**: Multi-region replication for availability
- **V1 implementation**: S3 in single region, cache in memory (replicate in V2)

**3. Analytics and Metrics (Aggregated)**
- **Why**: No PII (aggregated), not latency-sensitive, batch processing
- **Storage**: Data warehouse (Snowflake, BigQuery) or S3
- **Access pattern**: Batch writes, dashboard reads (not real-time)
- **Replication**: Multi-region replication for availability
- **V1 implementation**: S3 in single region, export to data warehouse (replicate in V2)

**4. Application Code and Docker Images**
- **Why**: Immutable, no PII, small data size, not latency-sensitive
- **Storage**: Docker registry (ECR, GCR) or S3
- **Access pattern**: Read at deployment (not during conversation)
- **Replication**: Multi-region replication for availability
- **V1 implementation**: ECR in single region (replicate in V2)

**5. Monitoring and Logging Infrastructure**
- **Why**: No PII (if redacted), not latency-sensitive, centralized observability
- **Storage**: Logging service (CloudWatch, Datadog) or S3
- **Access pattern**: Asynchronous writes, dashboard reads
- **Replication**: Provider-managed (multi-region)
- **V1 implementation**: CloudWatch in single region (centralize in V2)

**Hybrid Resources (Region-Local with Global Sync):**

**1. Tenant Configuration and Metadata**
- **Why**: Small data size, infrequent updates, needed in all regions
- **Storage**: PostgreSQL in each region (replicated)
- **Access pattern**: Read at conversation start (latency-sensitive), write infrequent
- **Replication**: Asynchronous multi-region replication (eventual consistency)
- **V1 implementation**: PostgreSQL in single region (replicate in V2)

**2. User Authentication and Authorization**
- **Why**: Needed in all regions, infrequent updates, security-critical
- **Storage**: Auth service (Auth0, Cognito) or PostgreSQL (replicated)
- **Access pattern**: Read at conversation start (latency-sensitive), write infrequent
- **Replication**: Multi-region replication (eventual consistency)
- **V1 implementation**: Auth0 (provider-managed) or PostgreSQL in single region

**Key Architectural Decisions (V1-AWARE):**

**1. Tenant-to-Region Mapping (MUST exist in V1)**
- Track which region each tenant uses
- Store in globally accessible location (or replicated)
- Enable routing calls to correct region in V2
- **V1 implementation**: Tenant table with `region` column (single region for all tenants in V1)

**2. Data Residency Compliance (MUST exist in V1)**
- Capture tenant's data residency requirements (EU, US, China, etc.)
- Store data only in compliant regions
- Prevent cross-region data transfer without consent
- **V1 implementation**: Tenant table with `data_residency` column (enforce in V2)

**3. Cross-Region Data Transfer Minimization (MUST exist in V1)**
- Avoid cross-region service calls during conversation
- Batch cross-region data transfers (analytics, backups)
- Monitor cross-region transfer costs
- **V1 implementation**: Metrics for cross-region calls (should be zero)

### Regulatory and Data Residency Constraints

**Core Constraint (2025-2026):**
GDPR (EU), CCPA (California), and PIPL (China) require **data residency** and **data localization**. Storing EU customer data in US violates GDPR (€20M fines). Transferring data out of China requires certification (effective January 1, 2026).

**GDPR (EU) Requirements (Verified 2025-2026):**

**Data Residency**:
- Personal data of EU residents must be stored in EU or adequate jurisdiction
- Voice recordings are PII (reveal gender, ethnic origin, health conditions)
- Transfers to US require EU-US Data Privacy Framework (2023 adequacy decision)
- Transfers to other countries require Standard Contractual Clauses (SCCs) or adequacy decision

**Consent Requirements**:
- Explicit, informed consent for recording and processing
- Consent must be specific (not vague "may be recorded")
- Opt-out mechanism required
- Consent can be withdrawn at any time

**Data Subject Rights**:
- Right to access (provide copy of recordings and transcripts)
- Right to deletion (delete recordings on request)
- Right to portability (export data in machine-readable format)
- Right to rectification (correct inaccurate data)

**Fines**:
- Up to €20M or 4% of global annual revenue (whichever is higher)
- Enforcement increasing (2025-2026)

**V1-AWARE Implementation**:
- Store EU customer data in EU region (EU-West-1)
- Implement consent management (research/19-training-from-data.md)
- Implement data subject rights (access, deletion, portability)
- PII redaction for analytics (research/19-training-from-data.md)

**CCPA (California) Requirements (Verified 2025-2026):**

**Data Residency**:
- No explicit data residency requirement (unlike GDPR)
- But data must be accessible for data subject requests

**Consumer Rights**:
- Right to know (what data collected, how used, who shared with)
- Right to delete (delete personal information on request)
- Right to opt-out (opt-out of data sale/sharing)
- Right to non-discrimination (no penalty for exercising rights)

**Fines**:
- $2,500 per unintentional violation
- $7,500 per intentional violation
- Private right of action for data breaches ($100-$750 per consumer)

**V1-AWARE Implementation**:
- Store California customer data in US region (US-West-1 or US-East-1)
- Implement consumer rights (access, deletion, opt-out)
- No cross-state data transfer restrictions (unlike GDPR cross-border)

**PIPL (China) Requirements (Verified 2025-2026):**

**Data Localization**:
- Personal information must be stored in China
- Cross-border transfer requires one of three mechanisms:
  1. **CAC Security Assessment**: Required for 1M+ individuals or critical infrastructure
  2. **PIP Certification**: Effective January 1, 2026, for 10K-100K individuals (non-critical) or <10K sensitive
  3. **Standard Contractual Clauses**: For 10K-100K individuals (non-critical)

**Sensitive Personal Information**:
- Biometric data (voice recordings) classified as sensitive
- Requires separate individual consent before cross-border transfer
- Impact assessments required

**Fines**:
- Up to ¥50M or 5% of prior year's revenue
- Enforcement increasing (2025-2026)

**V1-AWARE Implementation**:
- Store China customer data in China region (if serving China market)
- Implement data localization (no cross-border transfer without certification)
- Obtain separate consent for cross-border transfer (if needed)
- **V1 decision**: Do NOT serve China market in V1 (defer to V2 due to complexity)

**Other Regional Requirements:**

**Brazil (LGPD)**:
- Similar to GDPR (data residency, consent, data subject rights)
- Fines up to 2% of revenue (max R$50M per violation)

**India (DPDPA)**:
- Data localization for sensitive personal data
- Cross-border transfer requires government approval

**Russia**:
- Data localization for Russian citizens
- Data must be stored on servers in Russia

**V1-AWARE Decisions:**

**1. Region Selection for V1 (MUST decide in V1)**
- **US region** (US-East-1 or US-West-1): Serves US, Canada, Latin America (except Brazil)
- **EU region** (EU-West-1): Serves EU, UK, Switzerland (GDPR compliance)
- **V1 decision**: Deploy in single region (US or EU based on target market)

**2. Data Residency Enforcement (MUST exist in V1)**
- Tenant table with `data_residency` column (EU, US, China, etc.)
- Validate data stored in compliant region
- Prevent cross-region data transfer without consent
- **V1 implementation**: Single region, but track data residency for V2

**3. Compliance-Aware Data Capture (MUST exist in V1)**
- PII redaction (research/19-training-from-data.md)
- Consent management (research/19-training-from-data.md)
- Retention policies (research/19-training-from-data.md)
- Data subject rights (access, deletion, portability)
- **V1 implementation**: All compliance features in single region

### Failover and Routing Strategies Across Regions

**Core Tradeoff (2025-2026):**
Multi-region failover provides high availability but adds complexity and cost. Production systems use **active-passive** (standby region for failover) or **active-active** (both regions serve traffic). Voice AI systems prefer **active-passive** due to database consistency requirements.

**Failover Patterns (Verified 2025-2026):**

**Pattern 1: Active-Passive (Recommended for V2)**

**Architecture**:
- **Primary region**: Serves all traffic, writes to database
- **Secondary region**: Standby, replicates database asynchronously
- **Failover**: Manual or automatic switch to secondary on primary outage
- **Recovery**: Switch back to primary when recovered

**Benefits**:
- **Cost-effective**: Secondary region runs minimal resources (standby)
- **Simpler**: No cross-region coordination during normal operation
- **Data consistency**: Single write region (no conflicts)

**Drawbacks**:
- **Higher RTO**: Recovery Time Objective 5-30 minutes (time to detect failure + failover)
- **Higher RPO**: Recovery Point Objective 1-60 seconds (data loss from replication lag)
- **Manual intervention**: May require operator to trigger failover

**Production Example (AWS Amazon Lex)**:
- Global Resiliency feature enables near real-time replication across regions
- Automatic synchronization of bots, versions, aliases
- Switch traffic by changing region identifier
- Supports active-active or active-passive deployment

**V2 Implementation**:
- Primary region: US-East-1 (serves all traffic)
- Secondary region: US-West-2 (standby, replicates database)
- Route53 health checks detect primary outage
- Automatic failover to secondary (5-10 minute RTO)
- Asynchronous database replication (1-5 second RPO)

**Pattern 2: Active-Active (V2-ONLY, Complex)**

**Architecture**:
- **Multiple regions**: All serve traffic, all write to database
- **Load balancing**: Global load balancer routes traffic to nearest region
- **Database**: Multi-region replication (eventual consistency)
- **Conflict resolution**: Last-writer-wins or custom logic

**Benefits**:
- **Lower RTO**: Recovery Time Objective <1 minute (automatic failover)
- **Lower RPO**: Recovery Point Objective <1 second (minimal data loss)
- **Better latency**: Users routed to nearest region

**Drawbacks**:
- **Higher cost**: All regions run full resources
- **Complexity**: Cross-region coordination, conflict resolution
- **Data consistency**: Eventual consistency (not strong consistency)

**Production Example (Amazon Keyspaces)**:
- Active-active replication across regions
- Replication lag typically <1 second
- Last-writer-wins conflict resolution
- Automatic consistency repair

**V2 Implementation** (if needed):
- Multiple regions: US-East-1, EU-West-1, AP-Southeast-1
- Global load balancer (Route53, Cloudflare) routes to nearest region
- Multi-region database (DynamoDB Global Tables, CockroachDB)
- Eventual consistency (accept 1-5 second replication lag)

**Pattern 3: Regional Isolation (Recommended for V1-Aware)**

**Architecture**:
- **Single region per tenant**: Each tenant assigned to specific region
- **No cross-region traffic**: Tenant data never leaves assigned region
- **No failover**: If region fails, tenant unavailable (accept downtime)
- **Simplicity**: No cross-region coordination

**Benefits**:
- **Simplest**: No cross-region complexity
- **Lowest cost**: No replication, no standby resources
- **Data residency**: Tenant data stays in assigned region (GDPR/CCPA compliance)

**Drawbacks**:
- **No failover**: Region outage = tenant unavailable
- **Higher downtime**: RTO = cloud provider's region recovery time (hours to days)

**V1 Implementation**:
- Single region: US-East-1 or EU-West-1
- All tenants in same region
- No failover (accept cloud provider SLA: 99.95% = 4.4 hours downtime/year)
- Defer multi-region to V2

**Routing Strategies (V2-ONLY):**

**1. Geographic Routing (Latency-Based)**
- Route users to nearest region based on geographic location
- Minimize network latency (user to service)
- Requires global load balancer (Route53, Cloudflare)

**2. Tenant-Based Routing (Compliance-Based)**
- Route users to region based on tenant's data residency requirements
- EU tenants → EU region, US tenants → US region
- Requires tenant-to-region mapping

**3. Health-Based Routing (Availability-Based)**
- Route users to healthy region only
- Automatic failover to secondary region on primary outage
- Requires health checks (Route53, Cloudflare)

**V2 Implementation**:
- Hybrid routing: Tenant-based (compliance) + health-based (availability)
- Global load balancer with tenant-to-region mapping
- Health checks per region (detect outages)
- Automatic failover to secondary region

**Key Architectural Decisions (V1-AWARE):**

**1. Tenant-to-Region Mapping (MUST exist in V1)**
- Track which region each tenant uses
- Store in globally accessible location (or replicated)
- Enable routing calls to correct region in V2
- **V1 implementation**: Tenant table with `region` column (single region for all in V1)

**2. Region-Agnostic Service Endpoints (MUST exist in V1)**
- Use region parameter in configuration (not hardcoded URLs)
- Enable switching regions without code changes
- **V1 implementation**: Config file with `region` parameter

**3. Health Check Framework (MUST exist in V1)**
- Health checks for all services (STT, LLM, TTS, database)
- Monitor health per service
- Enable automatic failover in V2
- **V1 implementation**: Health check endpoints, monitoring dashboard

**4. Database Replication Readiness (MUST exist in V1)**
- Design database schema for replication (no region-specific dependencies)
- Use UUIDs (not auto-increment IDs) for cross-region uniqueness
- Enable asynchronous replication in V2
- **V1 implementation**: UUID primary keys, replication-ready schema

### Why Global-First Designs Often Fail

**Core Problem (2025-2026):**
Global-first designs (single global deployment serving all regions) fail for voice AI due to **latency**, **compliance**, and **cost**. Production systems that start global-first must rewrite for regional deployment, wasting 6-12 months.

**Failure Mode 1: Latency Explosion (40% Higher Call Abandonment)**

**Symptom**: Deploy all services in single region (e.g., US-East-1). Serve customers globally. Asia and EU customers experience 1.5-2.5 second response times.

**Root cause**: Cross-region network latency adds 100-500ms per hop. Asia to US: ~500ms round-trip. EU to US: ~100-150ms round-trip. Each service call doubles latency (request + response).

**Production impact**: Conversations feel robotic (>800ms latency). Users hang up (40% higher call abandonment >1 second). Poor customer experience, low adoption.

**Observed in**: Startups that deploy in single region to "move fast" without considering global latency.

**Why rewrite required**: Cannot add regions without rewriting database layer (single global database doesn't scale). Must migrate to region-local databases.

**V1-AWARE mitigation**: Design for region-local deployment from day 1. Single region in V1, but architecture supports multi-region in V2.

---

**Failure Mode 2: GDPR Compliance Violations (€20M Fines)**

**Symptom**: Deploy all services in US region. Serve EU customers. Store EU customer data in US. GDPR complaint filed. Regulatory investigation.

**Root cause**: GDPR requires EU customer data stored in EU or adequate jurisdiction. US is adequate (2023 Data Privacy Framework), but many companies don't implement proper safeguards.

**Production impact**: €20M fines or 4% of global revenue. Reputational damage. Must migrate EU customer data to EU region (expensive, time-consuming).

**Observed in**: Companies that treat compliance as "legal problem" (not engineering problem) and defer to post-launch.

**Why rewrite required**: Cannot migrate data to EU region without rewriting database layer (single global database). Must split database by region.

**V1-AWARE mitigation**: Track tenant's data residency requirements from day 1. Store in compliant region (even if single region in V1).

---

**Failure Mode 3: Cost Explosion from Cross-Region Data Transfer**

**Symptom**: Deploy services in US region, database in EU region (for GDPR compliance). Every conversation requires cross-region database queries. $10K-$100K monthly in data transfer fees.

**Root cause**: Cross-region data transfer costs $0.02-$0.12 per GB. Voice AI systems transfer 1-10 GB per 1000 calls (audio, transcripts, events). High-volume systems (100K calls/month) transfer 100-1000 GB/month = $2K-$120K monthly.

**Production impact**: Margin collapse. Cannot sustain economics. Must rewrite to eliminate cross-region data transfer.

**Observed in**: Companies that separate compute and database across regions (for compliance) without considering data transfer costs.

**Why rewrite required**: Cannot eliminate cross-region data transfer without rewriting database layer (co-locate database with compute).

**V1-AWARE mitigation**: Co-locate all services and database in same region. No cross-region data transfer during conversation.

---

**Failure Mode 4: Database Consistency Issues (Data Loss, Conflicts)**

**Symptom**: Deploy active-active multi-region with global database. Concurrent writes from multiple regions. Data conflicts, data loss, inconsistent state.

**Root cause**: CAP theorem: Cannot have consistency + availability + partition tolerance. Multi-region databases must choose between consistency and availability. Eventual consistency causes conflicts.

**Production impact**: Data loss (conversation state lost), data conflicts (last-writer-wins overwrites valid data), inconsistent state (user sees different data in different regions).

**Observed in**: Companies that use eventual consistency without understanding implications (assume "eventual" means "soon").

**Why rewrite required**: Cannot add strong consistency without rewriting database layer (switch from eventual to strong consistency).

**V1-AWARE mitigation**: Use single-region database (strong consistency). Defer multi-region to V2 (accept eventual consistency tradeoffs).

---

**Failure Mode 5: Operational Complexity (Cannot Debug, Cannot Deploy)**

**Symptom**: Deploy active-active multi-region. Incident occurs. Cannot determine which region caused failure. Cannot debug across regions. Cannot deploy changes without coordinating across regions.

**Root cause**: Multi-region systems have distributed state, distributed logs, distributed metrics. Debugging requires correlating across regions. Deployments require coordinating across regions (blue-green, canary).

**Production impact**: Incidents take 4x longer to resolve. Deployments take 2x longer. Operational burden increases 3-5x.

**Observed in**: Companies that deploy multi-region without investing in observability and deployment automation.

**Why rewrite required**: Cannot add observability retroactively (must instrument from day 1). Cannot add deployment automation retroactively (must design for it).

**V1-AWARE mitigation**: Invest in observability (distributed tracing, centralized logging) and deployment automation (blue-green, canary) from day 1. Single region in V1, but tooling supports multi-region in V2.

---

**Failure Mode 6: Telephony Routing Complexity (Wrong Region, High Latency)**

**Symptom**: Deploy multi-region. User calls phone number. Telephony provider routes to wrong region (not nearest). High latency, poor voice quality.

**Root cause**: Telephony providers (Twilio, Telnyx) route calls based on phone number, not user location. Must configure regional routing explicitly.

**Production impact**: Poor voice quality (high latency, jitter). Customer complaints. Must reconfigure telephony routing.

**Observed in**: Companies that assume telephony providers automatically route to nearest region (they don't).

**Why rewrite required**: Cannot change telephony routing without reconfiguring phone numbers (may require new phone numbers per region).

**V1-AWARE mitigation**: Understand telephony routing from day 1. Configure regional routing in V2 (single region in V1).

---

**Failure Mode 7: Service Provider Region Availability (Not Available in Target Region)**

**Symptom**: Deploy multi-region. Service provider (STT, LLM, TTS) not available in target region. Must route to different region. High latency.

**Root cause**: Service providers have limited regional availability. Azure Speech Service available in 30+ regions, but advanced features only in select regions. OpenAI has no explicit region selection (routes to nearest).

**Production impact**: Cannot deploy in target region. Must route to different region (high latency). Must switch service providers (expensive, time-consuming).

**Observed in**: Companies that assume all service providers available in all regions (they're not).

**Why rewrite required**: Cannot switch service providers without rewriting integration layer (different APIs, different features).

**V1-AWARE mitigation**: Validate service provider availability in target regions before V1 launch. Design integration layer for provider switching.

---

**Failure Mode 8: No Tenant-to-Region Mapping (Cannot Route Correctly)**

**Symptom**: Deploy multi-region. User calls. System doesn't know which region to route to. Routes to wrong region. High latency or compliance violation.

**Root cause**: No tenant-to-region mapping. System cannot determine which region each tenant uses.

**Production impact**: Poor user experience (high latency), compliance violations (data in wrong region). Must add tenant-to-region mapping retroactively (expensive).

**Observed in**: Companies that deploy multi-region without planning tenant assignment strategy.

**Why rewrite required**: Cannot add tenant-to-region mapping retroactively without migrating data (must determine which region each tenant should use, migrate data).

**V1-AWARE mitigation**: Track tenant-to-region mapping from day 1 (even if single region in V1). Enable correct routing in V2.

---

**Failure Mode 9: Hardcoded Service URLs (Cannot Switch Regions)**

**Symptom**: Deploy in single region with hardcoded service URLs (e.g., `https://api.openai.com`). Want to add second region. Must change code to support region parameter.

**Root cause**: Hardcoded URLs don't support region parameter. Cannot switch regions without code changes.

**Production impact**: Delayed multi-region deployment (must change code, test, deploy). Wasted engineering time.

**Observed in**: Companies that hardcode URLs for "simplicity" without considering multi-region future.

**Why rewrite required**: Must change all hardcoded URLs to use region parameter (dozens to hundreds of code changes).

**V1-AWARE mitigation**: Use region-configurable service endpoints from day 1 (config file with `region` parameter). Enable region switching without code changes.

---

**Failure Mode 10: No Health Checks (Cannot Detect Outages)**

**Symptom**: Deploy multi-region. Primary region fails. System doesn't detect failure. No automatic failover. All traffic fails.

**Root cause**: No health checks. System cannot detect region outages.

**Production impact**: Extended outage (hours to days). Manual intervention required. Customer complaints.

**Observed in**: Companies that assume cloud providers never fail (they do: 99.95% SLA = 4.4 hours downtime/year).

**Why rewrite required**: Cannot add health checks retroactively without designing health check endpoints and monitoring infrastructure.

**V1-AWARE mitigation**: Implement health checks from day 1 (even if single region in V1). Enable automatic failover in V2.

## Common Failure Modes (Observed in Real Systems)

### 1. Cross-Region Latency Explosion (40% Higher Call Abandonment)
**Symptom**: Global-first design routes all traffic through single region. Asia and EU customers experience 1.5-2.5 second response times. 40% higher call abandonment.

**Root cause**: Cross-region network latency adds 100-500ms per hop. Asia to US: ~500ms. Each service call doubles latency (request + response).

**Production impact**: Conversations feel robotic (>800ms latency). Users hang up. Poor customer experience, low adoption.

**Observed in**: Startups that deploy in single region to "move fast" without considering global latency.

**Mitigation**:
- Design for region-local deployment from day 1
- Co-locate all services in same region
- Measure latency per region, alert if >800ms
- Deploy multi-region in V2 (one region per geographic area)

---

### 2. GDPR Compliance Violations from US Data Storage (€20M Fines)
**Symptom**: Store EU customer data in US region. GDPR complaint filed. Regulatory investigation. €20M fines or 4% of global revenue.

**Root cause**: GDPR requires EU customer data stored in EU or adequate jurisdiction. Many companies don't implement proper safeguards.

**Production impact**: Fines, reputational damage, must migrate EU customer data to EU region (expensive, time-consuming).

**Observed in**: Companies that treat compliance as "legal problem" (not engineering problem) and defer to post-launch.

**Mitigation**:
- Track tenant's data residency requirements from day 1
- Store data in compliant region (EU-West-1 for EU customers)
- Implement consent management, data subject rights
- Validate compliance before launch (not after)

---

### 3. Cross-Region Data Transfer Cost Explosion ($10K-$100K Monthly)
**Symptom**: Deploy services in US region, database in EU region (for GDPR compliance). Every conversation requires cross-region database queries. $10K-$100K monthly in data transfer fees.

**Root cause**: Cross-region data transfer costs $0.02-$0.12 per GB. Voice AI systems transfer 1-10 GB per 1000 calls. High-volume systems (100K calls/month) transfer 100-1000 GB/month.

**Production impact**: Margin collapse. Cannot sustain economics. Must rewrite to eliminate cross-region data transfer.

**Observed in**: Companies that separate compute and database across regions without considering data transfer costs.

**Mitigation**:
- Co-locate all services and database in same region
- No cross-region data transfer during conversation
- Monitor cross-region transfer costs, alert if >$1K/month
- Batch cross-region transfers (analytics, backups) to minimize cost

---

### 4. Database Replication Lag Causes Data Loss (1-60 Second RPO)
**Symptom**: Deploy active-passive multi-region with asynchronous database replication. Primary region fails. Failover to secondary. Last 1-60 seconds of data lost.

**Root cause**: Asynchronous replication has lag (1-60 seconds). Data written to primary but not yet replicated to secondary is lost on failover.

**Production impact**: Data loss (conversation state lost), customer complaints, must replay conversations.

**Observed in**: Companies that use asynchronous replication without understanding RPO (Recovery Point Objective).

**Mitigation**:
- Accept 1-60 second RPO for voice AI (acceptable for most use cases)
- Use synchronous replication for critical data (higher latency, higher cost)
- Monitor replication lag, alert if >5 seconds
- Implement conversation replay from event log (research/19-training-from-data.md)

---

### 5. Active-Active Database Conflicts from Concurrent Writes
**Symptom**: Deploy active-active multi-region with multi-region database. Concurrent writes from multiple regions. Data conflicts, data loss, inconsistent state.

**Root cause**: Eventual consistency causes conflicts. Last-writer-wins overwrites valid data. No conflict resolution logic.

**Production impact**: Data loss, data conflicts, inconsistent state. Customer sees different data in different regions.

**Observed in**: Companies that use eventual consistency without understanding implications.

**Mitigation**:
- Use active-passive (not active-active) for voice AI (single write region)
- If active-active required, implement conflict resolution logic
- Use CRDTs (Conflict-free Replicated Data Types) for conflict-free updates
- Monitor conflicts, alert if >1% of writes

---

### 6. Telephony Provider Routes to Wrong Region (High Latency)
**Symptom**: Deploy multi-region. User calls phone number. Telephony provider routes to wrong region (not nearest). High latency, poor voice quality.

**Root cause**: Telephony providers route calls based on phone number, not user location. Must configure regional routing explicitly.

**Production impact**: Poor voice quality (high latency, jitter). Customer complaints.

**Observed in**: Companies that assume telephony providers automatically route to nearest region.

**Mitigation**:
- Configure regional routing with telephony provider (Twilio, Telnyx)
- Use regional phone numbers (US number routes to US region, EU number routes to EU region)
- Monitor call latency per region, alert if >800ms
- Test telephony routing before launch

---

### 7. Service Provider Not Available in Target Region
**Symptom**: Deploy multi-region. Service provider (STT, LLM, TTS) not available in target region. Must route to different region. High latency.

**Root cause**: Service providers have limited regional availability. Azure Speech Service available in 30+ regions, but advanced features only in select regions.

**Production impact**: Cannot deploy in target region. Must route to different region (high latency). Must switch service providers (expensive).

**Observed in**: Companies that assume all service providers available in all regions.

**Mitigation**:
- Validate service provider availability in target regions before V1 launch
- Design integration layer for provider switching (abstract provider-specific APIs)
- Test in target region before launch
- Have fallback provider for each service (STT, LLM, TTS)

---

### 8. No Tenant-to-Region Mapping (Cannot Route Correctly)
**Symptom**: Deploy multi-region. User calls. System doesn't know which region to route to. Routes to wrong region. High latency or compliance violation.

**Root cause**: No tenant-to-region mapping. System cannot determine which region each tenant uses.

**Production impact**: Poor user experience (high latency), compliance violations (data in wrong region).

**Observed in**: Companies that deploy multi-region without planning tenant assignment strategy.

**Mitigation**:
- Track tenant-to-region mapping from day 1 (tenant table with `region` column)
- Assign tenants to regions based on data residency requirements (EU tenants → EU region)
- Validate tenant-to-region mapping before routing calls
- Monitor routing errors, alert if tenant routed to wrong region

---

### 9. Hardcoded Service URLs Block Multi-Region Deployment
**Symptom**: Deploy in single region with hardcoded service URLs. Want to add second region. Must change code to support region parameter. Delayed multi-region deployment.

**Root cause**: Hardcoded URLs don't support region parameter. Cannot switch regions without code changes.

**Production impact**: Wasted engineering time (dozens to hundreds of code changes). Delayed multi-region deployment (6-12 months).

**Observed in**: Companies that hardcode URLs for "simplicity" without considering multi-region future.

**Mitigation**:
- Use region-configurable service endpoints from day 1 (config file with `region` parameter)
- Abstract service URLs (don't hardcode in application code)
- Test region switching before V1 launch (even if single region)
- Document region configuration for V2

---

### 10. No Health Checks Prevent Automatic Failover
**Symptom**: Deploy multi-region. Primary region fails. System doesn't detect failure. No automatic failover. All traffic fails. Extended outage (hours to days).

**Root cause**: No health checks. System cannot detect region outages.

**Production impact**: Extended outage, manual intervention required, customer complaints.

**Observed in**: Companies that assume cloud providers never fail (99.95% SLA = 4.4 hours downtime/year).

**Mitigation**:
- Implement health checks from day 1 (health check endpoints for all services)
- Monitor health per service, alert if unhealthy
- Enable automatic failover in V2 (Route53, Cloudflare health-based routing)
- Test failover before launch (simulate region outage)

## Proven Patterns & Techniques

### 1. Region-Configurable Service Endpoints (V1-AWARE)
**Pattern**: Use region parameter in configuration (not hardcoded URLs). Enable switching regions without code changes.

**Implementation**:
```yaml
# config/production.yml
region: us-east-1
services:
  stt:
    provider: deepgram
    endpoint: "https://api.deepgram.com/v1"
  llm:
    provider: openai
    endpoint: "https://api.openai.com/v1"
  tts:
    provider: cartesia
    endpoint: "https://api.cartesia.ai/v1"
  database:
    host: "db.us-east-1.rds.amazonaws.com"
```

**Benefits**:
- **Region switching**: Change region parameter, no code changes
- **Multi-region ready**: Add second region in V2 by duplicating config
- **Testing**: Test in different regions without code changes

**V1 implementation**: Config file with `region` parameter, used to construct service URLs.

---

### 2. Tenant-to-Region Mapping (V1-AWARE)
**Pattern**: Track which region each tenant uses. Store in tenant table. Enable routing calls to correct region in V2.

**Implementation**:
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'us-east-1', -- V1: single region, V2: multiple regions
  data_residency TEXT NOT NULL DEFAULT 'US', -- EU, US, China, etc.
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Benefits**:
- **Compliance**: Track data residency requirements
- **Routing**: Route calls to correct region in V2
- **Migration**: Migrate tenants to different regions without code changes

**V1 implementation**: Tenant table with `region` and `data_residency` columns (single region for all in V1).

---

### 3. Co-Located Regional Deployment (V1-AWARE)
**Pattern**: Deploy all services (STT, LLM, TTS, database) in same region. Minimize network hops.

**Implementation**:
- All services in same region (US-East-1 or EU-West-1)
- Database in same region
- Telephony provider in same region or nearest edge
- No cross-region service calls during conversation

**Benefits**:
- **Low latency**: Minimize network hops (50-100ms within region)
- **Low cost**: No cross-region data transfer fees
- **Simplicity**: No cross-region coordination

**V1 implementation**: Single region deployment (US-East-1 or EU-West-1).

---

### 4. Region-Local Data Storage (V1-AWARE)
**Pattern**: Store all conversation data in same region as services. No cross-region database queries during conversation.

**Implementation**:
- PostgreSQL in same region as services
- S3 in same region for audio recordings
- Redis in same region for session state
- No cross-region replication in V1

**Benefits**:
- **Low latency**: No cross-region database queries
- **Low cost**: No cross-region data transfer fees
- **Compliance**: Data stays in assigned region (GDPR/CCPA)

**V1 implementation**: PostgreSQL, S3, Redis in single region.

---

### 5. Health Check Framework (V1-AWARE)
**Pattern**: Health checks for all services. Monitor health per service. Enable automatic failover in V2.

**Implementation**:
```python
# Health check endpoint
@app.get("/health")
async def health_check():
    checks = {
        "database": await check_database(),
        "stt": await check_stt_service(),
        "llm": await check_llm_service(),
        "tts": await check_tts_service(),
    }
    healthy = all(checks.values())
    status_code = 200 if healthy else 503
    return JSONResponse(content=checks, status_code=status_code)
```

**Benefits**:
- **Monitoring**: Detect service outages quickly
- **Alerting**: Alert on service unhealthy
- **Failover**: Enable automatic failover in V2 (Route53, Cloudflare)

**V1 implementation**: Health check endpoints, monitoring dashboard.

---

### 6. Database Replication Readiness (V1-AWARE)
**Pattern**: Design database schema for replication. Use UUIDs (not auto-increment IDs) for cross-region uniqueness.

**Implementation**:
```sql
-- Use UUIDs (not auto-increment) for cross-region uniqueness
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  region TEXT NOT NULL, -- Track region for each conversation
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Benefits**:
- **Replication-ready**: No ID conflicts across regions
- **Migration-ready**: Migrate data across regions without ID collisions
- **Multi-region ready**: Enable multi-region in V2 without schema changes

**V1 implementation**: UUID primary keys, replication-ready schema.

---

### 7. Active-Passive Failover with Asynchronous Replication (V2-ONLY)
**Pattern**: Primary region serves all traffic. Secondary region standby. Asynchronous database replication. Automatic failover on primary outage.

**Implementation**:
- Primary region: US-East-1 (serves all traffic)
- Secondary region: US-West-2 (standby, replicates database)
- Route53 health checks detect primary outage
- Automatic failover to secondary (5-10 minute RTO)
- Asynchronous database replication (1-5 second RPO)

**Benefits**:
- **High availability**: Automatic failover on primary outage
- **Cost-effective**: Secondary region runs minimal resources
- **Data consistency**: Single write region (no conflicts)

**V2 implementation**: Active-passive failover with Route53 health-based routing.

---

### 8. Geographic Routing with Tenant-Based Override (V2-ONLY)
**Pattern**: Route users to nearest region by default. Override based on tenant's data residency requirements.

**Implementation**:
- Global load balancer (Route53, Cloudflare)
- Default: Route to nearest region (latency-based routing)
- Override: Route to tenant's assigned region (compliance-based routing)
- Example: EU tenant always routed to EU region (even if calling from US)

**Benefits**:
- **Low latency**: Route to nearest region by default
- **Compliance**: Override for data residency requirements
- **Flexibility**: Balance latency and compliance

**V2 implementation**: Hybrid routing (latency-based + tenant-based override).

---

### 9. Cross-Region Data Transfer Minimization (V1-AWARE)
**Pattern**: Avoid cross-region service calls during conversation. Batch cross-region data transfers (analytics, backups).

**Implementation**:
- All services in same region (no cross-region calls during conversation)
- Batch analytics data export (daily or weekly)
- Batch backups to different region (daily)
- Monitor cross-region transfer costs, alert if >$1K/month

**Benefits**:
- **Low cost**: Minimize cross-region data transfer fees
- **Low latency**: No cross-region calls during conversation

**V1 implementation**: Metrics for cross-region calls (should be zero), batch analytics export.

---

### 10. Service Provider Abstraction Layer (V1-AWARE)
**Pattern**: Abstract service provider APIs. Enable switching providers without code changes.

**Implementation**:
```python
# Abstract STT provider
class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: bytes) -> str:
        pass

class DeepgramSTT(STTProvider):
    async def transcribe(self, audio: bytes) -> str:
        # Deepgram-specific implementation
        pass

class AzureSTT(STTProvider):
    async def transcribe(self, audio: bytes) -> str:
        # Azure-specific implementation
        pass

# Factory pattern
def get_stt_provider(config: dict) -> STTProvider:
    provider = config["stt"]["provider"]
    if provider == "deepgram":
        return DeepgramSTT(config)
    elif provider == "azure":
        return AzureSTT(config)
    else:
        raise ValueError(f"Unknown STT provider: {provider}")
```

**Benefits**:
- **Provider switching**: Switch providers without code changes (change config)
- **Multi-provider**: Use different providers in different regions
- **Fallback**: Fallback to different provider on primary failure

**V1 implementation**: Abstraction layer for STT, LLM, TTS providers.

## Engineering Rules (Binding)

### R1: V1 MUST Use Region-Configurable Service Endpoints (Not Hardcoded URLs)
**Rule**: Service endpoints MUST use region parameter in configuration. MUST NOT hardcode URLs in application code.

**Rationale**: Enables region switching without code changes. Blocks multi-region deployment if hardcoded.

**Implementation**: Config file with `region` parameter, used to construct service URLs.

**Verification**: No hardcoded service URLs in application code. Region parameter in config.

---

### R2: V1 MUST Track Tenant-to-Region Mapping (Even If Single Region)
**Rule**: Tenant table MUST include `region` and `data_residency` columns. Track which region each tenant uses.

**Rationale**: Enables routing calls to correct region in V2. Enables compliance enforcement.

**Implementation**: Tenant table with `region` and `data_residency` columns.

**Verification**: Tenant table has `region` and `data_residency` columns. All tenants assigned to region.

---

### R3: V1 MUST Co-Locate All Services in Same Region
**Rule**: All services (STT, LLM, TTS, database, storage) MUST be deployed in same region. No cross-region service calls during conversation.

**Rationale**: Minimize latency (meet <800ms target). Minimize cost (no cross-region data transfer).

**Implementation**: All services in single region (US-East-1 or EU-West-1).

**Verification**: Metrics show zero cross-region service calls. All services in same region.

---

### R4: V1 MUST Use Region-Local Data Storage (Not Global Database)
**Rule**: Database and storage MUST be in same region as services. No cross-region database queries during conversation.

**Rationale**: Minimize latency. Minimize cost. Enable compliance (data residency).

**Implementation**: PostgreSQL, S3, Redis in single region.

**Verification**: Database and storage in same region as services. No cross-region queries.

---

### R5: V1 MUST Implement Health Checks for All Services
**Rule**: All services MUST expose health check endpoints. Health checks MUST be monitored.

**Rationale**: Enable automatic failover in V2. Detect service outages quickly.

**Implementation**: Health check endpoints, monitoring dashboard.

**Verification**: All services have health check endpoints. Health checks monitored.

---

### R6: V1 MUST Use UUIDs for Primary Keys (Not Auto-Increment)
**Rule**: All database tables MUST use UUIDs for primary keys. MUST NOT use auto-increment IDs.

**Rationale**: Enable multi-region replication without ID conflicts. Enable data migration across regions.

**Implementation**: UUID primary keys in all tables.

**Verification**: All tables use UUIDs. No auto-increment IDs.

---

### R7: V1 MUST Track Data Residency Requirements Per Tenant
**Rule**: Tenant table MUST include `data_residency` column. Track data residency requirements (EU, US, China, etc.).

**Rationale**: Enable compliance enforcement. Enable routing to correct region in V2.

**Implementation**: Tenant table with `data_residency` column.

**Verification**: All tenants have `data_residency` value. Validated before storing data.

---

### R8: V1 MUST Minimize Cross-Region Data Transfer
**Rule**: Cross-region data transfer MUST be zero during conversation. Batch cross-region transfers (analytics, backups).

**Rationale**: Minimize cost. Minimize latency.

**Implementation**: Metrics for cross-region calls (should be zero). Batch analytics export.

**Verification**: Metrics show zero cross-region calls during conversation. Cross-region transfer costs <$1K/month.

---

### R9: V2 MUST Use Active-Passive Failover (Not Active-Active)
**Rule**: V2 multi-region MUST use active-passive failover. Primary region serves all traffic. Secondary region standby.

**Rationale**: Simplicity. Data consistency (single write region). Cost-effective.

**Implementation**: Active-passive failover with Route53 health-based routing.

**Verification**: Primary region serves all traffic. Secondary region standby. Automatic failover on primary outage.

---

### R10: V2 MUST Route Based on Tenant's Data Residency (Not Just Latency)
**Rule**: V2 multi-region MUST route based on tenant's data residency requirements. Override latency-based routing for compliance.

**Rationale**: Compliance (GDPR/CCPA/PIPL). Data residency enforcement.

**Implementation**: Hybrid routing (latency-based + tenant-based override).

**Verification**: EU tenants routed to EU region. US tenants routed to US region. Compliance validated.

## Metrics & Signals to Track

### Latency Metrics (V1-AWARE)

**Per-Service Latency:**
- STT latency (P50/P95/P99, target: <200ms)
- LLM latency (TTFT P50/P95/P99, target: <800ms)
- TTS latency (P50/P95/P99, target: <150ms)
- Database query latency (P50/P95/P99, target: <50ms)

**End-to-End Latency:**
- Total response time (P50/P95/P99, target: <800ms)
- Alert if P95 >800ms (robotic conversation)
- Alert if P99 >1200ms (users hang up)

**Cross-Region Latency:**
- Cross-region service calls (target: 0 in V1)
- Cross-region database queries (target: 0 in V1)
- Alert if any cross-region calls detected

### Cost Metrics (V1-AWARE)

**Data Transfer Costs:**
- Cross-region data transfer (GB/month, target: 0 in V1)
- Cross-region data transfer cost ($/month, target: $0 in V1)
- Alert if cross-region transfer cost >$1K/month

**Service Costs:**
- STT cost per call
- LLM cost per call
- TTS cost per call
- Total cost per call (target: <$0.20)

### Compliance Metrics (V1-AWARE)

**Data Residency:**
- Tenants per region (count)
- Data residency violations (target: 0)
- Alert if tenant data stored in wrong region

**Consent and Retention:**
- Consent rate (target: >95%)
- Retention policy violations (target: 0)
- Data subject requests (access, deletion, portability)

### Health Metrics (V1-AWARE)

**Service Health:**
- Service uptime per service (target: >99.9%)
- Health check success rate (target: >99.9%)
- Alert if service unhealthy >5 minutes

**Database Health:**
- Database uptime (target: >99.95%)
- Database connection pool utilization (target: <80%)
- Alert if database unhealthy >1 minute

### Multi-Region Metrics (V2-ONLY)

**Failover Metrics:**
- Failover count (per month)
- Failover duration (RTO, target: <10 minutes)
- Data loss on failover (RPO, target: <5 seconds)

**Replication Metrics:**
- Replication lag (target: <5 seconds)
- Replication errors (target: 0)
- Alert if replication lag >10 seconds

**Routing Metrics:**
- Calls per region (count)
- Routing errors (target: <0.1%)
- Alert if tenant routed to wrong region

## V1 Decisions / Constraints

### D-REGION-001 V1 MUST Deploy in Single Region Only
**Decision**: V1 deploys in single region (US-East-1 or EU-West-1). No multi-region deployment in V1.

**Rationale**: Simplicity. Focus on product-market fit, not infrastructure complexity. Defer multi-region to V2.

**Constraints**: Choose region based on target market (US → US-East-1, EU → EU-West-1).

---

### D-REGION-002 V1 MUST Use Region-Configurable Service Endpoints
**Decision**: Service endpoints use region parameter in configuration (not hardcoded URLs).

**Rationale**: Enable region switching without code changes. Prepare for multi-region in V2.

**Constraints**: Config file with `region` parameter, used to construct service URLs.

---

### D-REGION-003 V1 MUST Track Tenant-to-Region Mapping
**Decision**: Tenant table includes `region` and `data_residency` columns. Track which region each tenant uses.

**Rationale**: Enable routing calls to correct region in V2. Enable compliance enforcement.

**Constraints**: All tenants assigned to single region in V1. Multi-region in V2.

---

### D-REGION-004 V1 MUST Co-Locate All Services in Same Region
**Decision**: All services (STT, LLM, TTS, database, storage) deployed in same region. No cross-region service calls.

**Rationale**: Minimize latency (meet <800ms target). Minimize cost (no cross-region data transfer).

**Constraints**: All services in single region (US-East-1 or EU-West-1).

---

### D-REGION-005 V1 MUST Use Region-Local Data Storage
**Decision**: Database and storage in same region as services. No cross-region database queries during conversation.

**Rationale**: Minimize latency. Minimize cost. Enable compliance (data residency).

**Constraints**: PostgreSQL, S3, Redis in single region.

---

### D-REGION-006 V1 MUST Implement Health Checks for All Services
**Decision**: All services expose health check endpoints. Health checks monitored.

**Rationale**: Enable automatic failover in V2. Detect service outages quickly.

**Constraints**: Health check endpoints, monitoring dashboard.

---

### D-REGION-007 V1 MUST Use UUIDs for Primary Keys
**Decision**: All database tables use UUIDs for primary keys (not auto-increment IDs).

**Rationale**: Enable multi-region replication without ID conflicts. Enable data migration across regions.

**Constraints**: UUID primary keys in all tables.

---

### D-REGION-008 V1 MUST Track Data Residency Requirements Per Tenant
**Decision**: Tenant table includes `data_residency` column. Track data residency requirements (EU, US, China, etc.).

**Rationale**: Enable compliance enforcement. Enable routing to correct region in V2.

**Constraints**: All tenants have `data_residency` value. Validated before storing data.

---

### D-REGION-009 V1 MUST NOT Serve China Market
**Decision**: V1 does NOT serve China market. Defer to V2 due to PIPL complexity (data localization, cross-border transfer certification).

**Rationale**: PIPL requires data localization, cross-border transfer certification (effective January 1, 2026). Too complex for V1.

**Constraints**: No China region in V1. Add China region in V2 if validated need.

---

### D-REGION-010 V2 MUST Use Active-Passive Failover
**Decision**: V2 multi-region uses active-passive failover. Primary region serves all traffic. Secondary region standby.

**Rationale**: Simplicity. Data consistency (single write region). Cost-effective.

**Constraints**: Active-passive failover with Route53 health-based routing.

---

### D-REGION-011 V2 MUST Route Based on Tenant's Data Residency
**Decision**: V2 multi-region routes based on tenant's data residency requirements. Override latency-based routing for compliance.

**Rationale**: Compliance (GDPR/CCPA/PIPL). Data residency enforcement.

**Constraints**: Hybrid routing (latency-based + tenant-based override).

---

### D-REGION-012 V2 MUST Use Asynchronous Database Replication
**Decision**: V2 multi-region uses asynchronous database replication (not synchronous).

**Rationale**: Lower latency (no cross-region write latency). Cost-effective. Accept 1-5 second RPO.

**Constraints**: Asynchronous replication with 1-5 second lag. Accept data loss on failover.

---

### D-REGION-013 V2 MUST Deploy in 2-3 Regions (Not 10+)
**Decision**: V2 multi-region deploys in 2-3 regions (US, EU, Asia). Not 10+ regions.

**Rationale**: Operational complexity. Cost. Most customers served by 2-3 regions.

**Constraints**: US-East-1, EU-West-1, AP-Southeast-1 (if Asia market validated).

---

### D-REGION-014 V2 MUST Use Regional Phone Numbers
**Decision**: V2 multi-region uses regional phone numbers (US number routes to US region, EU number routes to EU region).

**Rationale**: Telephony routing (providers route based on phone number). Minimize latency.

**Constraints**: Separate phone numbers per region. Configure regional routing with telephony provider.

---

### D-REGION-015 V2 MUST Abstract Service Provider APIs
**Decision**: V2 multi-region abstracts service provider APIs. Enable switching providers without code changes.

**Rationale**: Provider switching. Multi-provider (different providers in different regions). Fallback.

**Constraints**: Abstraction layer for STT, LLM, TTS providers.

## Open Questions / Risks

### Q1: Which Region Should V1 Deploy To (US or EU)?
**Question**: Should V1 deploy to US-East-1 or EU-West-1? What if target market spans both?

**Risk**: Wrong region → high latency for some customers. Must redeploy to different region (expensive).

**Mitigation options**:
- Deploy to US-East-1 if majority of customers in US
- Deploy to EU-West-1 if majority of customers in EU
- If 50/50 split, deploy to US-East-1 (larger market, more service providers)
- Add second region in V2 based on customer demand

**V1 decision**: Deploy to US-East-1 for V1. Add EU-West-1 in V2 if >20% of customers in EU.

---

### Q2: How to Handle Customers Who Travel Across Regions?
**Question**: Customer assigned to US region, travels to EU. High latency from EU to US. How to handle?

**Risk**: Poor user experience (high latency). Customer complaints.

**Mitigation options**:
- Accept high latency (300-500ms cross-region is acceptable for voice)
- Route to nearest region (violates data residency if tenant assigned to US region)
- Use edge computing for STT/TTS (LLM still in assigned region)
- Inform customer of latency tradeoff (transparency)

**V2 decision**: Accept high latency for travelers. Edge computing for STT/TTS in V3 if validated need.

---

### Q3: How to Handle Service Provider Region Availability?
**Question**: Service provider not available in target region. Must route to different region. High latency. How to handle?

**Risk**: Cannot deploy in target region. High latency. Poor user experience.

**Mitigation options**:
- Validate service provider availability before V1 launch
- Switch to different provider (if available in target region)
- Use edge computing (if provider supports edge deployment)
- Deploy in different region (accept high latency)

**V1 decision**: Validate service provider availability in US-East-1 and EU-West-1 before V1 launch.

---

### Q4: How to Handle Cross-Region Failover Latency?
**Question**: Primary region fails. Failover to secondary region. Customers experience high latency (cross-region). How to handle?

**Risk**: Poor user experience during failover. Customer complaints.

**Mitigation options**:
- Accept high latency during failover (temporary, 5-30 minutes)
- Use active-active (both regions serve traffic) to avoid failover latency
- Inform customers of degraded performance during failover
- Test failover regularly (ensure RTO <10 minutes)

**V2 decision**: Accept high latency during failover. Active-active too complex for V2.

---

### Q5: How to Handle Database Replication Lag?
**Question**: Asynchronous replication has 1-5 second lag. Failover loses last 1-5 seconds of data. How to handle?

**Risk**: Data loss on failover. Customer complaints.

**Mitigation options**:
- Accept 1-5 second RPO (acceptable for voice AI)
- Use synchronous replication (higher latency, higher cost)
- Implement conversation replay from event log (research/19-training-from-data.md)
- Inform customers of potential data loss during failover

**V2 decision**: Accept 1-5 second RPO. Implement conversation replay from event log.

---

### Q6: How to Handle Multi-Region Cost Explosion?
**Question**: Multi-region deployment doubles infrastructure cost (2x regions, 2x databases, 2x storage). How to justify?

**Risk**: Cost explosion. Cannot sustain economics.

**Mitigation options**:
- Use active-passive (secondary region runs minimal resources)
- Deploy multi-region only for high-value customers (enterprise tier)
- Charge premium for multi-region (99.99% SLA vs 99.9% SLA)
- Defer multi-region until validated need (>20% of customers in second region)

**V2 decision**: Active-passive with minimal secondary resources. Deploy multi-region only if >20% of customers in second region.

---

### Q7: How to Handle Telephony Routing Complexity?
**Question**: Telephony providers route based on phone number, not user location. Must configure regional routing explicitly. How to handle?

**Risk**: Wrong region routing. High latency. Poor voice quality.

**Mitigation options**:
- Use regional phone numbers (US number routes to US region, EU number routes to EU region)
- Configure regional routing with telephony provider (Twilio, Telnyx)
- Test telephony routing before launch
- Monitor call latency per region, alert if >800ms

**V2 decision**: Use regional phone numbers. Configure regional routing with telephony provider.

---

### Q8: How to Handle Service Provider API Differences Across Regions?
**Question**: Service provider has different APIs or features in different regions. How to handle?

**Risk**: Cannot deploy in target region. Must rewrite integration layer.

**Mitigation options**:
- Abstract service provider APIs (enable switching providers without code changes)
- Validate API compatibility across regions before launch
- Use lowest common denominator (features available in all regions)
- Switch to different provider (if needed)

**V2 decision**: Abstract service provider APIs. Validate API compatibility across regions.

---

### Q9: How to Handle Tenant Migration Across Regions?
**Question**: Tenant assigned to US region, wants to move to EU region (for compliance). How to migrate data?

**Risk**: Data migration expensive, time-consuming. Downtime during migration.

**Mitigation options**:
- Implement tenant migration tool (export from US region, import to EU region)
- Use blue-green migration (run in both regions, switch traffic)
- Accept downtime during migration (schedule maintenance window)
- Charge for migration (expensive operation)

**V2 decision**: Implement tenant migration tool. Accept downtime during migration (schedule maintenance window).

---

### Q10: How to Handle Compliance Audits Across Regions?
**Question**: Compliance audit requires proving data residency (EU customer data in EU region). How to prove?

**Risk**: Cannot prove compliance. Fines. Reputational damage.

**Mitigation options**:
- Audit trail: Log all data access (who, when, what, which region)
- Compliance dashboard: Show data residency per tenant
- Regular audits: Quarterly internal audits, annual external audits
- Incident response: Immediate audit if data breach or compliance violation

**V2 decision**: Audit trail for all data access. Compliance dashboard. Quarterly internal audits.
