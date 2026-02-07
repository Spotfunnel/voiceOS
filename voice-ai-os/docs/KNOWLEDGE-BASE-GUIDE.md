# Knowledge Base Building Guide

**Production-Grade Guide for Voice AI Knowledge Base Implementation**

This guide provides step-by-step instructions for building, deploying, and maintaining knowledge bases in the voice AI platform following the three-layer architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Knowledge Preparation](#phase-1-knowledge-preparation)
4. [Phase 2: Tier Selection](#phase-2-tier-selection)
5. [Phase 3: Implementation by Tier](#phase-3-implementation-by-tier)
6. [Phase 4: Integration with Orchestration Layer](#phase-4-integration-with-orchestration-layer)
7. [Phase 5: Testing and Validation](#phase-5-testing-and-validation)
8. [Phase 6: Deployment and Monitoring](#phase-6-deployment-and-monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Cost Optimization](#cost-optimization)

---

## Overview

### What is a Knowledge Base?

A knowledge base is structured information that voice AI agents use to answer user questions. In this platform, knowledge bases are implemented across four tiers based on latency, freshness, and size requirements.

### Four-Tier Architecture

| Tier | Type | Latency | Use Case | Size Limit |
|------|------|---------|----------|------------|
| **Tier 1** | Pre-loaded static | 0ms | Company info, FAQ, product specs | <10K tokens |
| **Tier 2** | Semantic cache | 20-30ms | Common queries, repeated questions | Top 100-1000 queries |
| **Tier 3** | Vector database | 50-100ms | Product catalog, documentation, policies | 10K-1M documents |
| **Tier 4** | Tool calls | 100-500ms | Account balances, order status, inventory | Real-time data |

### Design Principles

1. **Layer 1 (Voice Core)** provides immutable retrieval primitives
2. **Layer 2 (Orchestration)** allows customers to configure WHICH knowledge bases and WHEN to use them
3. **Layer 3 (Workflow)** handles async knowledge updates and management
4. **Knowledge updates NEVER block conversations**

---

## Prerequisites

### Required Infrastructure

**Vector Database** (Tier 3):
- Pinecone (recommended for simplicity)
- Weaviate (recommended for self-hosted)
- Qdrant (recommended for open-source)
- Cloudflare Vectorize (recommended for cost optimization)

**Semantic Cache** (Tier 2):
- Redis (recommended)
- Elasticsearch (alternative)

**Embedding Service**:
- OpenAI text-embedding-3-large (document embeddings, high quality)
- all-MiniLM-L6-v2 (query embeddings, low latency)

**Workflow Engine** (Tier 3):
- n8n (recommended for visual workflows)
- Temporal (recommended for complex orchestration)
- Custom (if specific requirements)

### Required Knowledge

- Understanding of the three-layer architecture (see `research/22-voice-core-orchestration-workflows.md`)
- Basic understanding of vector embeddings and similarity search
- Access to customer's knowledge sources (documents, FAQ, policies)

---

## Phase 1: Knowledge Preparation

### Step 1.1: Inventory Knowledge Sources

**Document all knowledge sources**:
```
Knowledge Inventory:
- Company policies (PDF, 15 pages)
- Product catalog (CSV, 500 products)
- FAQ (Markdown, 50 questions)
- Return policy (PDF, 3 pages)
- Pricing information (API, real-time)
```

**Categorize by characteristics**:
```
Static vs Dynamic:
- Static: Company policies, FAQ, return policy (rarely change)
- Dynamic: Pricing (changes frequently), inventory (real-time)

Size:
- Small: FAQ (<5K tokens), return policy (<2K tokens)
- Medium: Product catalog (50K tokens)
- Large: Full documentation (100K+ tokens)

Freshness requirements:
- Can be hours old: FAQ, policies
- Must be current: Pricing, inventory
```

### Step 1.2: Select Appropriate Tier

**Decision tree**:

```
Is knowledge < 10K tokens and static?
  → YES: Tier 1 (Pre-loaded static)
  → NO: Continue

Is data real-time or user-specific?
  → YES: Tier 4 (Tool calls)
  → NO: Continue

Are same queries repeated frequently (>20% query overlap)?
  → YES: Consider Tier 2 (Semantic cache) + Tier 3 (Vector DB)
  → NO: Tier 3 (Vector DB) only

Is knowledge 10K-1M documents?
  → YES: Tier 3 (Vector DB)
  → NO: Reconsider Tier 1 or partition knowledge
```

### Step 1.3: Extract and Clean Knowledge

**For documents (PDF, Word, etc.)**:
1. Extract text using appropriate parser
   - PDF: PyPDF2, pdfplumber
   - Word: python-docx
   - HTML: BeautifulSoup
2. Remove headers, footers, page numbers
3. Normalize formatting (remove extra whitespace, line breaks)
4. Split into sections (use headers as boundaries)

**For structured data (CSV, JSON)**:
1. Convert to natural language
   - Product: "Product X costs $99 and has features A, B, C"
   - Policy: "Returns accepted within 30 days with receipt"
2. Include all searchable fields (name, description, specs)
3. Add metadata (category, product_line, last_updated)

**Quality checklist**:
- [ ] All text is readable (no encoding issues)
- [ ] Headers and sections are preserved
- [ ] Metadata is extracted (dates, categories, authors)
- [ ] No duplicate content
- [ ] No sensitive/private information (PII, credentials)

---

## Phase 2: Tier Selection

### Tier 1: Pre-Loaded Static Knowledge

**Use when**:
- Knowledge is small (<10K tokens)
- Changes infrequently (monthly or less)
- Must have zero retrieval latency
- Examples: Company info, return policy, hours of operation

**Characteristics**:
- Loaded into system prompt at agent initialization
- Zero latency during calls
- High cost per call (repeated prompt tokens)
- Mitigated by provider prompt caching (50-90% cost reduction)

**Maximum size**: 10K tokens (~7,500 words)

---

### Tier 2: Semantic Cache

**Use when**:
- Same queries repeated frequently (>20% overlap)
- Acceptable response staleness (minutes to hours)
- Cost/latency more important than freshness
- Examples: "What's your return policy?", "What are your hours?", "Do you offer financing?"

**Characteristics**:
- Caches LLM responses for similar queries
- 88% latency reduction (20-80ms vs 500ms+)
- 20-68% cost reduction in LLM calls
- Requires cache invalidation on knowledge updates

**Cache hit rate**: 20-40% typical for voice applications

---

### Tier 3: Vector Database

**Use when**:
- Medium to large knowledge (10K-1M documents)
- Cannot fit in system prompt
- Semi-static (updated hourly or daily)
- Examples: Product catalog, documentation, policies

**Characteristics**:
- 50-150ms retrieval latency
- Scales to millions of documents
- Supports hybrid search (BM25 + vector)
- Requires embedding costs and vector DB infrastructure

**Cost**: $45-400/month (Weaviate) or $0.11-1.33/hour (Pinecone)

---

### Tier 4: Tool Calls

**Use when**:
- Real-time or user-specific data
- Requires authentication/authorization
- Must be current (cannot tolerate staleness)
- Examples: Account balances, order status, inventory levels, pricing

**Characteristics**:
- 100-500ms latency per call
- Highest latency, highest accuracy
- Requires reliable external APIs
- Provides verbal feedback: "Let me check that for you..."

**Latency budget**: Must stay <300ms to avoid awkward pauses

---

## Phase 3: Implementation by Tier

### Tier 1: Pre-Loaded Static Knowledge

#### Step 3.1.1: Prepare Knowledge File

Create a knowledge file (`knowledge/static/company_info.txt`):

```text
COMPANY INFORMATION

Business Name: Example Dental Practice
Address: 123 Main Street, Bondi, NSW 2026, Australia
Phone: (02) 1234 5678
Email: info@exampledental.com.au
Hours: Monday-Friday 9am-5pm, Saturday 9am-1pm, Closed Sunday

SERVICES

General Dentistry: Checkups, cleanings, fillings
Cosmetic Dentistry: Teeth whitening, veneers
Emergency Services: Same-day appointments for dental emergencies

POLICIES

Appointment Cancellation: 24-hour notice required or cancellation fee applies
Payment: We accept cash, credit card, EFTPOS, Medicare bulk billing
Insurance: We are preferred providers for HCF, Bupa, and Medibank
```

**Size limit**: Must be <10K tokens. Check token count:
```python
import tiktoken
encoding = tiktoken.encoding_for_model("gpt-4")
tokens = encoding.encode(knowledge_text)
print(f"Token count: {len(tokens)}")  # Must be <10,000
```

#### Step 3.1.2: Load into System Prompt

Add knowledge to system prompt template:

```python
system_prompt = f"""
You are a receptionist for {business_name}.

KNOWLEDGE:
{static_knowledge}

INSTRUCTIONS:
- Answer questions using the provided knowledge
- Keep responses under 20 seconds
- If you don't have information, say "I don't have that information. Let me transfer you to someone who can help."
"""
```

#### Step 3.1.3: Enable Prompt Caching

**OpenAI** (cache static portions):
```python
messages = [
    {"role": "system", "content": system_prompt},  # Cached
    {"role": "user", "content": user_query}        # Not cached
]
```

**Anthropic** (use cache_control):
```python
messages = [
    {
        "role": "system",
        "content": system_prompt,
        "cache_control": {"type": "ephemeral"}  # Cache this
    },
    {"role": "user", "content": user_query}
]
```

**Cost savings**: 50-90% on repeated system prompt tokens

---

### Tier 2: Semantic Cache

#### Step 3.2.1: Deploy Redis for Semantic Cache

**Install Redis**:
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or use managed Redis (AWS ElastiCache, Azure Cache for Redis)
```

#### Step 3.2.2: Implement Cache Logic

**Cache structure**:
```python
# Cache key: embedding of user query
# Cache value: {response, timestamp, similarity_threshold}

import redis
import numpy as np
from sentence_transformers import SentenceTransformer

redis_client = redis.Redis(host='localhost', port=6379)
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

def check_semantic_cache(user_query, threshold=0.95):
    # Embed query
    query_embedding = embedding_model.encode(user_query)
    
    # Get all cached queries
    cached_keys = redis_client.keys("cache:*")
    
    # Find most similar cached query
    best_similarity = 0
    best_response = None
    
    for key in cached_keys:
        cached_data = redis_client.get(key)
        cached_embedding = np.frombuffer(cached_data[:384*4], dtype=np.float32)
        cached_response = cached_data[384*4:].decode()
        
        similarity = np.dot(query_embedding, cached_embedding)
        
        if similarity > best_similarity:
            best_similarity = similarity
            best_response = cached_response
    
    # Return cached response if above threshold
    if best_similarity >= threshold:
        return best_response
    
    return None  # Cache miss

def add_to_semantic_cache(user_query, response, ttl=3600):
    query_embedding = embedding_model.encode(user_query)
    
    # Store embedding + response
    cache_key = f"cache:{hash(user_query)}"
    cache_value = query_embedding.tobytes() + response.encode()
    
    redis_client.setex(cache_key, ttl, cache_value)
```

#### Step 3.2.3: Integrate with Pipecat

**Custom frame processor for cache lookup**:
```python
from pipecat.frames.frames import TextFrame
from pipecat.processors.frame_processor import FrameProcessor

class SemanticCacheProcessor(FrameProcessor):
    async def process_frame(self, frame):
        if isinstance(frame, TextFrame) and frame.is_user_message:
            # Check cache before passing to LLM
            cached_response = check_semantic_cache(frame.text)
            
            if cached_response:
                # Cache hit: Return cached response, skip LLM
                await self.push_frame(TextFrame(cached_response))
                return
        
        # Cache miss: Pass through to LLM
        await self.push_frame(frame)
```

**Add to pipeline**:
```python
pipeline = Pipeline([
    transport.input(),
    stt_service,
    SemanticCacheProcessor(),  # Insert cache before LLM
    llm_service,
    tts_service,
    transport.output()
])
```

---

### Tier 3: Vector Database

#### Step 3.3.1: Choose Vector Database

**Recommended for V1**: Pinecone (managed, simple)

**Decision criteria**:
| Factor | Pinecone | Weaviate | Qdrant | Cloudflare |
|--------|----------|----------|--------|------------|
| **Ease of setup** | ⭐⭐⭐ (managed) | ⭐⭐ (self-hosted) | ⭐⭐ (self-hosted) | ⭐⭐⭐ (managed) |
| **Cost (50K vectors)** | ~$80/month | $45/month | Free (self-hosted) | $1.94/month |
| **Hybrid search** | ✅ | ✅ | ✅ | ❌ |
| **Production ready** | ✅ | ✅ | ✅ | ⚠️ (newer) |

**V1 recommendation**: Start with Pinecone (simplicity), migrate to Weaviate later (cost optimization).

#### Step 3.3.2: Chunk Documents

**Chunking script** (`scripts/chunk_documents.py`):
```python
import tiktoken
from typing import List, Dict

def chunk_document(
    text: str,
    chunk_size: int = 250,
    chunk_overlap: int = 50
) -> List[Dict]:
    """
    Chunk document for voice AI knowledge base.
    
    Args:
        text: Full document text
        chunk_size: Tokens per chunk (default: 250 for voice)
        chunk_overlap: Overlap tokens (default: 50, 20%)
    
    Returns:
        List of chunks with metadata
    """
    encoding = tiktoken.encoding_for_model("gpt-4")
    tokens = encoding.encode(text)
    
    chunks = []
    start = 0
    
    while start < len(tokens):
        end = start + chunk_size
        chunk_tokens = tokens[start:end]
        chunk_text = encoding.decode(chunk_tokens)
        
        # Ensure chunk ends at sentence boundary
        if end < len(tokens):
            # Find last period/question mark in chunk
            last_sentence = max(
                chunk_text.rfind('.'),
                chunk_text.rfind('?'),
                chunk_text.rfind('!')
            )
            if last_sentence > chunk_size * 0.5:  # At least 50% of chunk
                chunk_text = chunk_text[:last_sentence + 1]
        
        chunks.append({
            'text': chunk_text.strip(),
            'tokens': len(chunk_tokens),
            'start': start,
            'end': end
        })
        
        # Move start position with overlap
        start = end - chunk_overlap
    
    return chunks
```

**Run chunking**:
```bash
python scripts/chunk_documents.py \
  --input knowledge/raw/product_catalog.pdf \
  --output knowledge/chunked/product_catalog.json \
  --chunk_size 250 \
  --chunk_overlap 50
```

**Output** (`knowledge/chunked/product_catalog.json`):
```json
{
  "document_id": "product_catalog_v1",
  "chunks": [
    {
      "chunk_id": "chunk_001",
      "text": "Our premium dental package includes...",
      "tokens": 247,
      "metadata": {
        "category": "products",
        "product_line": "dental_packages",
        "last_updated": "2026-02-01"
      }
    }
  ]
}
```

#### Step 3.3.3: Generate Embeddings

**Embedding script** (`scripts/generate_embeddings.py`):
```python
import openai
from typing import List, Dict

def generate_embeddings(chunks: List[Dict]) -> List[Dict]:
    """
    Generate embeddings for document chunks.
    Uses OpenAI text-embedding-3-large for document embeddings.
    """
    client = openai.OpenAI()
    
    # Batch embed (up to 100 chunks per request)
    batch_size = 100
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [chunk['text'] for chunk in batch]
        
        # Call embedding API
        response = client.embeddings.create(
            model="text-embedding-3-large",
            input=texts
        )
        
        # Add embeddings to chunks
        for j, chunk in enumerate(batch):
            chunk['embedding'] = response.data[j].embedding
    
    return chunks
```

**Run embedding**:
```bash
python scripts/generate_embeddings.py \
  --input knowledge/chunked/product_catalog.json \
  --output knowledge/embedded/product_catalog.json \
  --model text-embedding-3-large
```

**Cost**: ~$0.13 per 1M tokens (OpenAI text-embedding-3-large)
- 500 products × 250 tokens/chunk = 125K tokens
- Cost: 125K / 1M × $0.13 = **$0.016**

#### Step 3.3.4: Upload to Vector Database

**Pinecone upload script** (`scripts/upload_to_pinecone.py`):
```python
import pinecone
import json

# Initialize Pinecone
pinecone.init(api_key="YOUR_API_KEY", environment="us-west1-gcp")

# Create index (do once)
index_name = "voice-ai-knowledge"
if index_name not in pinecone.list_indexes():
    pinecone.create_index(
        name=index_name,
        dimension=3072,  # text-embedding-3-large dimension
        metric="cosine"
    )

# Connect to index
index = pinecone.Index(index_name)

# Load embeddings
with open('knowledge/embedded/product_catalog.json') as f:
    data = json.load(f)

# Upload chunks
vectors = []
for chunk in data['chunks']:
    vectors.append({
        'id': chunk['chunk_id'],
        'values': chunk['embedding'],
        'metadata': {
            'text': chunk['text'],
            'category': chunk['metadata']['category'],
            'product_line': chunk['metadata']['product_line'],
            'last_updated': chunk['metadata']['last_updated']
        }
    })

# Batch upload (up to 100 vectors per request)
for i in range(0, len(vectors), 100):
    batch = vectors[i:i + 100]
    index.upsert(vectors=batch)

print(f"Uploaded {len(vectors)} vectors to Pinecone")
```

**Run upload**:
```bash
python scripts/upload_to_pinecone.py \
  --input knowledge/embedded/product_catalog.json \
  --index voice-ai-knowledge
```

#### Step 3.3.5: Implement Hybrid Search

**Hybrid search function** (`voice-core/knowledge/retrieval.py`):
```python
import pinecone
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import numpy as np

# Initialize
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')  # Lightweight for queries
pinecone_index = pinecone.Index("voice-ai-knowledge")

def hybrid_search(query: str, top_k: int = 3, confidence_threshold: float = 0.75):
    """
    Hybrid search combining vector and BM25.
    Returns top-k results above confidence threshold.
    """
    # 1. Vector search (30-50ms)
    query_embedding = embedding_model.encode(query).tolist()
    
    vector_results = pinecone_index.query(
        vector=query_embedding,
        top_k=20,
        include_metadata=True
    )
    
    # 2. BM25 search (20-30ms) - optional, implement if needed
    # For simplicity, using vector-only for V1
    
    # 3. Filter by confidence
    filtered_results = [
        result for result in vector_results['matches']
        if result['score'] >= confidence_threshold
    ]
    
    # 4. Return top-k
    return filtered_results[:top_k]
```

---

### Tier 4: Tool Calls

#### Step 3.4.1: Define Tool Schema

**Tool definition** (`voice-core/tools/knowledge_tools.py`):
```python
from pipecat.processors.frameworks.llm import FunctionSchema

get_account_balance_tool = FunctionSchema(
    name="get_account_balance",
    description="Get the current account balance for a customer. Use this when customer asks about their balance.",
    parameters={
        "type": "object",
        "properties": {
            "customer_id": {
                "type": "string",
                "description": "The customer's account ID"
            }
        },
        "required": ["customer_id"]
    }
)

get_appointment_availability_tool = FunctionSchema(
    name="get_appointment_availability",
    description="Check appointment availability for a specific date and time.",
    parameters={
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "Date in DD/MM/YYYY format"
            },
            "preferred_time": {
                "type": "string",
                "description": "Preferred time (morning, afternoon, evening)"
            }
        },
        "required": ["date"]
    }
)
```

#### Step 3.4.2: Implement Tool Handlers

**Tool handler** (`voice-core/tools/handlers.py`):
```python
import httpx

async def handle_get_account_balance(customer_id: str) -> dict:
    """
    Call external API to get account balance.
    Must complete in <300ms to avoid breaking conversation flow.
    """
    async with httpx.AsyncClient(timeout=0.3) as client:  # 300ms timeout
        try:
            response = await client.get(
                f"https://api.company.com/accounts/{customer_id}/balance",
                headers={"Authorization": f"Bearer {API_KEY}"}
            )
            
            if response.status_code == 200:
                balance = response.json()['balance']
                return {
                    "success": True,
                    "balance": balance,
                    "message": f"Your current balance is ${balance:.2f}"
                }
            else:
                return {
                    "success": False,
                    "message": "I'm having trouble accessing your account. Let me transfer you to someone who can help."
                }
        
        except httpx.TimeoutException:
            # Timeout: Graceful degradation
            return {
                "success": False,
                "message": "I'm experiencing a delay. Let me transfer you to someone who can help."
            }
```

#### Step 3.4.3: Register Tools with Pipecat

**Register tool handlers**:
```python
from pipecat.processors.frameworks.llm import FunctionCallRegistryItem

llm_service = OpenAILLMService(
    api_key=OPENAI_API_KEY,
    model="gpt-4.1",
    tools=[
        get_account_balance_tool,
        get_appointment_availability_tool
    ]
)

# Register handlers
llm_service.register_function(
    "get_account_balance",
    handle_get_account_balance
)

llm_service.register_function(
    "get_appointment_availability",
    handle_get_appointment_availability
)
```

---

## Phase 4: Integration with Orchestration Layer

### Step 4.1: Define Knowledge Objectives

**Customer configuration** (`config/customers/example_dental.yaml`):
```yaml
customer_id: example_dental
locale: en-AU

knowledge_bases:
  # Tier 1: Pre-loaded static
  - id: company_info
    type: preloaded
    source: s3://knowledge/static/company_info.txt
    tier: 1
    max_tokens: 5000
  
  # Tier 2: Semantic cache
  - id: faq_cache
    type: semantic_cache
    source: redis://cache:6379
    tier: 2
    ttl: 3600  # 1 hour
  
  # Tier 3: Vector database
  - id: product_catalog
    type: vector_db
    source: pinecone://voice-ai-knowledge
    tier: 3
    confidence_threshold: 0.75
  
  # Tier 4: Tool calls
  - id: appointment_api
    type: tool_call
    source: https://api.company.com/appointments
    tier: 4
    timeout: 300  # 300ms

objectives:
  # Information capture objectives (from 21-objectives-and-information-capture.md)
  - id: capture_name
    type: capture_name_au
    required: true
    on_success: next
  
  - id: capture_phone
    type: capture_phone_au
    required: true
    on_success: next
  
  # Knowledge-based objective (answer questions)
  - id: answer_questions
    type: answer_from_knowledge
    knowledge_bases:
      - company_info      # Check Tier 1 first (zero latency)
      - faq_cache         # Then Tier 2 (20-30ms)
      - product_catalog   # Then Tier 3 (50-100ms)
    confidence_threshold: 0.75
    max_response_tokens: 150  # 20 seconds max
    on_low_confidence: say_i_dont_know
    required: false  # Optional, can proceed without answer
```

### Step 4.2: Implement Knowledge Objective Primitive

**Primitive definition** (`voice-core/primitives/answer_from_knowledge.py`):
```python
from typing import List, Optional
from voice_core.primitives.base import Primitive
from voice_core.knowledge.retrieval import hybrid_search

class AnswerFromKnowledgePrimitive(Primitive):
    """
    Layer 1 primitive for answering from knowledge base.
    Immutable across customers.
    """
    
    def __init__(
        self,
        knowledge_bases: List[str],
        confidence_threshold: float = 0.75,
        max_response_tokens: int = 150
    ):
        self.knowledge_bases = knowledge_bases
        self.confidence_threshold = confidence_threshold
        self.max_response_tokens = max_response_tokens
    
    async def execute(self, query: str, context: dict) -> dict:
        """
        Execute knowledge retrieval.
        Returns retrieved chunks or None if low confidence.
        """
        # Try each knowledge base in order (Tier 1 → 2 → 3)
        for kb_id in self.knowledge_bases:
            kb = context['knowledge_bases'][kb_id]
            
            if kb['tier'] == 1:
                # Tier 1: Already in system prompt, skip retrieval
                continue
            
            elif kb['tier'] == 2:
                # Tier 2: Check semantic cache
                cached_response = check_semantic_cache(query)
                if cached_response:
                    return {
                        'success': True,
                        'response': cached_response,
                        'source': 'semantic_cache',
                        'latency_ms': 25
                    }
            
            elif kb['tier'] == 3:
                # Tier 3: Vector database retrieval
                results = hybrid_search(
                    query=query,
                    top_k=3,
                    confidence_threshold=self.confidence_threshold
                )
                
                if results:
                    # High confidence: Return retrieved chunks
                    return {
                        'success': True,
                        'retrieved_chunks': results,
                        'confidence': results[0]['score'],
                        'source': 'vector_db',
                        'latency_ms': 75
                    }
        
        # All knowledge bases checked, no high-confidence result
        return {
            'success': False,
            'message': "I don't have specific information about that.",
            'confidence': 0.0,
            'source': 'none'
        }
```

---

## Phase 5: Testing and Validation

### Step 5.1: Test Retrieval Quality

**Test script** (`scripts/test_retrieval.py`):
```python
import json

# Define test queries and expected results
test_queries = [
    {
        "query": "What's your return policy?",
        "expected_category": "policies",
        "expected_confidence": 0.85
    },
    {
        "query": "Do you offer teeth whitening?",
        "expected_category": "products",
        "expected_confidence": 0.80
    },
    {
        "query": "What are your hours on Saturday?",
        "expected_category": "company_info",
        "expected_confidence": 0.90
    }
]

# Test each query
for test in test_queries:
    results = hybrid_search(test['query'], top_k=3)
    
    if not results:
        print(f"❌ FAIL: {test['query']} - No results")
        continue
    
    top_result = results[0]
    
    # Check confidence
    if top_result['score'] < test['expected_confidence']:
        print(f"⚠️  WARN: {test['query']} - Low confidence: {top_result['score']:.2f}")
    
    # Check category
    if top_result['metadata']['category'] != test['expected_category']:
        print(f"❌ FAIL: {test['query']} - Wrong category: {top_result['metadata']['category']}")
    else:
        print(f"✅ PASS: {test['query']} - Confidence: {top_result['score']:.2f}")
```

**Run tests**:
```bash
python scripts/test_retrieval.py
```

**Expected output**:
```
✅ PASS: What's your return policy? - Confidence: 0.87
✅ PASS: Do you offer teeth whitening? - Confidence: 0.82
✅ PASS: What are your hours on Saturday? - Confidence: 0.91
```

### Step 5.2: Test Latency

**Latency test script**:
```python
import time

def test_retrieval_latency(num_queries: int = 100):
    latencies = []
    
    test_queries = [
        "What's your return policy?",
        "Do you offer teeth whitening?",
        "What are your hours?"
    ]
    
    for i in range(num_queries):
        query = test_queries[i % len(test_queries)]
        
        start = time.time()
        results = hybrid_search(query, top_k=3)
        end = time.time()
        
        latency_ms = (end - start) * 1000
        latencies.append(latency_ms)
    
    # Calculate percentiles
    p50 = np.percentile(latencies, 50)
    p95 = np.percentile(latencies, 95)
    p99 = np.percentile(latencies, 99)
    
    print(f"Retrieval Latency:")
    print(f"  P50: {p50:.1f}ms")
    print(f"  P95: {p95:.1f}ms")
    print(f"  P99: {p99:.1f}ms")
    
    # Check against targets
    if p95 > 100:
        print(f"⚠️  WARNING: P95 latency ({p95:.1f}ms) exceeds 100ms target")
    else:
        print(f"✅ PASS: P95 latency within 100ms target")
```

**Run latency test**:
```bash
python scripts/test_retrieval_latency.py --num_queries 100
```

**Expected output**:
```
Retrieval Latency:
  P50: 47.3ms
  P95: 89.2ms
  P99: 112.5ms
✅ PASS: P95 latency within 100ms target
```

### Step 5.3: Test End-to-End Conversation

**Test conversation with knowledge**:
```python
# Test agent with knowledge base
from voice_core.agent import VoiceAgent

agent = VoiceAgent(
    customer_config="config/customers/example_dental.yaml"
)

# Simulate conversation
test_conversation = [
    ("What services do you offer?", "product_catalog"),
    ("What's your return policy?", "company_info"),
    ("Can I get an appointment tomorrow?", "appointment_api")
]

for user_message, expected_knowledge_source in test_conversation:
    response, metadata = await agent.process_message(user_message)
    
    print(f"User: {user_message}")
    print(f"Agent: {response}")
    print(f"Source: {metadata['knowledge_source']}")
    print(f"Latency: {metadata['latency_ms']}ms")
    print(f"Confidence: {metadata['confidence']:.2f}")
    print()
```

---

## Phase 6: Deployment and Monitoring

### Step 6.1: Deploy Knowledge Base Pipeline

**Deployment checklist**:
- [ ] Vector database deployed and accessible (Pinecone/Weaviate)
- [ ] Embeddings uploaded and indexed
- [ ] Semantic cache deployed (Redis)
- [ ] Tool APIs accessible and tested
- [ ] Static knowledge loaded into system prompt
- [ ] Prompt caching enabled (OpenAI/Anthropic)

### Step 6.2: Monitor Retrieval Performance

**Key metrics** (from `research/13-knowledge-bases.md`):

**Latency metrics**:
```
retrieval_latency_p50: Target <50ms
retrieval_latency_p95: Target <100ms
retrieval_latency_p99: Alert if >200ms
```

**Quality metrics**:
```
retrieval_confidence_avg: Target >0.80
retrieval_low_confidence_rate: Alert if >20%
knowledge_query_coverage: Target >80%
```

**Cache metrics**:
```
semantic_cache_hit_rate: Target 20-40%
semantic_cache_latency_p95: Target <30ms
```

**Cost metrics**:
```
embedding_cost_per_query: Track separately
vector_db_cost_per_month: Track separately
knowledge_update_cost: Track reindexing costs
```

### Step 6.3: Set Up Alerts

**Alerting rules**:
```yaml
alerts:
  - name: high_retrieval_latency
    condition: retrieval_latency_p95 > 100ms
    action: alert_slack
    message: "Retrieval latency P95 exceeds 100ms target"
  
  - name: low_retrieval_confidence
    condition: retrieval_low_confidence_rate > 20%
    action: alert_slack
    message: "20%+ of queries have low confidence (<0.75)"
  
  - name: vector_db_down
    condition: vector_db_error_rate > 5%
    action: page_oncall
    message: "Vector database error rate >5%"
  
  - name: knowledge_stale
    condition: knowledge_last_update_age > 24h
    action: alert_slack
    message: "Knowledge base not updated in 24+ hours"
```

---

## Troubleshooting

### Problem: Retrieval latency >200ms

**Symptoms**: Awkward pauses, user perceives agent as slow

**Diagnosis**:
```bash
# Check vector database latency
curl -X POST https://api.pinecone.io/query \
  -d '{"vector": [...], "topK": 10}' \
  --time

# Check embedding latency
time curl -X POST https://api.openai.com/v1/embeddings \
  -d '{"model": "text-embedding-3-small", "input": "test query"}'
```

**Solutions**:
1. Switch to faster embedding model (all-MiniLM-L6-v2: 10-20ms)
2. Preload indexes into memory (avoid disk I/O)
3. Use approximate algorithms (HNSW, not exact search)
4. Skip reranking (trade accuracy for latency)
5. Implement semantic caching (cache hit = 20-30ms)

---

### Problem: Low retrieval confidence (<0.75)

**Symptoms**: Frequent "I don't know" responses

**Diagnosis**:
```python
# Analyze confidence distribution
confidence_scores = [result['score'] for result in all_retrieval_results]
plt.hist(confidence_scores, bins=20)
plt.axvline(x=0.75, color='r', label='Threshold')
plt.show()
```

**Solutions**:
1. Lower confidence threshold (0.70 instead of 0.75) - test hallucination rate
2. Improve chunking (ensure chunks are complete sentences)
3. Add more documents (knowledge base may be incomplete)
4. Use better embedding model (text-embedding-3-large for both query and documents)
5. Implement hybrid search (BM25 + vector)

---

### Problem: LLM over-answering (verbose responses)

**Symptoms**: Responses >20 seconds, users interrupt frequently

**Diagnosis**:
```python
# Analyze response length distribution
response_lengths = [len(response.split()) for response in all_responses]
print(f"P50: {np.percentile(response_lengths, 50)} tokens")
print(f"P95: {np.percentile(response_lengths, 95)} tokens")
print(f"P99: {np.percentile(response_lengths, 99)} tokens")
```

**Solutions**:
1. Enforce max_tokens=150 in LLM parameters
2. Update system prompt: "Keep responses under 20 seconds. Be concise."
3. Use smaller chunks (150-200 tokens instead of 300-500)
4. Post-process: Truncate at sentence boundary if >150 tokens
5. Monitor response length, alert if P95 >150 tokens

---

### Problem: Knowledge staleness (outdated information)

**Symptoms**: Agent provides old prices, discontinued products

**Diagnosis**:
```bash
# Check last update timestamp
redis-cli GET knowledge:last_update

# Check chunk age distribution
SELECT category, AVG(EXTRACT(EPOCH FROM NOW() - last_updated)) as avg_age_seconds
FROM knowledge_chunks
GROUP BY category;
```

**Solutions**:
1. Implement hot-reload (poll for changes every 60-300 seconds)
2. Use external vector DB (updates visible immediately)
3. Invalidate semantic cache on knowledge updates
4. Set cache TTL based on freshness requirements (1-4 hours)
5. Use tool calls for dynamic data (prices, inventory)

---

### Problem: Vector database outage

**Symptoms**: All knowledge queries fail, agent says "I don't know" to everything

**Diagnosis**:
```bash
# Check vector DB health
curl https://api.pinecone.io/health

# Check error rate
SELECT COUNT(*) as errors
FROM retrieval_logs
WHERE error IS NOT NULL
AND timestamp > NOW() - INTERVAL '5 minutes';
```

**Solutions**:
1. Implement fallback: Pre-loaded static knowledge (Tier 1)
2. Use semantic cache as fallback (Tier 2)
3. Multi-region vector DB deployment
4. Circuit breaker: Detect failures, switch to degraded mode
5. Monitor DB health, alert on failures

---

## Cost Optimization

### Strategy 1: Use Asymmetric Embedding Models

**Pattern**:
- **Documents** (offline): OpenAI text-embedding-3-large (high quality, 50-100ms, $0.13/1M tokens)
- **Queries** (real-time): all-MiniLM-L6-v2 (low latency, 10-20ms, free self-hosted)

**Savings**: 60% reduction in embedding costs (no API calls for queries)

**Validation**: Test that asymmetric models maintain retrieval quality (>0.75 confidence on test set)

---

### Strategy 2: Enable Prompt Caching

**Pattern**: Cache static system prompt and pre-loaded knowledge (Tier 1)

**OpenAI caching**:
- Cached tokens: $0.50/1M (90% discount)
- Non-cached tokens: $5.00/1M

**Savings**: 81% cost reduction on repeated system prompts

**Example**:
- System prompt: 5,000 tokens
- Without caching: 5,000 tokens × $5.00/1M × 10,000 calls = $250
- With caching: 5,000 tokens × $0.50/1M × 10,000 calls = $25
- **Savings**: $225 (90%)

---

### Strategy 3: Use Cloudflare Vectorize for Cost Optimization

**Cost comparison** (50K vectors, 768 dimensions, 200K queries/month):
- Pinecone: ~$80/month
- Weaviate: $45/month (self-hosted)
- Cloudflare Vectorize: $1.94/month

**Savings**: $43-78/month

**Trade-off**: Cloudflare Vectorize does not support hybrid search (BM25 + vector). Acceptable if vector-only search provides sufficient precision.

---

### Strategy 4: Pre-Compute Answers for Top 100 Queries

**Pattern**:
1. Analyze query logs, identify top 100 queries (30-50% of volume)
2. Generate high-quality answers offline (human-reviewed)
3. Store in key-value cache (Redis, DynamoDB)
4. Serve from cache (20-50ms) instead of full RAG (100-200ms)

**Savings**:
- 30-50% of queries served from cache (zero LLM cost)
- Latency: 20-50ms vs 500-800ms (5-10× faster)

**Cost**:
- 10,000 queries/day × 30% cache hit × $0.015 LLM cost = **$45/day saved** = $1,350/month

---

### Strategy 5: Implement Knowledge Partitioning

**Pattern**: Partition knowledge base by category, route queries to specific partitions.

**Implementation**:
```python
# Instead of searching all 1M documents
results = search_all_documents(query)  # Searches 1M docs, 200ms

# Partition by category, search only relevant partition
category = classify_query(query)  # "products" or "policies" or "faq"
results = search_partition(query, category)  # Searches 100K docs, 50ms
```

**Savings**:
- Latency: 50ms vs 200ms (4× faster)
- Precision: Higher (no cross-category confusion)
- Cost: Lower (fewer irrelevant results)

---

## Summary: Knowledge Base Checklist

### Pre-Deployment Checklist

**Phase 1: Knowledge Preparation**
- [ ] All knowledge sources inventoried
- [ ] Knowledge categorized (static vs dynamic, size, freshness)
- [ ] Appropriate tier selected for each knowledge source

**Phase 2: Implementation**
- [ ] Tier 1: Static knowledge loaded into system prompt (<10K tokens)
- [ ] Tier 2: Semantic cache deployed (Redis) if applicable
- [ ] Tier 3: Vector database deployed (Pinecone/Weaviate) if applicable
- [ ] Tier 4: Tool APIs defined and tested if applicable

**Phase 3: Integration**
- [ ] Knowledge objectives defined in customer configuration
- [ ] Knowledge retrieval primitives registered with Pipecat
- [ ] Confidence thresholds configured (default: 0.75)
- [ ] Response length limits enforced (150 tokens max)

**Phase 4: Testing**
- [ ] Retrieval quality tested (>80% precision on test set)
- [ ] Retrieval latency tested (P95 <100ms)
- [ ] End-to-end conversation tested with knowledge queries
- [ ] Cache hit rate measured (target: 20-40%)

**Phase 5: Monitoring**
- [ ] Retrieval latency metrics tracked (P50, P95, P99)
- [ ] Retrieval confidence metrics tracked
- [ ] Cache hit rate tracked
- [ ] Cost metrics tracked (embedding, vector DB, LLM)
- [ ] Alerts configured (latency >100ms, confidence <0.75)

**Phase 6: Optimization**
- [ ] Prompt caching enabled (50-90% cost reduction)
- [ ] Asymmetric embedding models implemented (60% cost reduction)
- [ ] Pre-computed answers for top 100 queries (30-50% latency reduction)
- [ ] Knowledge partitioning implemented (4× latency reduction)

---

## Quick Start Example

**For Australian dental practice with 50 products and basic FAQ**:

**Step 1**: Prepare knowledge
```bash
# Extract FAQ from website
curl https://exampledental.com.au/faq > knowledge/raw/faq.html
python scripts/extract_text.py --input faq.html --output faq.txt

# Token count: 4,500 tokens (small, use Tier 1)
```

**Step 2**: Load into system prompt
```python
# Add to agent configuration
static_knowledge = load_file('knowledge/static/faq.txt')
system_prompt = f"COMPANY FAQ:\n{static_knowledge}\n\nANSWER using this knowledge."
```

**Step 3**: Enable prompt caching
```python
# OpenAI (automatic caching for system prompts >1024 tokens)
# Anthropic (add cache_control marker)
```

**Step 4**: Test
```bash
python scripts/test_agent.py \
  --query "What are your hours on Saturday?" \
  --expected_answer "9am to 1pm"
```

**Step 5**: Deploy
```bash
# Deploy agent with cached system prompt
# Cost: ~$0.015-0.020/min (no additional knowledge retrieval costs)
```

**Onboarding time**: 25-35 minutes

---

## Advanced Patterns

### Pattern 1: Streaming RAG (Predictive Prefetching)

**Use case**: High-value applications where latency is critical

**Implementation**:
1. User starts speaking (VAD detects)
2. Analyze conversation context, predict next 3-5 likely queries
3. Prefetch knowledge in parallel with STT
4. User finishes speaking, STT completes
5. If prediction correct: Zero retrieval latency (already in memory)

**Cost impact**: 2-3× retrieval costs (speculative retrievals)

**Benefit**: 20% latency reduction, 200% accuracy improvement (Stream RAG research, Meta/Carnegie Mellon)

---

### Pattern 2: Multi-Model Retrieval Consensus

**Use case**: High-stakes queries where accuracy is critical

**Implementation**:
1. Embed query with 3 different models (OpenAI, Cohere, MiniLM)
2. Retrieve top-10 from each (parallel)
3. Use majority voting to select final top-3
4. Higher confidence if all models agree

**Cost impact**: 3× embedding costs, 3× retrieval costs

**Benefit**: Higher precision, lower hallucination rate

---

### Pattern 3: Knowledge Base Versioning

**Use case**: Multiple customers on different knowledge versions

**Implementation**:
```yaml
knowledge_bases:
  - id: product_catalog
    version: v2  # Customer explicitly pins version
    source: pinecone://voice-ai-knowledge-v2
```

**Benefits**:
- Customers opt into knowledge updates (not forced)
- Rollback if new knowledge causes issues
- Test new knowledge with subset of customers (canary deployment)

---

## Appendix A: Cost Calculator

**Embedding costs** (document embeddings):
```
Documents: 500
Tokens per document: 250
Total tokens: 125,000
Embedding model: text-embedding-3-large ($0.13/1M tokens)
Cost: 125,000 / 1,000,000 × $0.13 = $0.016 one-time
```

**Query embedding costs** (if using API):
```
Queries per month: 10,000
Embedding model: text-embedding-3-small ($0.02/1M tokens)
Avg tokens per query: 20
Total tokens: 200,000/month
Cost: 200,000 / 1,000,000 × $0.02 = $4/month
```

**Vector database costs** (Pinecone):
```
Vectors: 50,000
Dimensions: 3072 (text-embedding-3-large)
Queries: 200,000/month
Pinecone s1 pod: $0.11/hour = $79.20/month
```

**Total knowledge base cost** (Tier 3):
```
One-time: $0.016 (embeddings)
Monthly: $4 (query embeddings) + $79.20 (vector DB) = $83.20/month
Per call: $83.20 / 500,000 calls = $0.000166/call
```

**For 2,000 customers**: ~$166,400/month (if all use Tier 3)

**Optimization**: Most customers use Tier 1 (pre-loaded, zero knowledge costs). Only 10-20% need Tier 3.

---

## Appendix B: Tier Selection Decision Tree

```
START
  |
  Is knowledge < 10K tokens AND static?
    YES → Tier 1 (Pre-loaded static)
    NO ↓
  
  Is data real-time or user-specific?
    YES → Tier 4 (Tool calls)
    NO ↓
  
  Are queries highly repetitive (>30% overlap)?
    YES → Tier 2 (Semantic cache) + Tier 3 (Vector DB)
    NO ↓
  
  Is knowledge 10K-1M documents?
    YES → Tier 3 (Vector DB)
    NO → ERROR: Knowledge too large, partition or use tool calls
```

---

## Appendix C: Pipecat Integration Code Examples

**Full example** (`examples/voice_agent_with_knowledge.py`):
```python
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.frameworks.llm import FunctionSchema
from pipecat.services.openai import OpenAILLMService
from voice_core.knowledge.retrieval import hybrid_search

# Define knowledge retrieval tool
search_knowledge_tool = FunctionSchema(
    name="search_knowledge",
    description="Search the knowledge base for information. Use this when user asks questions about products, policies, or company information.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The user's question"
            },
            "category": {
                "type": "string",
                "enum": ["products", "policies", "faq", "company_info"],
                "description": "Category of information"
            }
        },
        "required": ["query"]
    }
)

# Implement tool handler
async def handle_search_knowledge(query: str, category: str = None):
    # Execute hybrid search (Layer 1 primitive)
    results = hybrid_search(
        query=query,
        top_k=3,
        confidence_threshold=0.75,
        category_filter=category  # Metadata filtering
    )
    
    if not results or results[0]['score'] < 0.75:
        return {
            "success": False,
            "message": "I don't have specific information about that. Would you like me to transfer you to someone who can help?"
        }
    
    # Format results for LLM
    context = "\n\n".join([
        f"Source {i+1}: {result['metadata']['text']}"
        for i, result in enumerate(results)
    ])
    
    return {
        "success": True,
        "context": context,
        "confidence": results[0]['score']
    }

# Register with LLM service
llm_service = OpenAILLMService(
    api_key=OPENAI_API_KEY,
    model="gpt-4.1",
    tools=[search_knowledge_tool]
)

llm_service.register_function(
    "search_knowledge",
    handle_search_knowledge
)

# Build pipeline
pipeline = Pipeline([
    transport.input(),
    stt_service,
    llm_service,  # LLM calls search_knowledge tool when needed
    tts_service,
    transport.output()
])
```

---

This guide provides complete implementation details for building production-grade knowledge bases in your three-layer voice AI architecture.
