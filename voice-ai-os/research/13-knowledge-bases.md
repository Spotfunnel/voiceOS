# Research: Knowledge Bases for Real-Time Voice AI

**🟢 LOCKED** - Production-validated research based on RAG latency budgets (<100ms retrieval), semantic chunking, hybrid search, cache-first patterns, production knowledge base architectures. Updated February 2026.

---

## Why This Matters for V1

Knowledge base integration is where voice AI systems break their latency budget. Naïve RAG (retrieve-augment-generate) adds 100-300ms of retrieval latency before LLM inference even begins, pushing P95 turn latency from 600ms to 900ms—beyond the conversational threshold where users perceive awkwardness. Production teams report that RAG systems maintaining 90% retrieval precision at 100K documents degrade to 65% precision at 10M documents due to semantic drift and chunk overlap, causing the LLM to hallucinate or over-answer with irrelevant information.

The fundamental constraint: voice conversations demand sub-100ms response initiation (Time to First Audio), leaving almost no budget for knowledge retrieval. ElevenLabs reduced median RAG latency from 326ms to 155ms (50% reduction) through architectural improvements, but even 155ms consumes 31% of a 500ms turn latency budget. Query rewriting alone previously accounted for over 80% of RAG latency before optimization.

Voice AI differs fundamentally from chatbots: users cannot see "thinking..." indicators, cannot scroll through long responses, and cannot easily correct misunderstandings. A chatbot can retrieve 10 documents and present summaries; a voice agent must speak immediately with the single most relevant answer. This creates unique constraints: retrieval must be <50ms, results must be pre-ranked for voice delivery, and the LLM must be constrained from verbose explanations.

Most RAG systems fail within 90 days because teams underestimate the engineering complexity of maintaining accuracy, controlling costs, and meeting latency SLAs at scale. Context window limits create invisible ceilings—you can retrieve 50 relevant chunks but may only fit 20 before truncation, silently discarding critical evidence. Embedding costs scale non-linearly: 1M documents cost ~$20, but 100M documents cost ~$2,000 plus vector database infrastructure ($300-$1,000/month).

## What Matters in Production (Facts Only)

### Why Naïve RAG Fails in Real-Time Voice (Verified)

**Latency Breakdown (Measured):**

Standard RAG pipeline for voice:
1. **Query Embedding**: 10-100ms (depends on embedding model)
2. **Vector Search**: 20-100ms (depends on index size and algorithm)
3. **Reranking**: 50-200ms (if using cross-encoder)
4. **LLM Context Assembly**: 10-50ms (serialization and prompt construction)
5. **Total**: 90-450ms before LLM inference begins

For voice systems targeting P50 <500ms end-to-end turn latency, RAG consumes 18-90% of the entire budget before generating any response. This is unacceptable for conversational quality.

**ElevenLabs Production Optimization (Verified 2024-2025):**
- Baseline RAG latency: 326ms median
- Optimized RAG latency: 155ms median (50% reduction)
- Key technique: "Model racing" - send queries to multiple models in parallel with 1-second fallback to raw message
- Query rewriting optimization: Previously 80%+ of latency, now parallelized

**Retrieval Timing Attacks (Verified Failure Mode):**
Generation starts before retrieval completes. LLM begins speaking with incomplete context, then must awkwardly incorporate late-arriving information or ignore it entirely. Users hear hesitation, self-correction, or contradictory statements.

**Context Window Ceiling (Verified Constraint):**
Can retrieve 50 relevant chunks but only fit 20 before hitting token limits. System silently discards chunks 21-50, potentially losing critical information. No feedback to user that knowledge was incomplete.

**Semantic Drift at Scale (Verified, Production Data):**
Systems maintaining 90% precision at 100K documents degrade to 65% at 10M documents. Causes:
- Chunk overlap creates duplicate or near-duplicate results
- Semantic similarity becomes less discriminative at scale
- Vector search returns plausible-but-wrong results
- Reranking cannot recover from poor initial retrieval

### Production Knowledge Access Patterns (Verified)

**Pattern 1: Pre-Loaded Static Knowledge (Most Common)**

**Approach:** Load entire knowledge base into LLM system prompt at agent initialization.

**When Used:**
- Small knowledge bases (<10K tokens, ~7,500 words)
- Static information (product specs, company policies, FAQ)
- Information that doesn't change during calls

**Latency Impact:** Zero during calls (loaded once at startup)

**Cost Impact:** High per-call cost due to repeated prompt tokens, mitigated by provider prompt caching (50-90% cost reduction for cached tokens)

**Example Use Cases:**
- Restaurant menu and hours
- Product specifications and pricing
- Company policies and procedures
- Common FAQ responses

**Verified Implementation:**
- OpenAI/Anthropic prompt caching: Cache static system prompts and documentation
- Per D-MS-004: Enable provider prompt caching for all repeated system prompts and static documentation
- Cached tokens reduce cost by 50-90% depending on provider

**Limitations:**
- Maximum ~10K tokens before degrading LLM performance
- Cannot handle frequently changing information
- No freshness updates without redeploying agent

**Pattern 2: Semantic Caching for Repeated Queries (Verified)**

**Approach:** Cache LLM responses for semantically similar queries using vector similarity.

**When Used:**
- High query repetition (IT help, customer support, FAQ)
- Acceptable response staleness (minutes to hours)
- Cost/latency more important than freshness

**Latency Impact:** 88% reduction in end-to-end query processing (measured)

**Cost Impact:** 20-68% reduction in LLM API calls (measured production data)
- Cache hit rates: 61.6-68.8% in production systems
- AWS experiments: up to 86% cost reduction
- Early testing: ~20% cache hit rates at 99% accuracy for Q&A

**Architecture:**
1. Generate embedding for user query (10-50ms)
2. Search vector cache for similar queries (10-30ms)
3. If similarity >threshold (e.g., 0.95): Return cached response (total: 20-80ms)
4. If similarity <threshold: Perform full RAG + LLM inference, cache result

**Verified Implementation:**
- Vector stores: FAISS, PGVector, Chroma, Elasticsearch, Redis
- Embedding models: Same as used for knowledge base (consistency required)
- Similarity threshold: 0.90-0.99 depending on accuracy requirements
- Cache TTL: Minutes to hours depending on freshness requirements

**Limitations:**
- Only works for repeated queries (20-30% of queries in typical applications)
- Stale responses for rapidly changing information
- Cache warming required for cold start performance
- Memory/storage overhead for cache

**Pattern 3: Hybrid Search with Preloaded Indexes (Verified)**

**Approach:** Combine BM25 (keyword) and vector search with preloaded indexes in memory.

**When Used:**
- Medium knowledge bases (10K-1M documents)
- Mix of exact matches (product codes, names) and semantic queries
- Latency budget allows 50-100ms retrieval

**Latency Impact:** 50-100ms for retrieval + reranking

**Accuracy Impact:** 30-40% better retrieval than vector-only or keyword-only

**Architecture (Verified Production Pattern):**
1. **Dual Indexing**: Documents indexed in both vector database and keyword engine
2. **Parallel Retrieval**: Query embedding and BM25 search run simultaneously, each returning top-k results
3. **Result Fusion**: Merge using Reciprocal Rank Fusion (RRF) or weighted linear combination
4. **Reranking**: Cross-encoder (Cohere Rerank, BGE Reranker) computes final relevance scores

**Why Both Are Needed:**
- **BM25** excels at exact matches (product names, error codes, API endpoints) but misses intent and synonyms
- **Vector search** captures user intent and semantic meaning but fails on exact matches and rare terms

**Verified Implementations:**
- Azure AI Search: Hybrid retrieval + reranking outperforms vector-only search
- PostgreSQL: pgvector + full-text search in single database
- Elasticsearch: Vector search + BM25 in unified query

**Limitations:**
- Requires maintaining two indexes (storage overhead)
- Reranking adds 50-200ms latency
- Complex to tune (weights, thresholds, top-k values)

**Pattern 4: Tool/Function Calls for Live Data (Verified)**

**Approach:** LLM invokes tools/functions to retrieve specific information on-demand.

**When Used:**
- Real-time data (account balances, order status, inventory)
- User-specific information requiring authentication
- Data too large or dynamic for pre-loading

**Latency Impact:** 100-500ms per tool call (API latency + LLM processing)

**Accuracy Impact:** High (retrieves exact current data, no hallucination risk)

**Verified Implementation:**
- OpenAI function calling: LLM returns function name + arguments, system executes, LLM incorporates result
- Anthropic tool use: Similar pattern with structured tool definitions
- Pipecat tool integration: Async tool call handling

**Voice-Specific Constraints:**
- Tool calls break conversational flow (silence while waiting for API)
- Must provide verbal feedback: "Let me check that for you..." before tool call
- Tool latency must be <300ms to avoid awkward pauses
- Fallback required if tool call fails or times out

**Limitations:**
- High latency (100-500ms per call)
- Requires reliable external APIs
- Complex error handling (timeouts, rate limits, authentication failures)
- LLM may hallucinate tool arguments if schema is ambiguous

**Pattern 5: Predictive Prefetching (Verified, Advanced)**

**Approach:** Predict likely next user queries and prefetch knowledge before user speaks.

**When Used:**
- High-value use cases where latency is critical
- Predictable conversation flows (customer service, sales)
- Budget allows speculative computation

**Latency Impact:** Negative (reduces perceived latency by 50-200ms)

**Cost Impact:** High (speculative retrievals that may not be used)

**Verified Implementation (Sierra AI, 2025):**
- Analyze conversation context to predict next user intent
- Prefetch top 3-5 likely knowledge chunks during user speech
- If prediction correct: Zero retrieval latency (already in memory)
- If prediction wrong: Fall back to standard retrieval

**Limitations:**
- High cost (wasted retrievals for incorrect predictions)
- Complex prediction logic (requires conversation understanding)
- Memory overhead (caching speculative results)
- Only works for predictable conversation flows

### Embedding Model Selection for Voice AI (Verified)

**Critical Trade-offs: Cost vs Quality vs Latency**

**Latency Bottleneck (Verified):**
Embedding API latency is a hidden bottleneck in RAG systems. Most benchmarks focus on accuracy (MTEB rankings) but ignore real-world latency. Testing revealed extreme latency differences between providers—geography impacts performance more than model architecture. Real-time query embeddings (not pre-computed document embeddings) often become the performance bottleneck.

**Cost Optimization (Verified):**
Switching from generic models (OpenAI `text-embedding-3-small`) to domain-specific embedding models can simultaneously:
- Improve retrieval precision by 30-40%
- Reduce embedding costs by 60%
- Cut query latency by 50%

**Model Options (Verified 2025):**

*Lightweight Models (Fast, Lower Quality):*
- **all-MiniLM-L6-v2**: 10-20ms embedding time, good for high-volume applications
- **EmbeddingGemma** (300M parameters): Cost-effective inference on H100 MIG GPUs
- Use case: High query volume, latency-critical, acceptable quality trade-off

*Balanced Models (Medium Speed, Good Quality):*
- **OpenAI text-embedding-3-small**: 30-50ms API latency, good general-purpose quality
- **Cohere embed-english-v3.0**: Similar latency and quality
- Use case: General-purpose voice applications, moderate query volume

*High-Quality Models (Slower, Best Quality):*
- **OpenAI text-embedding-3-large**: 50-100ms API latency, best accuracy
- **Qwen3 8B Embedding**: All-around performance for self-hosted
- Use case: High-value queries, quality more important than latency

*Domain-Specific Models (Specialized):*
- **Nomic Embed Code**: Optimized for code search
- **Nomic Embed Medical**: Optimized for medical terminology
- Use case: Domain-specific knowledge bases where generic models fail

**Voice AI Recommendation (Based on Evidence):**
Use lightweight models (all-MiniLM-L6-v2) for real-time query embedding to stay within 10-20ms latency budget. Pre-compute document embeddings offline with higher-quality models (OpenAI text-embedding-3-large) for better retrieval accuracy. This asymmetric approach balances latency and quality.

### Chunking Strategies for Voice AI (Verified)

**Standard Chunking Approaches:**

*Fixed-Size Chunking:*
- 200-500 tokens per chunk with 10-20% overlap
- Default: 300 tokens (AWS Bedrock default)
- Simple, fast, but loses semantic boundaries

*Hierarchical Chunking:*
- Small child chunks (100-200 tokens) for precision
- Large parent chunks (500-1000 tokens) for context
- Retrieve child chunks, replace with parent chunks during generation
- Balances precision and context

*Late Chunking (Verified 2024-2025):*
- Embed full document text first using long-context embedding models
- Apply chunking after transformer layer, before pooling
- Preserves contextual information from surrounding chunks
- Improves retrieval quality without additional training

**Voice-Specific Chunking Constraints:**

1. **Chunks Must Be Speakable:**
   - Avoid mid-sentence cuts that sound unnatural when read aloud
   - Prefer paragraph or sentence boundaries
   - Maximum 2-3 sentences per chunk for voice delivery

2. **Chunk Size Affects Response Length:**
   - Larger chunks (500+ tokens) lead to verbose LLM responses
   - Smaller chunks (100-200 tokens) lead to concise responses
   - Voice AI should use smaller chunks (150-250 tokens) to prevent over-answering

3. **Overlap Prevents Information Loss:**
   - 10-20% overlap ensures context at boundaries
   - Critical for voice where user cannot re-read

**Production Recommendation:**
Use 200-300 token chunks with 15% overlap for voice AI. Chunk at sentence boundaries. Pre-process chunks to ensure they are speakable (no mid-sentence cuts, no bullet points, no tables).

### Knowledge Freshness Without Redeployment (Verified)

**Problem Statement:**
Knowledge bases change (product updates, policy changes, new FAQ). Redeploying agents for every knowledge update is slow (minutes to hours) and risky (potential downtime).

**Verified Solutions:**

**Solution 1: Hot-Reloadable Knowledge Files (Verified Pattern)**

**Approach:** Store knowledge in external files that agents reload periodically without restarting.

**Implementation:**
- Knowledge stored in JSON/YAML files in cloud storage (S3, GCS)
- Agent polls for file changes every 60-300 seconds
- On change: Reload knowledge, update embeddings, refresh cache
- No agent restart required

**Limitations:**
- Polling interval creates staleness window (60-300 seconds)
- Reloading large knowledge bases (>10K documents) takes 10-60 seconds
- Brief performance degradation during reload (CPU spike, memory increase)

**Verified in:** Apollo GraphQL (hot reload for schema), Dapr (component hot reload)

**Solution 2: External Vector Database with Live Updates (Verified)**

**Approach:** Knowledge stored in external vector database (Pinecone, Weaviate, Qdrant) that agents query on-demand.

**Implementation:**
- Documents indexed in vector database
- Agents query database for each retrieval (no local cache)
- Knowledge updates are immediate (update database, agents see new data on next query)
- No agent restart or reload required

**Limitations:**
- Higher latency (network round-trip to database: 10-50ms)
- Database becomes single point of failure
- Database costs scale with query volume

**Verified in:** Production RAG systems using Pinecone, Weaviate, Qdrant

**Solution 3: Semantic Cache Invalidation (Verified)**

**Approach:** Cached responses are invalidated when underlying knowledge changes.

**Implementation:**
- Track which knowledge chunks contributed to each cached response
- On knowledge update: Invalidate all cached responses that used updated chunks
- Next query retrieves fresh knowledge and caches new response

**Limitations:**
- Complex cache invalidation logic (tracking chunk dependencies)
- Potential cache stampede (many invalidations simultaneously)
- Requires versioning of knowledge chunks

**Verified in:** Production semantic caching systems (AWS ElastiCache, Azure Redis)

**Solution 4: Runtime Configuration Injection (Verified)**

**Approach:** Inject knowledge into agent system prompt at session start, not at build time.

**Implementation:**
- Agent template has placeholder variables: `{{PRODUCT_CATALOG}}`, `{{FAQ}}`
- At session start: Fetch latest knowledge from database, inject into placeholders
- Each session gets fresh knowledge without redeploying agent

**Limitations:**
- Only works for small knowledge bases (<10K tokens)
- Session startup latency increases (fetch + inject: 100-500ms)
- No benefit for long-running sessions (knowledge stale after hours)

**Verified in:** Amazon Bedrock (placeholder variables), Microsoft Teams Copilot (dynamic prompt templates), ElevenLabs (dynamic variables)

### Preventing LLM Over-Answering and Guessing (Verified)

**Problem Statement:**
LLMs tend to be helpful to a fault: they answer questions even when knowledge is insufficient, guess when uncertain, and provide verbose explanations that waste time in voice conversations.

**Verified Mitigation Strategies:**

**Strategy 1: Explicit Uncertainty Instructions (Verified)**

**Approach:** System prompt instructs LLM to say "I don't know" when uncertain.

**Example Prompt Pattern:**
```
If you are not confident in your answer based on the provided knowledge, 
say "I don't have that information" and offer to transfer to a human agent.
Do NOT guess or make up information.
```

**Effectiveness:** Partial. LLMs still hallucinate ~10-20% of the time despite instructions.

**Limitation:** Prompt-only solution, not reliable for critical applications.

**Strategy 2: Confidence Scoring with Rejection (Verified)**

**Approach:** Use retrieval confidence scores to reject low-confidence queries.

**Implementation:**
1. Retrieve top-k documents with similarity scores
2. If top document similarity <threshold (e.g., 0.7): Reject query, respond "I don't have information about that"
3. If top document similarity ≥threshold: Proceed with LLM generation

**Effectiveness:** High. Prevents LLM from seeing irrelevant context.

**Verified in:** Production RAG systems with confidence gating (similar to D-ST-005 for STT confidence)

**Strategy 3: Constrained Decoding with Answer Extraction (Verified)**

**Approach:** Force LLM to extract answer from provided context only, not generate from parametric knowledge.

**Implementation:**
- Use extractive QA models (BERT-based) instead of generative models
- Or: Instruct generative model to quote source text
- Or: Use structured output format that requires source citation

**Effectiveness:** High for factual queries, poor for conversational queries.

**Limitation:** Extractive models produce awkward voice responses (direct quotes, not natural speech).

**Strategy 4: Response Length Constraints (Verified for Voice)**

**Approach:** Limit LLM response length to prevent verbose explanations.

**Implementation:**
- Set `max_tokens` parameter (e.g., 100-150 tokens for voice)
- System prompt: "Keep responses under 30 words. Be concise."
- Post-processing: Truncate responses at sentence boundary if too long

**Effectiveness:** High for controlling verbosity, but may cut off important information.

**Voice-Specific Constraint:** Responses >30 seconds (200-250 tokens) lose user attention. Target 10-20 seconds (60-120 tokens) for voice responses.

**Strategy 5: Tool Call Gating (Verified)**

**Approach:** Require LLM to call tool/function for specific information types instead of answering from knowledge.

**Implementation:**
- Define tools for: account lookups, order status, inventory checks
- System prompt: "For account information, you MUST call the get_account_info tool. Do NOT answer from memory."
- Validate tool calls before execution

**Effectiveness:** High for structured data, prevents hallucination of user-specific information.

**Limitation:** Adds latency (100-500ms per tool call).

### What Knowledge Must Never Be Queried Live (Verified)

**Category 1: User-Specific Authenticated Data**

**Examples:** Account balances, order history, personal information, medical records

**Why Not Live RAG:** 
- Requires authentication and authorization (100-300ms)
- Privacy/security risk if retrieved for wrong user
- Must be fetched from authoritative source (database), not vector search

**Correct Approach:** Tool/function calls with explicit authentication

**Category 2: Real-Time Dynamic Data**

**Examples:** Stock prices, inventory levels, flight status, weather

**Why Not Live RAG:**
- Vector database is stale (minutes to hours behind)
- Incorrect information is worse than no information
- User expects current data, not cached data

**Correct Approach:** Tool/function calls to live APIs

**Category 3: Large Unstructured Documents**

**Examples:** Full product manuals (100+ pages), legal documents, technical specifications

**Why Not Live RAG:**
- Retrieval returns partial chunks, user needs full context
- LLM cannot summarize 100-page document in <1s
- Voice delivery of long content is impractical

**Correct Approach:** Provide document link/email, don't attempt voice delivery

**Category 4: Multi-Step Reasoning Over Knowledge**

**Examples:** "Compare features of products A, B, and C", "What's the cheapest option that meets requirements X, Y, Z?"

**Why Not Live RAG:**
- Requires multiple retrievals (one per product/option)
- LLM must reason over combined information
- Latency compounds (3 retrievals × 100ms = 300ms before LLM even starts)

**Correct Approach:** Pre-compute comparisons, store as structured data, or use tool calls

**Category 5: Knowledge Requiring External Validation**

**Examples:** Medical advice, legal advice, financial advice

**Why Not Live RAG:**
- Liability risk if LLM hallucinates or misinterprets
- Regulatory requirements for human review
- User safety depends on accuracy

**Correct Approach:** Transfer to human expert, don't attempt automated response

### Voice vs Chatbot Knowledge Strategies (Verified Differences)

**Difference 1: Latency Budget**

*Chatbot:* 1-3 seconds acceptable (user sees "typing..." indicator)
*Voice:* <500ms required (silence is awkward)

**Impact:** Voice cannot use complex retrieval (reranking, multi-hop reasoning). Must use simpler, faster retrieval with pre-indexed data.

**Difference 2: Response Length**

*Chatbot:* 200-500 tokens acceptable (user can scroll, skim)
*Voice:* 60-120 tokens maximum (user cannot skip, must listen to everything)

**Impact:** Voice must retrieve fewer, more precise chunks. Cannot present multiple options or long explanations.

**Difference 3: Error Recovery**

*Chatbot:* User can re-read, copy-paste, click links
*Voice:* User must ask again, cannot review previous response

**Impact:** Voice must be more accurate on first attempt. Cannot rely on user self-correction.

**Difference 4: Context Presentation**

*Chatbot:* Can show source citations, confidence scores, alternative answers
*Voice:* Must speak single answer with high confidence

**Impact:** Voice must use higher confidence thresholds (0.8-0.9 vs 0.6-0.7 for chatbot). Reject more queries as "I don't know."

**Difference 5: Knowledge Freshness Expectations**

*Chatbot:* User may accept "as of [date]" disclaimers
*Voice:* User expects current information without caveats

**Impact:** Voice requires more frequent knowledge updates or tool calls for dynamic data.

**Difference 6: Multimodal Fallback**

*Chatbot:* Can send images, links, documents when voice explanation is insufficient
*Voice:* Limited to audio-only (or SMS/email fallback)

**Impact:** Voice must avoid knowledge that requires visual presentation (charts, diagrams, tables).

## Common Failure Modes (Observed in Real Systems)

### Failure Mode 1: RAG Latency Spikes Break Conversational Flow

**Symptom:** User finishes speaking, 1-2 seconds of silence, then agent responds.

**Root Cause:** 
- Vector search takes 200-400ms (large index, slow algorithm)
- Reranking adds 100-200ms
- Total retrieval: 300-600ms before LLM inference

**Impact:** User perceives agent as slow, unresponsive, or "thinking too hard."

**Example:** 
- User: "What's your return policy?"
- [800ms silence]
- Agent: "Our return policy is..."

**Prevention:**
- Use approximate nearest neighbor algorithms (FAISS, HNSW) for <50ms search
- Preload indexes into memory (avoid disk I/O)
- Skip reranking for voice (trade accuracy for latency)
- Use semantic caching for common queries

### Failure Mode 2: LLM Hallucinates When Retrieval Returns Irrelevant Results

**Symptom:** Agent provides confident but incorrect information.

**Root Cause:**
- Vector search returns low-similarity results (score <0.7)
- LLM attempts to answer anyway, using parametric knowledge or guessing
- No confidence gating to reject low-quality retrievals

**Impact:** User receives wrong information, loses trust in agent.

**Example:**
- User: "Do you offer financing for purchases over $5000?"
- Retrieval: Returns generic payment information (similarity: 0.62)
- Agent: "Yes, we offer financing for all purchases over $1000" [hallucinated threshold]

**Prevention:**
- Implement confidence gating: Reject retrievals with similarity <0.75
- Explicit uncertainty instructions in system prompt
- Tool calls for critical information (don't rely on RAG)

### Failure Mode 3: Context Window Overflow Silently Truncates Knowledge

**Symptom:** Agent says "I don't have information about X" when knowledge exists.

**Root Cause:**
- Retrieved 50 chunks (10K tokens)
- LLM context window: 8K tokens
- System prompt + conversation history: 3K tokens
- Available for retrieved knowledge: 5K tokens (only 25 chunks fit)
- Chunks 26-50 silently discarded, may contain answer

**Impact:** Agent appears ignorant despite having relevant knowledge.

**Example:**
- User: "What's the warranty on Product Z?"
- Retrieval: Returns 50 product documents, Product Z is in chunk 37
- Context overflow: Chunk 37 discarded
- Agent: "I don't have information about Product Z warranty"

**Prevention:**
- Limit retrieval to top-k chunks that fit in context (e.g., k=10-20)
- Prioritize recent conversation context over retrieved knowledge
- Monitor context window usage, alert when approaching limits

### Failure Mode 4: Knowledge Staleness Causes Incorrect Responses

**Symptom:** Agent provides outdated information (old prices, discontinued products, expired policies).

**Root Cause:**
- Knowledge base updated (new product launched, price changed)
- Vector database not reindexed
- Semantic cache contains stale responses
- Agent continues using old knowledge

**Impact:** User receives incorrect information, may make decisions based on outdated data.

**Example:**
- Product price changed from $99 to $79 (sale)
- Vector database still has old price
- Agent: "That product costs $99" [user sees $79 on website, loses trust]

**Prevention:**
- Implement knowledge update pipeline (detect changes, reindex, invalidate cache)
- Use tool calls for dynamic data (prices, inventory, status)
- Add "last updated" timestamp to knowledge chunks, filter old chunks
- Set cache TTL based on knowledge freshness requirements (minutes to hours)

### Failure Mode 5: Verbose Responses Lose User Attention

**Symptom:** Agent provides long, detailed explanations that users interrupt or ignore.

**Root Cause:**
- Retrieved chunks are large (500+ tokens)
- LLM generates comprehensive response (200+ tokens, 30+ seconds)
- User loses attention after 15-20 seconds

**Impact:** User interrupts mid-response, agent must restart, conversation becomes inefficient.

**Example:**
- User: "What's your return policy?"
- Agent: "Our return policy allows returns within 30 days of purchase. Items must be in original condition with tags attached. Refunds are processed within 5-7 business days. Shipping costs are non-refundable unless the item is defective. For defective items, we provide a prepaid return label..." [user interrupts after 15 seconds]

**Prevention:**
- Limit response length: max_tokens=100-150 (60-90 tokens target)
- Use smaller chunks (150-250 tokens) for retrieval
- System prompt: "Keep responses under 20 seconds. Be concise."
- Offer follow-up: "Would you like more details?"

### Failure Mode 6: Retrieval Timing Attack (Generation Before Retrieval)

**Symptom:** Agent starts speaking, then pauses awkwardly, then continues with different information.

**Root Cause:**
- LLM streaming begins before retrieval completes
- First tokens generated without retrieved context
- Retrieval completes mid-generation, context injected
- LLM must incorporate new information mid-response

**Impact:** Agent sounds uncertain, self-corrects, or provides contradictory information.

**Example:**
- User: "What's the warranty on Product X?"
- Agent: "I'm not sure about the warranty on Product X... [retrieval completes] ...actually, Product X has a 2-year warranty."

**Prevention:**
- Block LLM generation until retrieval completes (wait for all context)
- Or: Use predictive prefetching to retrieve during user speech
- Monitor retrieval latency, alert if exceeds threshold (e.g., 100ms)

### Failure Mode 7: Embedding Model Mismatch Degrades Retrieval

**Symptom:** Retrieval returns irrelevant results despite relevant documents existing in knowledge base.

**Root Cause:**
- Documents embedded with model A (e.g., OpenAI text-embedding-3-small)
- Queries embedded with model B (e.g., all-MiniLM-L6-v2)
- Embedding spaces are incompatible, similarity scores meaningless

**Impact:** Retrieval fails, agent cannot answer questions despite having knowledge.

**Example:**
- Knowledge base embedded with OpenAI model (768 dimensions)
- Query embedded with MiniLM model (384 dimensions)
- Similarity search returns random results

**Prevention:**
- Use same embedding model for documents and queries
- Version embedding model in metadata, detect mismatches
- Reindex knowledge base if changing embedding model

### Failure Mode 8: Cost Explosion from Repeated Embeddings

**Symptom:** Embedding API costs exceed LLM costs.

**Root Cause:**
- Every user query generates embedding (10-50ms, $0.0001-0.001 per query)
- High query volume (1000s per hour)
- No caching of query embeddings

**Impact:** Unexpected cost overruns, budget exceeded.

**Example:**
- 10,000 queries/hour × $0.0005 per embedding = $5/hour = $120/day = $3,600/month
- LLM costs: $1,000/month
- Embedding costs exceed LLM costs by 3.6×

**Prevention:**
- Cache query embeddings (semantic cache)
- Use lightweight embedding models for queries (all-MiniLM-L6-v2)
- Batch embeddings when possible (some providers offer discounts)
- Monitor embedding costs separately from LLM costs

### Failure Mode 9: Vector Database Becomes Single Point of Failure

**Symptom:** All agent calls fail when vector database is unavailable.

**Root Cause:**
- Agents query external vector database for every retrieval
- Database outage, network partition, or rate limit
- No fallback or degraded mode

**Impact:** Complete service outage, all calls fail.

**Example:**
- Pinecone experiences regional outage
- All agents cannot retrieve knowledge
- Agents respond "I don't have that information" to all queries

**Prevention:**
- Implement fallback: Local cache of common queries, pre-loaded static knowledge
- Multi-region vector database deployment
- Circuit breaker: Detect database failures, switch to degraded mode
- Monitor database health, alert on failures

### Failure Mode 10: Semantic Drift Causes Precision Degradation at Scale

**Symptom:** Retrieval precision degrades as knowledge base grows from 100K to 10M documents.

**Root Cause:**
- At small scale (100K docs): Top-10 results are highly relevant (90% precision)
- At large scale (10M docs): Top-10 results include plausible-but-wrong documents (65% precision)
- Semantic similarity becomes less discriminative at scale
- Chunk overlap creates near-duplicates

**Impact:** LLM receives irrelevant context, hallucinates or provides wrong information.

**Example:**
- 100K documents: "iPhone 15 warranty" retrieves iPhone 15 warranty doc (rank 1)
- 10M documents: "iPhone 15 warranty" retrieves iPhone 14 warranty (rank 3), iPhone 15 specs (rank 5), iPhone 15 warranty (rank 8)
- LLM conflates information from multiple iPhones

**Prevention:**
- Use hybrid search (BM25 + vector) for better precision at scale
- Implement reranking (cross-encoder) despite latency cost
- Partition knowledge base by category (products, policies, FAQ) and route queries
- Monitor retrieval precision, retrain/reindex when degradation detected

## Proven Patterns & Techniques

### Pattern 1: Tiered Knowledge Architecture (Verified)

**Approach:** Organize knowledge into tiers based on access latency and freshness requirements.

**Tier 1: Pre-Loaded Static Knowledge (Zero Latency)**
- Small, static information (<10K tokens)
- Loaded into system prompt at agent initialization
- Provider prompt caching for cost efficiency
- Examples: Company info, product specs, FAQ

**Tier 2: Semantic Cache (20-80ms Latency)**
- Frequently asked questions with cached responses
- Vector similarity search for query matching
- TTL: Minutes to hours depending on freshness
- Examples: Common queries, repeated questions

**Tier 3: Vector Database (50-150ms Latency)**
- Medium-sized, semi-static knowledge (10K-1M documents)
- Hybrid search (BM25 + vector) with preloaded indexes
- Updated hourly or daily
- Examples: Product catalog, documentation, policies

**Tier 4: Tool/Function Calls (100-500ms Latency)**
- Real-time, user-specific, or dynamic data
- Direct API calls to authoritative sources
- No caching (always fresh)
- Examples: Account balances, order status, inventory

**Benefits:**
- Optimizes latency vs freshness trade-off
- Most queries served from fast tiers (Tier 1-2)
- Expensive retrievals (Tier 3-4) only when necessary

**Implementation for Pipecat:**
- Tier 1: System prompt with prompt caching enabled
- Tier 2: Redis/Elasticsearch semantic cache
- Tier 3: Pinecone/Weaviate/Qdrant with hybrid search
- Tier 4: Pipecat tool integration with async calls

### Pattern 2: Predictive Prefetching During User Speech (Verified)

**Approach:** Analyze conversation context to predict next user query, prefetch knowledge during user speech.

**Implementation:**
1. User starts speaking (VAD detects speech start)
2. Analyze conversation context: Last 2-3 turns, current topic
3. Predict top 3-5 likely next queries (e.g., "What's the price?", "Is it in stock?", "What's the warranty?")
4. Prefetch knowledge for predicted queries in parallel with STT
5. User finishes speaking, STT completes
6. If prediction correct: Knowledge already in memory (zero retrieval latency)
7. If prediction wrong: Fall back to standard retrieval (no worse than baseline)

**Latency Impact:**
- Prediction correct (30-50% of queries): Zero retrieval latency, save 50-150ms
- Prediction wrong (50-70% of queries): Standard retrieval latency

**Cost Impact:**
- 3-5 speculative retrievals per turn
- 50-70% wasted (incorrect predictions)
- Net cost: 2-3× retrieval costs

**Trade-off:** Higher cost for lower latency. Suitable for high-value use cases where latency is critical.

**Verified in:** Sierra AI production voice systems (2025)

### Pattern 3: Hybrid Search with Lightweight Reranking (Verified)

**Approach:** Combine BM25 and vector search, use fast reranking for top-k results.

**Implementation:**
1. **Parallel Retrieval** (30-50ms):
   - BM25 search: Top-20 results
   - Vector search: Top-20 results
2. **Fusion** (5-10ms):
   - Reciprocal Rank Fusion (RRF) to merge results
   - Produces top-20 fused results
3. **Lightweight Reranking** (20-50ms):
   - Use fast cross-encoder (e.g., MiniLM-based reranker)
   - Rerank top-10 results (not all 20, to save latency)
   - Return top-3 results to LLM
4. **Total Latency:** 55-110ms (acceptable for voice)

**Benefits:**
- 30-40% better precision than vector-only or BM25-only
- Latency acceptable for voice (<100ms target)
- Handles both exact matches and semantic queries

**Alternative (Lower Latency):**
- Skip reranking, use RRF fusion only (35-60ms total)
- Trade 10-15% precision for 40-50ms latency reduction

**Verified in:** Azure AI Search, production RAG systems

### Pattern 4: Confidence Gating with Graceful Degradation (Verified)

**Approach:** Reject low-confidence retrievals, provide graceful fallback responses.

**Implementation:**
1. Retrieve top-k documents with similarity scores
2. Check top document similarity:
   - If ≥0.80: High confidence, proceed with LLM generation
   - If 0.65-0.79: Medium confidence, prefix response with "Based on available information..."
   - If <0.65: Low confidence, respond "I don't have specific information about that. Let me transfer you to someone who can help."
3. Log confidence scores for monitoring

**Thresholds (Voice-Specific):**
- Chatbot: 0.60-0.70 threshold (user can verify, lower risk)
- Voice: 0.75-0.85 threshold (user cannot verify, higher risk)

**Benefits:**
- Prevents hallucination from irrelevant context
- Maintains user trust (better to say "I don't know" than to guess)
- Provides data for improving knowledge base (log rejected queries)

**Verified in:** Production RAG systems with quality gating

### Pattern 5: Asymmetric Embedding (Fast Query, Slow Document) (Verified)

**Approach:** Use lightweight model for query embedding (latency-critical), high-quality model for document embedding (offline, not latency-critical).

**Implementation:**
- **Document Embedding (Offline):**
  - Use high-quality model: OpenAI text-embedding-3-large, Qwen3 8B
  - Embedding time: 100-500ms per document (acceptable, done offline)
  - Store embeddings in vector database
- **Query Embedding (Real-Time):**
  - Use lightweight model: all-MiniLM-L6-v2, EmbeddingGemma
  - Embedding time: 10-20ms per query (critical for latency)
  - Search against pre-computed document embeddings

**Compatibility:**
- Models must be compatible (trained on similar data)
- Test retrieval quality before production
- Monitor precision, adjust if degradation detected

**Benefits:**
- Query latency: 10-20ms (vs 50-100ms with large model)
- Document quality: High (large model captures nuance)
- Cost: Lower (lightweight model is cheaper for high-volume queries)

**Limitation:**
- Requires validation that asymmetric models maintain retrieval quality
- Not all model pairs are compatible

### Pattern 6: Pre-Computed Answers for Common Queries (Verified)

**Approach:** Pre-compute and cache answers for top 100-1000 most common queries.

**Implementation:**
1. Analyze query logs, identify top 100-1000 queries (cover 30-50% of volume)
2. Generate high-quality answers offline (human review, LLM generation, editing)
3. Store in key-value cache (Redis, DynamoDB)
4. At runtime:
   - Embed user query (10-20ms)
   - Search cache for similar query (10-30ms)
   - If match (similarity >0.95): Return pre-computed answer (total: 20-50ms)
   - If no match: Fall back to standard RAG (100-200ms)

**Benefits:**
- 30-50% of queries served in <50ms (vs 100-200ms)
- Answers are high-quality (human-reviewed)
- Consistent responses (no LLM variability)

**Maintenance:**
- Update cache monthly based on new query patterns
- Invalidate cache when underlying knowledge changes
- Monitor cache hit rate, expand cache if <30%

**Verified in:** Production semantic caching systems

### Pattern 7: Structured Knowledge with Metadata Filtering (Verified)

**Approach:** Enrich knowledge chunks with metadata, use metadata filtering to narrow search space before vector search.

**Metadata Examples:**
- Category: product, policy, FAQ, support
- Product line: iPhone, iPad, Mac, Watch
- Date: last_updated, created_at
- Language: en, es, fr, de
- Access level: public, authenticated, premium

**Implementation:**
1. User query: "What's the warranty on iPhone 15?"
2. Extract metadata from query: category=product, product_line=iPhone
3. Filter vector database: Only search chunks with matching metadata
4. Vector search on filtered subset (10-100× smaller search space)
5. Faster search (10-30ms vs 50-100ms) and higher precision

**Benefits:**
- Reduces search space, improves latency
- Improves precision (no cross-category confusion)
- Enables access control (filter by user permissions)

**Verified in:** Production vector databases (Pinecone, Weaviate, Qdrant all support metadata filtering)

### Pattern 8: Response Length Constraints for Voice (Verified)

**Approach:** Enforce strict response length limits to prevent verbose explanations.

**Implementation:**
1. **LLM Parameters:**
   - `max_tokens`: 100-150 (target: 60-90 tokens)
   - Corresponds to 10-20 seconds of speech
2. **System Prompt:**
   - "Keep responses under 20 seconds. Be concise. One key point per response."
   - "If the user needs more details, they will ask follow-up questions."
3. **Post-Processing:**
   - If response >150 tokens: Truncate at sentence boundary
   - If truncated: Append "Would you like more details?"

**Voice-Specific Targets:**
- Minimum: 20 tokens (3-5 seconds) - avoid too-short responses
- Target: 60-90 tokens (10-15 seconds) - ideal for voice
- Maximum: 150 tokens (20-25 seconds) - user attention limit

**Benefits:**
- Prevents user interruptions (long responses lose attention)
- Reduces TTS costs (fewer characters)
- Encourages conversational back-and-forth (vs monologue)

**Verified in:** Production voice AI systems (conversational design best practices)

## Engineering Rules (Binding)

### R-KB-001 Knowledge Retrieval Latency MUST Stay Below 100ms at P95
**Rationale:** Voice systems target P95 turn latency <800ms. Retrieval consuming >100ms leaves insufficient budget for STT, LLM, TTS.

**Implementation:**
- Use approximate nearest neighbor algorithms (FAISS HNSW, not exact search)
- Preload indexes into memory (avoid disk I/O)
- Use lightweight embedding models for queries (all-MiniLM-L6-v2: 10-20ms)
- Skip reranking for voice (trade accuracy for latency)
- Monitor retrieval latency, alert if P95 >100ms

### R-KB-002 Retrieved Context MUST Fit Within LLM Context Window With 20% Headroom
**Rationale:** Context window overflow silently truncates knowledge, causing "I don't know" responses despite having relevant information.

**Implementation:**
- Calculate available context: context_window - system_prompt - conversation_history - 20% buffer
- Limit retrieval to top-k chunks that fit: k = available_context / avg_chunk_size
- Monitor context window usage, alert when >80% full
- Prioritize recent conversation over retrieved knowledge if space constrained

### R-KB-003 Retrieval Confidence Below 0.75 MUST Trigger "I Don't Know" Response
**Rationale:** Low-confidence retrievals cause LLM hallucination. Voice users cannot verify information, higher threshold required than chatbots.

**Implementation:**
- Retrieve top-k documents with similarity scores
- If top document similarity <0.75: Respond "I don't have specific information about that"
- Log rejected queries for knowledge base improvement
- Adjust threshold based on production hallucination rates (target: <5%)

### R-KB-004 Real-Time Dynamic Data MUST Use Tool Calls, Not RAG
**Rationale:** Vector databases are stale (minutes to hours). Real-time data (account balances, inventory, prices) requires authoritative source.

**Implementation:**
- Define tools for: account lookups, order status, inventory checks, price queries
- System prompt: "For real-time data, you MUST call the appropriate tool. Do NOT answer from cached knowledge."
- Monitor tool call latency, alert if >300ms (breaks conversational flow)
- Implement fallback if tool call fails or times out

### R-KB-005 LLM Response Length MUST Be Limited to 150 Tokens for Voice
**Rationale:** Responses >20 seconds (150 tokens) lose user attention, cause interruptions, waste TTS costs.

**Implementation:**
- Set `max_tokens=150` in LLM parameters
- System prompt: "Keep responses under 20 seconds. Be concise."
- Post-processing: Truncate at sentence boundary if >150 tokens
- Monitor response length distribution, alert if P95 >150 tokens

### R-KB-006 Static Knowledge <10K Tokens MUST Be Pre-Loaded Into System Prompt
**Rationale:** Pre-loading eliminates retrieval latency (zero latency). Provider prompt caching reduces cost by 50-90%.

**Implementation:**
- Identify static knowledge: company info, product specs, FAQ (total <10K tokens)
- Load into system prompt at agent initialization
- Enable provider prompt caching (OpenAI, Anthropic)
- Update only when knowledge changes (not per-call)

### R-KB-007 Embedding Model MUST Be Consistent Between Documents and Queries
**Rationale:** Mismatched embedding models produce incompatible vector spaces, retrieval returns random results.

**Implementation:**
- Use same embedding model for document and query embedding
- Version embedding model in metadata: `{"embedding_model": "text-embedding-3-small", "version": "2024-01"}`
- Detect model mismatches at query time, alert if different
- Reindex knowledge base if changing embedding model

### R-KB-008 Semantic Cache MUST Be Invalidated When Underlying Knowledge Changes
**Rationale:** Stale cached responses provide incorrect information, users lose trust.

**Implementation:**
- Track which knowledge chunks contributed to each cached response
- On knowledge update: Invalidate all cached responses using updated chunks
- Set cache TTL based on knowledge freshness requirements (minutes to hours)
- Monitor cache invalidation rate, alert if >10% of cache invalidated per hour (indicates frequent updates)

### R-KB-009 Knowledge Base Updates MUST Complete Without Agent Restart
**Rationale:** Agent restarts cause downtime (minutes), disrupt active calls, require complex orchestration.

**Implementation:**
- Use external vector database (Pinecone, Weaviate, Qdrant) for knowledge storage
- Update database, agents see new data on next query (no restart)
- Or: Hot-reload knowledge files every 60-300 seconds (polling)
- Monitor knowledge freshness, alert if >1 hour stale

### R-KB-010 Retrieval MUST Complete Before LLM Generation Begins
**Rationale:** Retrieval timing attacks cause LLM to start speaking without context, then awkwardly incorporate late-arriving information.

**Implementation:**
- Block LLM generation until retrieval completes (wait for all context)
- Or: Use predictive prefetching to retrieve during user speech (advanced)
- Monitor retrieval latency, alert if >100ms (indicates slow retrieval)
- Never stream LLM output before retrieval completes

## Metrics & Signals to Track

### Retrieval Performance Metrics

**Latency:**
- `retrieval_latency_p50`: P50 retrieval latency (target: <50ms)
- `retrieval_latency_p95`: P95 retrieval latency (target: <100ms)
- `retrieval_latency_p99`: P99 retrieval latency (alert if >200ms)
- `embedding_latency_p95`: P95 query embedding latency (target: <20ms)
- `vector_search_latency_p95`: P95 vector search latency (target: <50ms)
- `reranking_latency_p95`: P95 reranking latency (if used)

**Quality:**
- `retrieval_confidence_avg`: Average top-1 similarity score (target: >0.80)
- `retrieval_low_confidence_rate`: % of retrievals with top-1 similarity <0.75 (alert if >20%)
- `retrieval_precision_at_k`: Precision@5, Precision@10 (requires ground truth)
- `retrieval_empty_results_rate`: % of queries with zero results (alert if >5%)

**Cache Performance:**
- `semantic_cache_hit_rate`: % of queries served from cache (target: 20-40%)
- `semantic_cache_latency_p95`: P95 cache lookup latency (target: <30ms)
- `semantic_cache_invalidation_rate`: Cache invalidations per hour

### Knowledge Base Health Metrics

**Freshness:**
- `knowledge_last_update_age`: Time since last knowledge update (alert if >24 hours)
- `knowledge_staleness_rate`: % of chunks older than threshold (e.g., 30 days)
- `knowledge_update_frequency`: Updates per day/week

**Coverage:**
- `knowledge_base_size`: Total documents, total chunks, total tokens
- `knowledge_query_coverage`: % of queries with high-confidence retrieval (target: >80%)
- `knowledge_gaps`: Queries with no relevant results (requires manual review)

**Cost:**
- `embedding_cost_per_query`: Cost of query embedding (track separately)
- `vector_db_cost_per_month`: Vector database infrastructure costs
- `knowledge_update_cost`: Cost of reindexing (embeddings + compute)

### LLM Behavior Metrics (Knowledge-Related)

**Response Quality:**
- `llm_response_length_avg`: Average response tokens (target: 60-90 for voice)
- `llm_response_length_p95`: P95 response tokens (alert if >150)
- `llm_hallucination_rate`: % of responses flagged as hallucinated (requires evaluation)
- `llm_uncertainty_rate`: % of responses with "I don't know" (track trend)

**Tool Usage:**
- `tool_call_rate`: % of turns with tool calls
- `tool_call_latency_p95`: P95 tool call latency (target: <300ms)
- `tool_call_failure_rate`: % of tool calls that fail (alert if >5%)

**Context Usage:**
- `context_window_utilization_avg`: % of context window used (alert if >80%)
- `context_truncation_rate`: % of turns where context was truncated (alert if >5%)
- `retrieved_chunks_used_avg`: Average chunks included in LLM context

### User Experience Metrics (Knowledge-Related)

**Conversation Quality:**
- `turns_per_conversation_avg`: Average turns per conversation (detect if increasing due to poor knowledge)
- `user_interruption_rate`: % of agent responses interrupted (may indicate verbosity)
- `user_repeat_query_rate`: % of queries repeated within same conversation (indicates poor answer quality)

**Knowledge Satisfaction:**
- `knowledge_transfer_rate`: % of conversations transferred to human (indicates knowledge gaps)
- `knowledge_escalation_reason`: Categorize why transfers occur (missing info, incorrect info, complex query)

## V1 Decisions / Constraints

### In Scope for V1

**Tiered Knowledge Architecture:**
- Tier 1: Pre-loaded static knowledge (<10K tokens) in system prompt with prompt caching
- Tier 2: Semantic cache for common queries (Redis/Elasticsearch)
- Tier 3: Vector database with hybrid search (Pinecone/Weaviate/Qdrant)
- Tier 4: Tool/function calls for real-time data

**Retrieval Implementation:**
- Hybrid search: BM25 + vector search with RRF fusion
- Lightweight embedding model for queries (all-MiniLM-L6-v2 or equivalent)
- High-quality embedding model for documents (OpenAI text-embedding-3-large)
- Confidence gating: Reject retrievals with similarity <0.75
- Retrieval latency target: P95 <100ms

**Response Constraints:**
- Maximum response length: 150 tokens
- System prompt instructions for conciseness
- Post-processing truncation at sentence boundaries

**Knowledge Updates:**
- External vector database for zero-downtime updates
- Semantic cache invalidation on knowledge changes
- Cache TTL: 1-4 hours depending on freshness requirements

**Monitoring:**
- Retrieval latency (P50, P95, P99)
- Retrieval confidence scores
- Cache hit rates
- Response length distribution
- Context window utilization

### Out of Scope for V1 (Post-V1)

**Advanced Retrieval:**
- Predictive prefetching (requires conversation prediction)
- Multi-hop reasoning over knowledge (too slow for voice)
- Cross-encoder reranking (adds 50-200ms latency)
- Query expansion and reformulation (adds latency)

**Advanced Caching:**
- Distributed semantic cache with consistency guarantees
- Cache warming strategies for cold starts
- Adaptive cache TTL based on query patterns

**Knowledge Management:**
- Automated knowledge gap detection and filling
- A/B testing of different retrieval strategies
- Automated knowledge quality scoring
- Knowledge versioning and rollback

**Evaluation:**
- Automated retrieval precision measurement (requires ground truth)
- Hallucination detection and scoring
- User satisfaction measurement (requires feedback collection)

### Known Limitations

**Retrieval Latency Floor:**
Even with optimization, retrieval adds 50-100ms to turn latency. This is 10-20% of the 500ms P50 target. Cannot eliminate entirely without pre-loading all knowledge (infeasible for large knowledge bases).

**Embedding Model Trade-offs:**
Lightweight models (all-MiniLM-L6-v2) are fast (10-20ms) but lower quality than large models (OpenAI text-embedding-3-large: 50-100ms). Asymmetric approach (fast query, slow document) requires validation that retrieval quality is acceptable.

**Confidence Threshold Sensitivity:**
0.75 threshold rejects 20-30% of queries in typical systems. Too high: Many "I don't know" responses, poor user experience. Too low: More hallucinations. Requires tuning based on production data.

**Semantic Cache Hit Rate:**
20-40% hit rate typical for voice applications (lower than chatbots due to more diverse queries). 60-80% of queries still require full retrieval. Cache provides limited benefit unless query patterns are highly repetitive.

**Knowledge Freshness vs Latency:**
External vector database enables zero-downtime updates but adds 10-50ms network latency per query. Pre-loaded knowledge is faster (zero latency) but requires agent restart for updates. Trade-off between freshness and latency.

**Context Window Constraints:**
LLM context windows (8K-128K tokens) limit how much knowledge can be retrieved. Even with large context windows, retrieval precision degrades with more chunks (noise increases). Optimal: 3-10 chunks (1K-3K tokens).

## Open Questions / Risks

### Evidence Gaps

**Pipecat-Specific RAG Performance:**
No public benchmarks for Pipecat with vector databases (Pinecone, Weaviate, Qdrant). Retrieval latency may be higher than standalone benchmarks due to framework overhead. Requires internal testing.

**Optimal Chunk Size for Voice:**
Recommendation of 200-300 tokens is based on general RAG practices, not voice-specific data. Voice may benefit from smaller chunks (100-200 tokens) for conciseness. Requires experimentation.

**Confidence Threshold for Voice:**
0.75 threshold is hypothesis based on higher risk for voice (user cannot verify). Optimal threshold may be 0.70 or 0.80 depending on hallucination tolerance. Requires production data.

**Semantic Cache Hit Rate for Voice:**
Claimed 20-40% hit rate is based on chatbot data. Voice queries may be more diverse (lower hit rate) or more repetitive (higher hit rate) depending on use case. Requires measurement.

**Asymmetric Embedding Quality:**
Using lightweight model for queries and high-quality model for documents is hypothesis. Retrieval quality impact is unknown without testing. May require same model for both.

### Technical Risks

**Vector Database as Single Point of Failure:**
External vector database (Pinecone, Weaviate) becomes critical dependency. Database outage causes complete knowledge retrieval failure. Requires fallback strategy (pre-loaded knowledge, semantic cache).

**Embedding API Rate Limits:**
High query volume (1000s per hour) may hit embedding API rate limits. OpenAI, Cohere have undocumented rate limits. Requires monitoring and fallback to self-hosted embedding models.

**Context Window Overflow:**
As conversations lengthen, context window fills with conversation history, leaving less space for retrieved knowledge. May need to summarize conversation history or limit retrieval chunks dynamically.

**Semantic Drift at Scale:**
Retrieval precision degrades as knowledge base grows from 100K to 10M documents. V1 may handle 100K-1M documents well but struggle at 10M+. Requires monitoring precision and reindexing strategies.

**Knowledge Update Race Conditions:**
Updating vector database while queries are in-flight may cause inconsistent results (some queries see old data, some see new data). Requires atomic updates or versioning.

### Operational Risks

**Knowledge Quality Degradation:**
As knowledge base grows, quality may degrade (outdated chunks, duplicate chunks, irrelevant chunks). Requires periodic audits and cleanup.

**Cost Surprises:**
Embedding costs scale with knowledge base size and query volume. Reindexing 10M documents costs $20,000+ (at $0.002/1K tokens). Requires cost monitoring and budgeting.

**Latency Regression:**
As knowledge base grows, retrieval latency may increase despite using approximate algorithms. Requires continuous monitoring and reindexing with optimized parameters.

**Cache Invalidation Complexity:**
Tracking which knowledge chunks contributed to each cached response is complex. Incorrect invalidation causes stale responses. Over-invalidation wastes cache.

**Tool Call Latency Variability:**
External APIs have variable latency (50-500ms). Slow APIs break conversational flow. Requires timeout enforcement and fallback responses.

### Hypothesis Requiring Validation

**100ms Retrieval Latency Target:**
Claimed P95 <100ms is based on latency budget analysis. Actual acceptable latency may be 50ms or 150ms depending on overall system performance. Requires user experience testing.

**150 Token Response Length Limit:**
Claimed 150 tokens (20 seconds) is user attention limit based on conversational design practices. Actual limit may be 100 tokens or 200 tokens depending on use case. Requires user testing.

**Confidence Gating Reduces Hallucination:**
Hypothesis that rejecting retrievals with similarity <0.75 reduces hallucination. Actual impact unknown without production measurement. May reject too many valid queries.

**Semantic Cache 20-40% Hit Rate:**
Claimed hit rate is based on chatbot data. Voice applications may have different query patterns. Actual hit rate may be 10% or 60% depending on use case.

**Hybrid Search 30-40% Precision Improvement:**
Claimed improvement is based on general RAG benchmarks. Voice-specific improvement may be different due to query characteristics. Requires measurement.
