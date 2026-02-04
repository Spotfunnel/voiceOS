# Research: Tool Gateway Design for Production Voice AI Systems

**🟢 LOCKED** - Production-validated research based on tool hallucination patterns (5-10%), idempotency keys, authorization layers, sandboxed execution, distributed tracing, production tool gateway architectures. Updated February 2026.

---

## Why This Matters for V1

Tool gateway design is the critical security and reliability boundary between LLM outputs and real-world actions. The core problem: **LLMs hallucinate function calls 5-10% of the time, yet voice AI systems must execute tools safely, reliably, and with full observability**. Production data from 2025-2026 reveals that systems without proper tool gateways face three catastrophic failures: (1) **security incidents**—hallucinated tool calls execute unauthorized actions (payment charges, data deletion, PII exposure), (2) **reliability failures**—duplicate tool executions from retries cause double charges and duplicate side effects, and (3) **debugging impossibility**—no execution trace, no audit trail, cannot reproduce production issues.

The industry consensus is unambiguous: **"Never trust LLM tool calls—validate everything"**. Production platforms (OpenAI Guardrails, LiteLLM, MiniScope) have all converged on tool gateway architectures that enforce authorization, validate parameters, ensure idempotency, and provide full observability. For V1, getting tool gateway design right determines whether the system can execute real-world actions safely (not just demos), whether failures can be recovered without duplicate side effects, and whether security incidents can be prevented through defense-in-depth.

**Critical Production Reality (2026)**: Research shows tool-use hallucinations are the most challenging category, with only 11.6% step localization accuracy even for top-tier models like GPT-4 and Gemini-2.5-Pro. Tool hallucinations manifest as tool selection errors (choosing inappropriate tools) and tool usage errors (misusing selected tools), plus malformed parameters and tool bypass behavior (simulating outputs instead of calling tools). Without proper tool gateways, these hallucinations cause production incidents.

## What Matters in Production (Facts Only)

### Tool Calling Fundamentals and Failure Modes

**What is Tool Calling (Function Calling)?**
Capability that allows LLMs to access external functions, APIs, and data sources. Developers define tools with names, descriptions, and JSON schema parameters. When model determines tool is necessary, it returns structured data specifying tool name and arguments for execution.

**Two Primary Use Cases:**
1. **Data fetching**: Retrieving real-time information (weather, currency conversion, database queries)
2. **Taking action**: Performing external operations (form submission, workflow orchestration, payment processing, data modification)

**Tool Hallucination Types (2026 Research):**

1. **Tool Selection Hallucination**: Choosing inappropriate tools for task
   - Example: Calling `delete_user` instead of `get_user` for user lookup
   - Example: Calling non-existent tool `send_sms_v2` when only `send_sms` exists

2. **Tool Usage Hallucination**: Misusing selected tools
   - Example: Calling `charge_card` with negative amount
   - Example: Calling `send_email` with invalid email format
   - Example: Missing required parameters or providing wrong data types

3. **Malformed Parameters**: Invalid JSON, wrong types, missing required fields
   - Example: Passing string "100" instead of integer 100
   - Example: Omitting required `user_id` parameter

4. **Tool Bypass Behavior**: Simulating outputs instead of calling tools
   - Example: LLM responds "I've sent the email" without actually calling `send_email`
   - Example: LLM fabricates data instead of calling `get_weather`

5. **Incorrect Tool Chaining**: Wrong sequence or dependencies
   - Example: Calling `process_payment` before `validate_card`
   - Example: Calling `send_confirmation` before `create_order` completes

**Production Impact (2026 Benchmark):**
- Tool-use hallucinations: Only 11.6% step localization accuracy for GPT-4 and Gemini-2.5-Pro
- Multi-step workflows: Hallucinations in one step propagate errors downstream
- AgentHallu benchmark: 693 trajectories across Planning, Retrieval, Reasoning, Human-Interaction, and Tool-Use categories

### Tool Gateway Architecture

**What is a Tool Gateway?**
Intermediary layer between LLM outputs and actual tool execution that enforces security, validates parameters, ensures idempotency, and provides observability. Gateway intercepts all tool calls from LLM, validates them against policies, and either executes or rejects them.

**Core Responsibilities:**
1. **Authorization**: Verify user/agent has permission to call tool
2. **Validation**: Validate tool exists, parameters match schema, values are valid
3. **Idempotency**: Ensure retries don't cause duplicate side effects
4. **Observability**: Log all tool calls with trace IDs for debugging
5. **Rate Limiting**: Prevent abuse, manage quotas
6. **Timeout Handling**: Cancel long-running tools, prevent resource exhaustion
7. **Error Handling**: Graceful failures, retry logic, compensating transactions

**Production Gateway Implementations (2026):**

**Gloo AI Gateway (Solo.io):**
- Kubernetes Gateway API integration
- Routes requests through gateway proxies with defined tools
- Production-ready for enterprise deployments

**Vercel AI Gateway:**
- Supports tool calling via OpenResponses API
- Tool choice options: `auto`, `required`, `none`
- Integrated with Vercel's edge infrastructure

**AssemblyAI LLM Gateway:**
- Part of Voice AI Platform
- Tool calling functionality for voice applications
- Production-grade observability

**TensorZero Gateway:**
- Tool use configuration for production deployments
- Supports multiple LLM providers
- Enterprise-grade reliability

### Authorization and Permissioning

**Core Problem:**
LLMs cannot be trusted to make authorization decisions. They hallucinate tool calls, ignore permission constraints in prompts, and can be prompt-injected to bypass security.

**Production Patterns (2025-2026):**

**LiteLLM Tool Permission Guardrail:**
- Provider-agnostic control over tool execution
- Configurable allow/deny rules with regex-based filtering
- Regex rules for tool names and types
- Restrict tool arguments with nested path validation (protecting sensitive parameters)
- Block or rewrite behavior for disallowed tools
- Customizable fallback decisions and violation messaging

**MiniScope Framework (Berkeley/IBM Research 2026):**
- Implements least privilege authorization
- Automatically reconstructs permission hierarchies reflecting relationships among tool calls
- Mobile-style permission model (user grants permissions explicitly)
- Only 1-6% latency overhead vs vanilla tool calling
- Significantly reduces operational costs and computational requirements
- Addresses LLM unreliability risks when agents operate on sensitive user services

**Key Principles:**
1. **Never delegate authorization to LLM**: Enforce in gateway code, not prompts
2. **Principle of least privilege**: Grant minimum permissions necessary
3. **Explicit permission grants**: User/admin explicitly grants tool access
4. **Permission hierarchy**: Tools can require permissions from other tools (e.g., `charge_card` requires `validate_card`)
5. **Audit trail**: Log all permission checks (granted, denied) with reasoning

**Production Example:**
```
Tool: charge_card
Required Permissions: payment.write, user.verified
User Permissions: payment.write
Gateway Decision: DENY (missing user.verified)
Logged: {trace_id, tool, required_perms, user_perms, decision, timestamp}
```

### Idempotency and Retry Safety

**Core Problem:**
Network failures, timeouts, and LLM retries can cause duplicate tool executions. Without idempotency, retries cause catastrophic failures: duplicate charges, duplicate emails, duplicate database writes.

**Why "Exactly-Once" is Impossible:**
In distributed systems, only "at-least-once" delivery is achievable. Idempotency makes "at-least-once" safe by ensuring operations produce same result regardless of execution count.

**Idempotency Key Pattern (Production Standard 2026):**

**Use stable step ID as idempotency key:**
- Each tool invocation has consistent `stepId` that remains unchanged across retries
- Pass this as idempotency key when calling external APIs (Stripe, payment processors, databases)
- Key ensures only one charge/action occurs even if step retries multiple times

**Implementation:**
```
idempotencyKey: stepId  // Unique per step, stable across retries
```

**Best Practices:**
1. **Always provide idempotency keys** for non-idempotent side effects (payments, emails, SMS, database writes)
2. **Keep keys deterministic**: Avoid timestamps or attempt counters
3. **Use execution names** as idempotency keys in serverless functions
4. **Handle 409 conflict responses gracefully**: Treat as successful completion of prior attempt
5. **Store idempotency keys**: Track which keys have been used to detect duplicates

**Production Example (AWS Lambda):**
When you provide execution name (idempotency key), Lambda safely handles duplicate invocation requests by returning existing execution information rather than creating duplicates.

**Idempotency Storage:**
- Store idempotency keys in database (PostgreSQL, Redis)
- Include: `{idempotency_key, tool_name, parameters_hash, result, timestamp, status}`
- On retry, check if key exists: if yes, return stored result; if no, execute and store

**Idempotency Window:**
- Keys expire after reasonable period (e.g., 24 hours)
- Prevents indefinite storage growth
- Balances safety with practicality

### Timeout Handling and Cancellation

**Core Problem:**
Tools can hang indefinitely (API timeouts, network issues, slow operations). Without timeout handling, resources are exhausted and calls never complete.

**Production Patterns (2025-2026):**

**Adaptive Timeouts:**
- Set different timeout values based on request complexity and type
- Base timeout (e.g., 5 seconds) adjusted by prompt type multipliers:
  - Simple queries: 1x (5s)
  - Code generation: 2x (10s)
  - Complex reasoning: 4x (20s)
- Estimated token counts factor into timeout calculation

**Progressive Timeouts:**
- Start with shorter initial timeouts, gradually extend on retries
- Use exponential backoff: initial 3s, max 25s, 1.8x multiplier per attempt
- Prevents indefinite waiting while allowing legitimate slow operations

**Cancellation Handling:**

**AbortSignal/Cancellation:**
- Use AbortSignal mechanisms to gracefully cancel long-running operations
- In LangChain: Set `max_execution_time` parameters to cap agent execution
- Early stopping methods: `force` (immediate stop) or `generate` (one final LLM pass)

**Prediction Cancellation:**
- Native cancellation methods for in-flight predictions (LM Studio pattern)
- Cancel tool execution when user interrupts conversation
- Cleanup resources (database connections, file handles, network sockets)

**Queue Offloading for Long-Running Tasks:**
- For tasks exceeding standard timeouts (55s in Forge), offload to queue consumers
- Queue consumers support up to 15-minute execution times
- Stream results back via pub/sub mechanisms to keep UIs responsive
- Secure channels with unique custom claims and tokens

**Production Timeout Configuration:**
- Data fetching tools: 5-10s timeout
- Computation tools: 10-30s timeout
- Action tools (payment, email): 15-30s timeout
- Long-running tasks: Offload to queue, 5-15 minute timeout

### Rate Limiting and Quota Management

**Core Problem:**
Without rate limiting, tools can be abused (intentionally or via LLM hallucination loops), exhausting quotas, causing service outages, and incurring excessive costs.

**Rate Limits vs Quotas:**
- **Rate limits**: Control requests within specific time windows (requests per minute, tokens per minute)
- **Quotas**: Total allowances over longer periods (typically monthly)
- Both constraints work together—exceeding either causes request failures

**Production Patterns (2026):**

**Token-Aware Rate Limiting:**
- Plain request limits fail for LLMs because work varies significantly per request
- Token-aware rate limiting is critical:
  - Prompt tokens per minute (protects prefill)
  - Output tokens per minute (protects decode throughput)
  - Total token limits per minute/hour/day
  - Concurrency caps per key/user

**Hierarchical Limits:**
- Set limits across multiple layers: Key → User → App → Organization → Global
- Tightest applicable limit wins
- Example: User has 100 req/min, but app has 50 req/min → effective limit is 50 req/min

**Client-Side Implementation:**
- Implement rate limiting in application code as first defense
- Use token bucket algorithms to control request distribution
- Queue requests when approaching limits
- Backoff when 429 errors received

**Error Handling:**
- Implement exponential backoff and retry logic for 429 resource exhaustion errors
- Libraries like tenacity (Python) simplify implementation
- Add jitter (randomization) to retry delays to prevent thundering herd

**Configuration Optimization:**
- Reduce `max_completion_tokens` to match actual completion sizes
- Optimize prompts to be concise
- Increase usage tiers if needed to raise rate limits
- Monitor usage patterns, adjust limits proactively

**Production Example:**
```
Tool: get_weather
Rate Limit: 100 calls/minute per user
Current Usage: 95 calls in last minute
Gateway Decision: ALLOW (5 calls remaining)
Response Header: X-RateLimit-Remaining: 5
```

### Schema Validation and Output Enforcement

**Core Problem:**
LLM outputs are unpredictable—they frequently fail to follow expected formats, produce schema drift (incorrect field names, wrong data types), and return incomplete data. These failures cascade in production, causing crashes and data corruption.

**Production Patterns (2025-2026):**

**Post-Processing with Schema Validators:**
- Pydantic is standard Python library for validating LLM outputs after generation
- Combines type hints with runtime validation for production reliability
- Validates tool parameters before execution, tool results before returning to LLM

**Structured Output Enforcement:**
- Modern approaches directly constrain model outputs using JSON schemas, regular expressions, grammar-based constraints, predefined choices
- Ray Serve LLM and vLLM provide native support for structured output patterns
- Minimizes post-processing needs, guarantees schema compliance

**Safety Frameworks:**
- OpenAI Guardrails: Drop-in replacement for standard clients with automatic validation
- Validation stages: Input (pre-flight), output (post-generation), tool (pre/post-execution)
- Built-in checks: Content safety, data protection (PII), content quality (hallucination detection)

**PROMPTEVALS Dataset (2025):**
- 2,087 LLM pipeline prompts with 12,623 assertion criteria from production systems
- Fine-tuned open-source models (Mistral, Llama 3) outperform GPT-4o by 20.93% on generating relevant assertions
- Reduced latency for production deployments

**Validation Layers:**
1. **Tool existence**: Does tool exist in registry?
2. **Parameter schema**: Do parameters match JSON schema?
3. **Parameter values**: Are values valid (e.g., email format, positive numbers)?
4. **Business rules**: Do parameters satisfy business constraints (e.g., amount < credit limit)?
5. **Result schema**: Does tool result match expected schema?

**Production Example:**
```
Tool: charge_card
Schema: {amount: number (>0), currency: string, card_id: string (UUID)}
LLM Output: {amount: "100", currency: "USD", card_id: "abc"}
Validation: FAIL (amount is string, not number; card_id is not UUID)
Gateway: REJECT, return error to LLM
```

### Security, Sandboxing, and Isolation

**Core Problem:**
Tool-augmented LLM agents introduce significant security risks: prompt injection, unintended exposure of external inputs (environment secrets, local files), tool poisoning, data-driven exfiltration, cross-system privilege escalation. Traditional static analysis is insufficient because obfuscated filesystem access and runtime file-derived secrets remain invisible.

**Production Patterns (2026):**

**WebAssembly/WASI Sandboxing:**
- MCP-SandboxScan uses WebAssembly-based sandboxing to safely execute untrusted tools in isolated environments
- Lightweight and capability-restricted, suitable for analyzing tool behavior without exposing host system
- Collects runtime artifacts for security analysis

**OS-Level Sandboxing:**
- Anthropic's sandbox-runtime provides lightweight OS-level sandboxing
- Enforces filesystem and network restrictions on arbitrary processes without requiring containers
- Suitable for production deployments with minimal overhead

**Container-Based Isolation:**
- CAMEL's runtime module supports Docker-based isolation for reproducible, sandboxed tool execution
- Guardrail-based risk scoring
- Remote cloud sandbox options for untrusted tools

**Production Security Controls (2026 Best Practices):**
1. **Per-user authentication with scoped authorization**: Each user has explicit permissions
2. **Provenance tracking across agent workflows**: Track which agent/user invoked which tool
3. **Containerized sandboxing with input/output checks**: Validate all data crossing sandbox boundary
4. **Inline policy enforcement**: Data loss prevention (DLP) and anomaly detection
5. **Centralized governance**: Private registries or gateway layers for tool management

**IsolateGPT Architecture:**
- Comprehensive isolation architecture addressing natural language-based interaction model
- Protects against security and privacy risks
- Minimal performance overhead (under 30% for three-quarters of tested queries)

**Isolation Boundaries:**
1. **Network isolation**: Tools cannot access arbitrary URLs, only allowlisted endpoints
2. **Filesystem isolation**: Tools cannot access arbitrary files, only specific directories
3. **Environment isolation**: Tools cannot access environment variables (secrets)
4. **Process isolation**: Tools run in separate processes, cannot interfere with each other
5. **Resource isolation**: Tools have CPU/memory limits, cannot exhaust resources

### Observability and Execution Tracing

**Core Problem:**
Without observability, cannot debug tool execution failures, cannot audit security incidents, cannot optimize performance. Traditional logging insufficient—need distributed tracing across LLM → Gateway → Tool → Result.

**Production Patterns (2026):**

**Five-Layer Observability Stack (Hamming.ai):**
1. **Audio Pipeline**: Track audio quality, frame drops, buffer underruns
2. **STT Processing**: Transcription latency, confidence scores, word error rate
3. **LLM Inference**: Token latency, prompt/completion tokens, model version
4. **TTS Generation**: Synthesis latency, audio duration, voice ID
5. **End-to-End Trace**: Correlation IDs across all layers with total latency breakdown

**Tool Execution Layer (Added to Stack):**
- **Tool invocation**: Tool name, parameters, user/agent, timestamp
- **Authorization check**: Permissions required, permissions granted, decision (allow/deny)
- **Validation**: Schema validation result, business rule validation result
- **Execution**: Tool latency, result, status (success/error), idempotency key
- **Rate limiting**: Current usage, limit, remaining quota

**Trace Propagation:**
- Generate trace ID at audio capture (call start)
- Propagate through all API calls: STT → LLM → Gateway → Tool → LLM → TTS
- Include trace ID in all logs, metrics, tool invocations
- Expect 1-5% latency overhead from tracing instrumentation

**Production Observability Solutions:**

**Langfuse (Open Source):**
- Distributed tracing with trace IDs, sessions, user tracking
- Multi-modality support for LLM observability
- Tool execution tracking with parameters and results

**MLflow Tracing:**
- OpenTelemetry-compatible solution
- Captures inputs, outputs, metadata across request steps
- Useful throughout ML lifecycle from development to production monitoring

**Laminar:**
- Purpose-built for AI agents
- First-class support for tool execution, LangChain, browser agents
- Live tracing and natural language pattern detection

**Datadog LLM Observability:**
- Enterprise-grade monitoring for LLM applications
- Tool execution metrics, traces, logs
- Alerting and anomaly detection

**Tool Execution Logging (Required Fields):**
```json
{
  "trace_id": "uuid",
  "tool_name": "charge_card",
  "tool_call_id": "uuid",
  "parameters": {"amount": 100, "currency": "USD", "card_id": "uuid"},
  "parameters_hash": "sha256",
  "idempotency_key": "uuid",
  "user_id": "uuid",
  "agent_id": "uuid",
  "authorization": {"required": ["payment.write"], "granted": ["payment.write"], "decision": "allow"},
  "validation": {"schema": "pass", "business_rules": "pass"},
  "rate_limit": {"current": 95, "limit": 100, "remaining": 5},
  "execution": {
    "started_at": "timestamp",
    "completed_at": "timestamp",
    "latency_ms": 1234,
    "status": "success",
    "result": {"transaction_id": "uuid", "status": "completed"},
    "error": null
  }
}
```

**Replay and Debugging:**
- Store all tool executions in database with full context
- Provide replay capability: Given trace ID, can replay tool execution with same parameters
- Useful for debugging: Can reproduce production issues locally
- Useful for testing: Can test tool execution with real production parameters

### Pipecat-Specific Patterns

**Pipecat Function Calling Components:**

**FunctionCallParams:**
- Parameters for function calls including function name, tool call ID, arguments, LLM context, result callback
- Passed to function handler for execution

**FunctionCallHandler:**
- Callable that processes LLM function calls asynchronously
- Registered with LLM service for specific tools
- Returns result to LLM via callback

**FunctionCallResultCallback:**
- Protocol for handling function call results
- Enables async result processing
- Supports streaming results back to LLM

**FunctionCallRegistryItem:**
- Registry entries for function handlers
- Includes interrupt cancellation options: `cancel_on_interruption` flag
- When user interrupts, can cancel in-flight tool execution

**Production Pattern for Pipecat:**
1. **Register tools** with LLM service using FunctionCallRegistryItem
2. **Implement gateway** as middleware between LLM and tool handlers
3. **Gateway intercepts** FunctionCallParams before execution
4. **Gateway validates**: Authorization, schema, rate limits, idempotency
5. **Gateway executes** tool handler if validation passes
6. **Gateway logs** execution with trace ID
7. **Gateway returns** result via FunctionCallResultCallback

**Interruption Handling:**
- Set `cancel_on_interruption: true` for interruptible tools (data fetching)
- Set `cancel_on_interruption: false` for non-interruptible tools (payment processing)
- On user interruption, Pipecat cancels interruptible tools automatically
- Gateway must handle cancellation gracefully: cleanup resources, log cancellation

**Example Integration:**
```
Pipecat Pipeline:
Transport → STT → LLM → Tool Gateway → Tool Handler → LLM → TTS → Transport

Tool Gateway responsibilities:
- Intercept FunctionCallParams from LLM
- Validate authorization, schema, rate limits
- Check idempotency key
- Execute tool handler if valid
- Log execution with trace ID
- Return result via callback
```

## Common Failure Modes (Observed in Real Systems)

### 1. Hallucinated Tool Calls Without Validation
**Symptom**: LLM calls non-existent tools or tools with invalid parameters. System crashes or executes wrong actions.

**Root cause**: No tool gateway. Tool calls executed directly from LLM output without validation.

**Production impact**: 5-10% of tool calls are hallucinated (2026 research). Without validation, these cause crashes, data corruption, or unauthorized actions.

**Observed in**: Systems without tool gateway, systems trusting LLM outputs directly.

**Mitigation**:
- Implement tool gateway that validates all tool calls
- Check tool exists in registry before execution
- Validate parameters against JSON schema
- Reject hallucinated tools with clear error message to LLM

---

### 2. Duplicate Tool Executions from Retries
**Symptom**: After network timeout, tool is retried. User is charged twice, receives duplicate emails, or experiences other duplicate side effects.

**Root cause**: No idempotency. Retries execute tool again without checking if already completed.

**Production impact**: 5-10% of retried operations cause duplicate side effects without idempotency.

**Observed in**: Systems without idempotency keys, systems with naive retry logic.

**Mitigation**:
- Implement idempotency keys for all tools with side effects
- Use stable step ID as idempotency key
- Store idempotency keys in database with results
- On retry, check if key exists: if yes, return stored result; if no, execute

---

### 3. Unauthorized Tool Executions
**Symptom**: User without payment permission triggers `charge_card`. Agent without admin permission triggers `delete_user`. Security incidents, compliance violations.

**Root cause**: Authorization delegated to LLM prompts instead of enforced in gateway code. LLM ignores authorization constraints or is prompt-injected to bypass.

**Production impact**: 2-5% of tool calls violate authorization without gateway enforcement.

**Observed in**: Systems without tool gateway, systems delegating authorization to LLM.

**Mitigation**:
- Never delegate authorization to LLM—enforce in gateway code
- Implement permission system: tools require permissions, users have permissions
- Gateway checks permissions before execution, rejects if insufficient
- Log all authorization decisions (granted, denied) with reasoning

---

### 4. Tool Execution Without Observability
**Symptom**: Tool fails in production but cannot debug. Logs show LLM called tool but not what happened during execution. Cannot reproduce issue.

**Root cause**: No tool execution logging. No trace IDs. Cannot correlate tool execution with conversation.

**Production impact**: Mean time to debug (MTTD): 2-4 hours without observability. Cannot identify why tool failed or what parameters were used.

**Observed in**: Systems without distributed tracing, systems logging only LLM inputs/outputs.

**Mitigation**:
- Log every tool execution with trace ID, parameters, result, latency, status
- Include authorization check, validation result, rate limit status
- Use structured logging (JSON) with consistent fields
- Provide replay capability: can reproduce tool execution with same parameters

---

### 5. Tool Execution Hangs Indefinitely
**Symptom**: Tool call never completes. Conversation hangs. Resources never released. User must hang up.

**Root cause**: No timeout handling. Tool execution can run indefinitely.

**Production impact**: 2-5% of tool calls hang without timeout handling. Resource leaks, poor user experience.

**Observed in**: Systems without timeout configuration, systems without cancellation handling.

**Mitigation**:
- Define timeout for every tool (data fetching: 5-10s, computation: 10-30s, actions: 15-30s)
- Implement progressive timeouts with exponential backoff on retries
- Use AbortSignal/cancellation mechanisms for graceful cancellation
- Cleanup resources (connections, file handles) on timeout

---

### 6. Rate Limit Exhaustion from Tool Loops
**Symptom**: LLM enters loop calling same tool repeatedly. Exhausts rate limits, causes service outage, incurs excessive costs.

**Root cause**: No rate limiting. LLM can call tools unlimited times.

**Production impact**: 1-2% of conversations enter tool loops without rate limiting. Can exhaust monthly quotas in hours.

**Observed in**: Systems without rate limiting, systems without loop detection.

**Mitigation**:
- Implement rate limiting: requests per minute, tokens per minute, concurrency limits
- Use hierarchical limits: Key → User → App → Organization → Global
- Detect tool loops: if same tool called 3+ times in row with same parameters, stop and prompt user
- Monitor usage patterns, alert on anomalies

---

### 7. Schema Validation Failures
**Symptom**: LLM provides tool parameters with wrong types (string instead of number), missing required fields, or invalid values. Tool execution fails with cryptic errors.

**Root cause**: No schema validation. Tool parameters passed directly to tool without validation.

**Production impact**: 10-20% of tool calls have schema validation issues without enforcement.

**Observed in**: Systems without schema validation, systems trusting LLM to follow schemas.

**Mitigation**:
- Define JSON schema for every tool
- Validate parameters against schema before execution
- Check types, required fields, value constraints (e.g., positive numbers, email format)
- Return clear error message to LLM if validation fails, allow retry

---

### 8. Tool Execution Without Sandboxing
**Symptom**: Malicious or buggy tool accesses environment secrets, reads arbitrary files, makes unauthorized network requests. Security incidents, data leakage.

**Root cause**: No sandboxing. Tools run with full system access.

**Production impact**: High-severity security incidents. Difficult to quantify frequency but catastrophic when occurs.

**Observed in**: Systems without sandboxing, systems running tools in main process.

**Mitigation**:
- Implement sandboxing: WebAssembly/WASI, OS-level (Anthropic sandbox-runtime), or container-based (Docker)
- Enforce isolation boundaries: network (allowlisted URLs only), filesystem (specific directories only), environment (no access to secrets)
- Use principle of least privilege: grant minimum permissions necessary
- Monitor sandbox violations, alert on suspicious behavior

---

### 9. Tool Results Not Validated
**Symptom**: Tool returns malformed result. LLM processes invalid data, generates incorrect response, or crashes.

**Root cause**: No result validation. Tool results passed directly to LLM without validation.

**Production impact**: 5-10% of tool results have validation issues without enforcement.

**Observed in**: Systems without result schema validation, systems trusting tools to return valid data.

**Mitigation**:
- Define JSON schema for tool results
- Validate results against schema before returning to LLM
- Check types, required fields, value constraints
- If validation fails, return error to LLM instead of malformed result

---

### 10. Tool Execution Not Cancellable on Interruption
**Symptom**: User interrupts conversation mid-tool-execution. Tool continues running, wasting resources. User charged for completed action they didn't want.

**Root cause**: No cancellation handling. Tools cannot be cancelled once started.

**Production impact**: 10-20% of conversations have interruptions. Without cancellation, these waste resources and may execute unwanted actions.

**Observed in**: Systems without interruption handling, systems without `cancel_on_interruption` flag.

**Mitigation**:
- Implement cancellation handling: Use AbortSignal, check cancellation flag periodically
- For Pipecat: Set `cancel_on_interruption: true` for interruptible tools
- Cleanup resources on cancellation: close connections, rollback transactions
- Log cancellation events with trace ID

## Proven Patterns & Techniques

### 1. Tool Gateway with Defense-in-Depth Validation
**Pattern**: Implement tool gateway as intermediary layer between LLM and tool execution. Gateway enforces multiple validation layers: authorization, schema, business rules, rate limits, idempotency.

**Implementation**:
- Gateway intercepts all tool calls from LLM
- Validation layers (in order):
  1. Tool existence: Does tool exist in registry?
  2. Authorization: Does user/agent have permission?
  3. Schema validation: Do parameters match JSON schema?
  4. Business rules: Do parameters satisfy constraints?
  5. Rate limiting: Is user within quota?
  6. Idempotency: Has this tool call been executed before?
- If any validation fails, reject and return error to LLM
- If all validations pass, execute tool and log execution

**Benefits**:
- **Security**: Prevents unauthorized tool executions
- **Reliability**: Prevents hallucinated tool calls from causing damage
- **Debuggability**: Full audit trail of all tool executions
- **Cost control**: Rate limiting prevents quota exhaustion

**Production examples**:
- LiteLLM Tool Permission Guardrail: Regex-based allow/deny rules
- MiniScope Framework: Least privilege authorization with 1-6% overhead
- OpenAI Guardrails: Input/output/tool validation

**When to use**: All production systems with tool calling. Required for V1 to ensure safe tool execution.

---

### 2. Idempotency Keys for All Side-Effect Tools
**Pattern**: Generate stable idempotency key for each tool invocation. Store key with result in database. On retry, check if key exists: if yes, return stored result; if no, execute and store.

**Implementation**:
- Generate idempotency key: Use stable step ID (UUID) that remains unchanged across retries
- Before tool execution, check database for key
- If key exists: Return stored result (idempotent retry)
- If key doesn't exist: Execute tool, store key + result, return result
- Idempotency keys expire after 24 hours (configurable)

**Benefits**:
- **Safety**: Retries don't cause duplicate side effects (double charges, duplicate emails)
- **Cost savings**: Don't re-execute expensive operations
- **User experience**: Retries are transparent to user

**Production examples**:
- AWS Lambda: Execution name as idempotency key
- Stripe API: Idempotency keys for payment operations
- Production standard: stepId as idempotency key

**When to use**: All tools with side effects (payments, emails, SMS, database writes). Required for V1 to ensure retry safety.

---

### 3. Hierarchical Permission System with Least Privilege
**Pattern**: Implement permission system where tools require permissions, users have permissions. Gateway enforces least privilege: grant minimum permissions necessary.

**Implementation**:
- Define permissions for each tool (e.g., `charge_card` requires `payment.write` and `user.verified`)
- Users/agents have explicit permission grants (e.g., user has `payment.write` but not `user.verified`)
- Gateway checks permissions before execution: if user has all required permissions, allow; else deny
- Permission hierarchy: Some tools require permissions from other tools (e.g., `refund_card` requires `charge_card` permission)
- Log all permission checks with reasoning

**Benefits**:
- **Security**: Prevents unauthorized actions
- **Auditability**: Full trail of permission checks
- **Flexibility**: Can grant/revoke permissions per user without code changes

**Production examples**:
- MiniScope Framework: Automatic permission hierarchy reconstruction, 1-6% overhead
- LiteLLM: Regex-based permission rules
- Mobile-style permission model: User explicitly grants permissions

**When to use**: All production systems with sensitive tools (payment, data modification, PII access). Required for V1 to ensure authorization.

---

### 4. Adaptive Timeouts with Progressive Backoff
**Pattern**: Set different timeout values based on tool complexity. On retry, progressively increase timeout with exponential backoff.

**Implementation**:
- Define base timeout per tool type:
  - Data fetching: 5-10s
  - Computation: 10-30s
  - Actions: 15-30s
- On first attempt, use base timeout
- On retry, increase timeout: `timeout = base * (1.8 ^ attempt_number)`, max 25s
- Add jitter (randomization) to prevent thundering herd
- After N timeouts (typically 3), fail permanently or escalate

**Benefits**:
- **Reliability**: Handles transient slowness without failing immediately
- **Resource management**: Prevents indefinite waiting
- **User experience**: Gives legitimate slow operations time to complete

**Production examples**:
- Adaptive timeouts: Base 5s, multipliers by complexity (1x, 2x, 4x)
- Progressive timeouts: Initial 3s, max 25s, 1.8x multiplier per retry
- Production standard: 3 retries with exponential backoff

**When to use**: All production systems with tool calling. Required for V1 to handle timeouts gracefully.

---

### 5. Token-Aware Rate Limiting with Hierarchical Limits
**Pattern**: Implement rate limiting based on tokens (not just requests) with limits at multiple levels (key, user, app, org, global).

**Implementation**:
- Define limits at multiple levels:
  - Key: 100 req/min, 10k tokens/min
  - User: 500 req/min, 50k tokens/min
  - App: 1000 req/min, 100k tokens/min
  - Organization: 5000 req/min, 500k tokens/min
  - Global: 10000 req/min, 1M tokens/min
- On tool call, check all applicable limits
- Tightest limit wins (e.g., if user has 500 req/min but key has 100 req/min, effective limit is 100 req/min)
- Track usage in Redis (fast access, sub-100ms latency)
- Return 429 error with retry-after header if limit exceeded

**Benefits**:
- **Cost control**: Prevents quota exhaustion
- **Fairness**: Prevents single user from monopolizing resources
- **Flexibility**: Can adjust limits per user/app without code changes

**Production examples**:
- Token-aware limiting: Prompt tokens/min, output tokens/min, total tokens/min
- Hierarchical limits: Key → User → App → Org → Global
- Production standard: Track usage in Redis, 429 errors with exponential backoff

**When to use**: All production systems with tool calling. Required for V1 to prevent abuse and manage costs.

---

### 6. Schema Validation with Structured Output Enforcement
**Pattern**: Define JSON schema for tool parameters and results. Validate against schema before execution and after completion.

**Implementation**:
- Define JSON schema for each tool:
  - Parameter schema: Types, required fields, value constraints
  - Result schema: Types, required fields, value constraints
- Before tool execution: Validate parameters with Pydantic
- If validation fails: Return clear error to LLM, allow retry
- After tool execution: Validate result with Pydantic
- If validation fails: Return error to LLM instead of malformed result

**Benefits**:
- **Reliability**: Prevents crashes from malformed data
- **Debuggability**: Clear error messages when validation fails
- **Type safety**: Catches type errors before execution

**Production examples**:
- Pydantic: Standard Python library for schema validation
- OpenAI Structured Outputs: Native schema enforcement (100% compliance)
- Ray Serve LLM: Structured output patterns

**When to use**: All production systems with tool calling. Required for V1 to ensure data quality.

---

### 7. Sandboxed Tool Execution with Isolation Boundaries
**Pattern**: Execute tools in sandboxed environment with enforced isolation boundaries (network, filesystem, environment, process, resource).

**Implementation**:
- Choose sandboxing approach:
  - WebAssembly/WASI: Lightweight, capability-restricted
  - OS-level (Anthropic sandbox-runtime): Filesystem and network restrictions
  - Container-based (Docker): Full isolation, reproducible
- Enforce isolation boundaries:
  - Network: Allowlist URLs only, block arbitrary access
  - Filesystem: Specific directories only, block arbitrary access
  - Environment: No access to secrets, block env vars
  - Process: Separate process, cannot interfere with others
  - Resource: CPU/memory limits, prevent exhaustion
- Monitor sandbox violations, alert on suspicious behavior

**Benefits**:
- **Security**: Prevents malicious tools from accessing sensitive data
- **Reliability**: Buggy tools cannot crash main process
- **Auditability**: Can analyze tool behavior in isolated environment

**Production examples**:
- MCP-SandboxScan: WebAssembly-based sandboxing for security analysis
- Anthropic sandbox-runtime: OS-level sandboxing without containers
- CAMEL: Docker-based isolation with guardrail-based risk scoring

**When to use**: All production systems with untrusted tools or sensitive data. Required for V1 to ensure security.

---

### 8. Distributed Tracing with Tool Execution Logging
**Pattern**: Log every tool execution with trace ID, parameters, result, latency, status. Enable end-to-end tracing from conversation to tool execution.

**Implementation**:
- Generate trace ID at call start (audio capture)
- Propagate trace ID through all components: STT → LLM → Gateway → Tool
- Log tool execution with full context:
  - Trace ID, tool name, tool call ID
  - Parameters, parameters hash, idempotency key
  - User ID, agent ID
  - Authorization check (required perms, granted perms, decision)
  - Validation result (schema, business rules)
  - Rate limit status (current, limit, remaining)
  - Execution (started, completed, latency, status, result, error)
- Store logs in database for replay and debugging
- Provide dashboard for viewing tool executions per trace ID

**Benefits**:
- **Debuggability**: Can trace single call through entire system
- **Auditability**: Full trail of all tool executions
- **Replay**: Can reproduce tool execution with same parameters

**Production examples**:
- Hamming.ai: Five-layer observability stack with correlation IDs
- Langfuse: Distributed tracing with tool execution tracking
- MLflow Tracing: OpenTelemetry-compatible solution

**When to use**: All production systems. Required for V1 to enable debugging and incident response.

---

### 9. Cancellation Handling with Resource Cleanup
**Pattern**: Implement cancellation for long-running tools. On user interruption or timeout, cancel tool execution and cleanup resources.

**Implementation**:
- For Pipecat: Set `cancel_on_interruption` flag per tool
  - Interruptible tools (data fetching): `cancel_on_interruption: true`
  - Non-interruptible tools (payment): `cancel_on_interruption: false`
- Implement cancellation in tool handler:
  - Check cancellation flag periodically
  - Use AbortSignal for graceful cancellation
  - Cleanup resources on cancellation: close connections, rollback transactions, release locks
- Log cancellation events with trace ID
- Return cancellation status to LLM (don't treat as error)

**Benefits**:
- **Resource management**: Prevents resource leaks
- **User experience**: Interruptions are handled gracefully
- **Cost control**: Don't waste resources on cancelled operations

**Production examples**:
- Pipecat: `cancel_on_interruption` flag in FunctionCallRegistryItem
- AbortSignal: Standard cancellation mechanism
- LangChain: `max_execution_time` with early stopping

**When to use**: All production systems with long-running tools. Required for V1 to handle interruptions gracefully.

---

### 10. Idempotency with Replay Capability
**Pattern**: Store all tool executions with idempotency keys. Provide replay capability: given trace ID, can replay tool execution with same parameters.

**Implementation**:
- Store tool executions in database:
  - Idempotency key, tool name, parameters, parameters hash
  - Trace ID, user ID, agent ID
  - Result, status, timestamp
- On retry with same idempotency key: Return stored result
- Provide replay API: Given trace ID, return all tool executions
- Provide replay functionality: Can re-execute tool with same parameters for debugging

**Benefits**:
- **Debuggability**: Can reproduce production issues locally
- **Testing**: Can test tools with real production parameters
- **Auditability**: Full history of all tool executions

**Production examples**:
- Idempotency storage: PostgreSQL, Redis
- Replay capability: Langfuse, MLflow Tracing
- Production standard: Store executions for 30 days

**When to use**: All production systems. Required for V1 to enable debugging and testing.

## Engineering Rules (Binding)

### R1: All Tool Calls MUST Pass Through Tool Gateway
**Rule**: All tool calls from LLM MUST be intercepted by tool gateway before execution. No direct tool execution from LLM outputs.

**Rationale**: Without gateway, hallucinated tool calls (5-10% of calls) cause crashes, unauthorized actions, or data corruption.

**Implementation**: Implement gateway as middleware between LLM and tool handlers. Gateway intercepts FunctionCallParams, validates, and executes or rejects.

**Verification**: Code review must verify no direct tool execution. All tools registered through gateway.

---

### R2: Tool Gateway MUST Validate Tool Existence and Authorization
**Rule**: Before tool execution, gateway MUST validate: (1) Tool exists in registry, (2) User/agent has required permissions.

**Rationale**: Prevents hallucinated tool calls and unauthorized actions. 2-5% of tool calls violate authorization without enforcement.

**Implementation**: Gateway checks tool registry, checks user permissions against tool requirements, rejects if validation fails.

**Verification**: Test hallucinated tool calls (should be rejected). Test unauthorized tool calls (should be rejected).

---

### R3: All Side-Effect Tools MUST Use Idempotency Keys
**Rule**: Tools with side effects (payments, emails, SMS, database writes) MUST use idempotency keys. Gateway checks key before execution: if exists, return stored result; if not, execute and store.

**Rationale**: Without idempotency, retries cause duplicate side effects (5-10% of retries). Aligns with production standard.

**Implementation**: Generate stable step ID as idempotency key. Store in PostgreSQL with result. Check before execution.

**Verification**: Test retry scenarios. Verify no duplicate side effects.

---

### R4: Tool Parameters MUST Be Validated Against JSON Schema
**Rule**: Before tool execution, gateway MUST validate parameters against JSON schema: types, required fields, value constraints.

**Rationale**: 10-20% of tool calls have schema validation issues without enforcement. Prevents crashes from malformed data.

**Implementation**: Define JSON schema for each tool. Use Pydantic for validation. Reject if validation fails, return error to LLM.

**Verification**: Test invalid parameters (wrong types, missing fields). Verify rejected with clear error.

---

### R5: Tool Execution MUST Have Timeouts
**Rule**: Every tool execution MUST have timeout: data fetching 5-10s, computation 10-30s, actions 15-30s. On timeout, cancel execution and cleanup resources.

**Rationale**: Without timeouts, 2-5% of tool calls hang indefinitely. Causes resource leaks, poor user experience.

**Implementation**: Set timeout per tool type. Use progressive timeouts with exponential backoff on retries. Implement cancellation with AbortSignal.

**Verification**: Test timeout scenarios (slow tool, network failure). Verify cancellation and cleanup.

---

### R6: Tool Execution MUST Be Rate Limited
**Rule**: Tool execution MUST be rate limited: requests per minute, tokens per minute, concurrency limits. Use hierarchical limits (key, user, app, org, global).

**Rationale**: Without rate limiting, tool loops exhaust quotas (1-2% of conversations). Causes service outages, excessive costs.

**Implementation**: Track usage in Redis. Check limits before execution. Return 429 error if exceeded. Implement exponential backoff on retries.

**Verification**: Test rate limit scenarios. Verify 429 errors and backoff.

---

### R7: Tool Execution MUST Be Logged with Trace ID
**Rule**: Every tool execution MUST be logged with: trace ID, tool name, parameters, result, latency, status, authorization check, validation result, rate limit status.

**Rationale**: Without logging, cannot debug tool execution failures (MTTD: 2-4 hours). Cannot audit security incidents.

**Implementation**: Log to PostgreSQL with structured format (JSON). Include all required fields. Propagate trace ID from call start.

**Verification**: Trace single call through logs. Verify can see all tool executions.

---

### R8: Tool Results MUST Be Validated Against Schema
**Rule**: After tool execution, gateway MUST validate result against JSON schema: types, required fields, value constraints. If validation fails, return error to LLM instead of malformed result.

**Rationale**: 5-10% of tool results have validation issues without enforcement. Prevents LLM from processing invalid data.

**Implementation**: Define result schema for each tool. Use Pydantic for validation. Return error if validation fails.

**Verification**: Test invalid results (wrong types, missing fields). Verify error returned to LLM.

---

### R9: Sensitive Tools MUST Be Sandboxed
**Rule**: Tools that access external APIs, databases, or filesystems MUST be executed in sandboxed environment with enforced isolation boundaries (network, filesystem, environment).

**Rationale**: Without sandboxing, malicious tools can access secrets, read arbitrary files, make unauthorized requests. High-severity security risk.

**Implementation**: Use OS-level sandboxing (Anthropic sandbox-runtime) or container-based (Docker). Enforce allowlists for URLs, directories.

**Verification**: Test sandbox violations (attempt to access blocked resources). Verify blocked and logged.

---

### R10: Interruptible Tools MUST Be Cancellable
**Rule**: Tools marked as interruptible MUST implement cancellation handling. On user interruption, cancel execution and cleanup resources.

**Rationale**: Without cancellation, 10-20% of interruptions waste resources and may execute unwanted actions.

**Implementation**: For Pipecat, set `cancel_on_interruption: true` for interruptible tools. Implement cancellation in tool handler with AbortSignal.

**Verification**: Test interruption scenarios. Verify cancellation and cleanup.

---

### R11: Tool Gateway MUST Enforce Business Rules
**Rule**: Gateway MUST validate business rules before tool execution: amount < credit limit, user is verified, card is valid, etc.

**Rationale**: Business rules cannot be delegated to LLM. Must be enforced in code.

**Implementation**: Define business rules per tool. Gateway checks rules before execution. Reject if rules violated.

**Verification**: Test business rule violations. Verify rejected with clear error.

---

### R12: Tool Execution MUST Support Replay
**Rule**: All tool executions MUST be stored with full context (parameters, result, status). Provide replay capability: given trace ID, can replay tool execution with same parameters.

**Rationale**: Enables debugging production issues, testing with real parameters, auditing security incidents.

**Implementation**: Store executions in PostgreSQL for 30 days. Provide replay API. Implement replay functionality.

**Verification**: Replay tool execution from production. Verify same result.

---

### R13: Tool Gateway MUST Return Structured Errors
**Rule**: When tool execution fails (validation, authorization, timeout, error), gateway MUST return structured error to LLM: error type, error message, retry guidance.

**Rationale**: Enables LLM to handle errors gracefully, retry with corrected parameters, or inform user.

**Implementation**: Define error types (validation_error, authorization_error, timeout_error, execution_error). Return structured error with type, message, retry guidance.

**Verification**: Test error scenarios. Verify structured errors returned to LLM.

---

### R14: Tool Execution MUST Track Idempotency Key Usage
**Rule**: Gateway MUST track which idempotency keys have been used. On duplicate key with different parameters, reject as potential attack or bug.

**Rationale**: Duplicate keys with different parameters indicate bug or malicious behavior. Must be detected and prevented.

**Implementation**: Store idempotency keys with parameters hash. On duplicate key, check if parameters match. If not, reject.

**Verification**: Test duplicate key with different parameters. Verify rejected.

---

### R15: Tool Gateway MUST Support Tool Versioning
**Rule**: Tools MUST be versioned. Gateway MUST support multiple versions of same tool. LLM specifies tool version in call.

**Rationale**: Enables gradual rollout of tool changes, backward compatibility, A/B testing.

**Implementation**: Tools registered with version (e.g., `charge_card_v1`, `charge_card_v2`). Gateway routes to correct version based on LLM call.

**Verification**: Test multiple versions of same tool. Verify correct version executed.

## Metrics & Signals to Track

### Tool Execution Metrics
- **Tool call rate**: Number of tool calls per conversation (typical: 2-5)
- **Tool call latency**: P50/P95/P99 time from LLM call to tool result (target: P95 <2s)
- **Tool success rate**: Percentage of tool calls that complete successfully (target: >95%)
- **Tool error rate**: Percentage of tool calls that fail (target: <5%)
- **Tool timeout rate**: Percentage of tool calls that timeout (target: <2%)

### Validation Metrics
- **Hallucinated tool rate**: Percentage of tool calls for non-existent tools (target: 0%)
- **Schema validation failure rate**: Percentage of tool calls with invalid parameters (typical: 10-20% without enforcement)
- **Authorization failure rate**: Percentage of tool calls rejected due to insufficient permissions (typical: 2-5%)
- **Business rule violation rate**: Percentage of tool calls violating business rules (target: 0%)
- **Result validation failure rate**: Percentage of tool results failing schema validation (typical: 5-10%)

### Idempotency Metrics
- **Idempotent retry rate**: Percentage of tool calls using existing idempotency key (typical: 5-10%)
- **Duplicate side effect rate**: Number of duplicate side effects from retries (target: 0 with idempotency)
- **Idempotency key collision rate**: Number of duplicate keys with different parameters (target: 0, indicates bug)
- **Idempotency storage size**: Total size of stored idempotency keys and results

### Rate Limiting Metrics
- **Rate limit hit rate**: Percentage of tool calls rejected due to rate limits (target: <1%)
- **Token usage per user**: Tokens consumed per user per minute/hour/day
- **Request usage per user**: Requests per user per minute/hour/day
- **Quota exhaustion incidents**: Number of times user exhausts monthly quota
- **Tool loop detection rate**: Number of conversations entering tool loops (target: <1%)

### Timeout and Cancellation Metrics
- **Timeout rate by tool**: Which tools have highest timeout rate
- **Average timeout duration**: How long tools run before timeout
- **Cancellation rate**: Percentage of tool calls cancelled (from user interruption or timeout)
- **Cancellation latency**: Time from cancellation signal to tool stop (target: <1s)
- **Resource cleanup success rate**: Percentage of cancellations with successful cleanup (target: 100%)

### Security Metrics
- **Sandbox violation rate**: Number of attempts to access blocked resources (target: 0)
- **Unauthorized tool call rate**: Number of tool calls without required permissions (target: 0 with gateway)
- **Prompt injection detection rate**: Number of detected prompt injection attempts
- **Tool poisoning detection rate**: Number of detected malicious tool modifications
- **Data exfiltration attempts**: Number of attempts to leak sensitive data

### Observability Metrics
- **Trace coverage**: Percentage of tool calls with complete traces (target: 100%)
- **Trace ID propagation failures**: Number of tool calls without trace ID (target: 0)
- **Log volume per tool call**: Average number of log entries per tool execution
- **Tracing overhead**: Additional latency from logging (target: <5%)
- **Replay success rate**: Percentage of tool executions that can be replayed successfully (target: 100%)

### Tool-Specific Metrics
- **Tool popularity**: Which tools are called most frequently
- **Tool latency by type**: Data fetching vs computation vs actions
- **Tool error rate by type**: Which tools have highest error rate
- **Tool retry rate**: Which tools require most retries
- **Tool cost per call**: For paid APIs, cost per tool invocation

## V1 Decisions / Constraints

### D-TG-001 All Tool Calls MUST Pass Through Tool Gateway
**Decision**: Implement tool gateway as middleware between LLM and tool handlers. All tool calls intercepted by gateway before execution.

**Rationale**: Prevents hallucinated tool calls (5-10%), unauthorized actions (2-5%), and provides observability. Aligns with R1.

**Constraints**: Adds ~50-100ms latency per tool call for validation. Must optimize gateway performance.

---

### D-TG-002 Tool Gateway MUST Validate Authorization Before Execution
**Decision**: Gateway checks user permissions against tool requirements. Reject if insufficient permissions. Never delegate authorization to LLM.

**Rationale**: Prevents unauthorized actions. LLM cannot be trusted for authorization decisions. Aligns with R2.

**Constraints**: Must define permissions for all tools. Must maintain user permission grants.

---

### D-TG-003 Side-Effect Tools MUST Use Idempotency Keys
**Decision**: Tools with side effects (payments, emails, SMS, database writes) MUST use stable step ID as idempotency key. Store in PostgreSQL with results.

**Rationale**: Prevents duplicate side effects from retries (5-10% without idempotency). Aligns with R3.

**Constraints**: Must generate idempotency keys. Must store in database. Adds ~50ms latency for database check.

---

### D-TG-004 Tool Parameters MUST Be Validated with Pydantic
**Decision**: Define JSON schema for all tools. Use Pydantic for parameter validation before execution. Reject if validation fails.

**Rationale**: Prevents crashes from malformed data (10-20% of calls have schema issues). Aligns with R4.

**Constraints**: Must define schemas for all tools. Must maintain schemas as tools evolve.

---

### D-TG-005 Tool Execution MUST Have 10-Second Default Timeout
**Decision**: Default timeout 10s for all tools. Override per tool type: data fetching 5s, computation 20s, actions 15s. Use progressive timeouts with exponential backoff.

**Rationale**: Prevents resource leaks (2-5% of calls hang without timeouts). Aligns with R5.

**Constraints**: Must configure timeout per tool. Must implement cancellation and cleanup.

---

### D-TG-006 Tool Execution MUST Be Rate Limited at 100 Calls/Minute Per User
**Decision**: Implement rate limiting: 100 calls/min per user, 10k tokens/min per user. Use Redis for tracking. Return 429 error if exceeded.

**Rationale**: Prevents tool loops and quota exhaustion (1-2% of conversations). Aligns with R6.

**Constraints**: Must track usage in Redis. Must implement 429 error handling with exponential backoff.

---

### D-TG-007 Tool Execution MUST Be Logged to PostgreSQL with Trace ID
**Decision**: Log every tool execution to PostgreSQL: trace ID, tool name, parameters, result, latency, status, authorization, validation, rate limit.

**Rationale**: Enables debugging (MTTD: 2-4 hours without logging) and auditing. Aligns with R7.

**Constraints**: Adds ~50ms latency for database write. Must use async logging to minimize impact.

---

### D-TG-008 Tool Results MUST Be Validated with Pydantic
**Decision**: Define result schema for all tools. Use Pydantic for result validation after execution. Return error to LLM if validation fails.

**Rationale**: Prevents LLM from processing invalid data (5-10% of results have issues). Aligns with R8.

**Constraints**: Must define result schemas for all tools.

---

### D-TG-009 External API Tools MUST Use OS-Level Sandboxing
**Decision**: Tools that call external APIs MUST use Anthropic sandbox-runtime for OS-level sandboxing. Enforce network allowlist (only approved URLs).

**Rationale**: Prevents security incidents (unauthorized access, data leakage). Aligns with R9.

**Constraints**: Must configure sandbox per tool. Adds ~10-20ms overhead for sandboxing.

---

### D-TG-010 Interruptible Tools MUST Set cancel_on_interruption Flag
**Decision**: For Pipecat, set `cancel_on_interruption: true` for data fetching tools, `false` for payment/action tools. Implement cancellation with AbortSignal.

**Rationale**: Prevents resource waste (10-20% of conversations have interruptions). Aligns with R10.

**Constraints**: Must implement cancellation in tool handlers. Must cleanup resources on cancellation.

---

### D-TG-011 Tool Gateway MUST Enforce Business Rules
**Decision**: Define business rules per tool (e.g., amount < credit_limit, user.verified == true). Gateway validates before execution.

**Rationale**: Business rules cannot be delegated to LLM. Must be enforced in code. Aligns with R11.

**Constraints**: Must define business rules for all critical tools.

---

### D-TG-012 Tool Executions MUST Be Stored for 30 Days
**Decision**: Store all tool executions in PostgreSQL for 30 days: parameters, result, status, trace ID. Provide replay API.

**Rationale**: Enables debugging, testing, auditing. Aligns with R12.

**Constraints**: Storage cost: ~1GB per 100k tool executions. Must implement data retention policy.

---

### D-TG-013 Tool Errors MUST Return Structured Format
**Decision**: Gateway returns structured errors: `{error_type, error_message, retry_guidance}`. Error types: validation_error, authorization_error, timeout_error, execution_error.

**Rationale**: Enables LLM to handle errors gracefully, retry with corrections. Aligns with R13.

**Constraints**: Must define error types and messages for all failure modes.

---

### D-TG-014 Idempotency Keys MUST Track Parameters Hash
**Decision**: Store idempotency keys with parameters hash (SHA256). On duplicate key, check if parameters match. If not, reject.

**Rationale**: Detects bugs or malicious behavior (duplicate keys with different parameters). Aligns with R14.

**Constraints**: Must compute and store parameters hash.

---

### D-TG-015 Tool Gateway MUST Support Tool Versioning
**Decision**: Tools registered with version (e.g., `charge_card_v1`). Gateway routes to correct version based on LLM call. Support 2 previous versions for backward compatibility.

**Rationale**: Enables gradual rollout, backward compatibility, A/B testing. Aligns with R15.

**Constraints**: Must maintain multiple versions of tools. Must test version routing.

## Open Questions / Risks

### Q1: How to Handle Tool Schema Evolution?
**Question**: If tool schema changes (new required field, changed types), how to handle existing conversations using old schema?

**Risk**: Schema changes break existing conversations. LLM calls tool with old schema, validation fails.

**Mitigation options**:
- Version tools (charge_card_v1, charge_card_v2), maintain backward compatibility
- Use optional fields for new parameters, provide defaults
- Implement schema migration: gateway translates old schema to new schema
- Provide deprecation warnings to LLM when using old schema

**V1 decision**: Version tools. Support 2 previous versions for backward compatibility. Deprecate old versions after 90 days.

---

### Q2: How to Debug Tool Execution in Production?
**Question**: If tool fails in production, how to debug without access to production database or APIs?

**Risk**: Cannot reproduce issues locally. Long debugging time.

**Mitigation options**:
- Store all tool executions with full context (parameters, result, trace ID)
- Provide replay capability: can replay tool execution with same parameters in staging
- Sanitize sensitive data (PII, credentials) before storing
- Provide debug mode: log additional context (stack traces, intermediate values)

**V1 decision**: Store all executions for 30 days. Provide replay API. Sanitize PII before storage.

---

### Q3: How to Handle Tool Execution Costs?
**Question**: Some tools call paid APIs (Stripe, Twilio, external services). How to track and limit costs?

**Risk**: Tool loops or hallucinations cause excessive costs. Monthly budget exhausted in hours.

**Mitigation options**:
- Track cost per tool call, aggregate per user/app/org
- Set cost limits (per user: $100/month, per app: $1000/month)
- Alert when approaching limits (80% of quota)
- Implement cost-based rate limiting (not just request count)

**V1 decision**: Track cost per tool call. Set per-user limit $100/month. Alert at 80% quota.

---

### Q4: How to Handle Tool Execution Failures?
**Question**: If tool fails (API timeout, network error, service outage), should gateway retry automatically or return error to LLM?

**Risk**: Automatic retries may cause duplicate side effects. Returning error may break conversation flow.

**Mitigation options**:
- Classify errors: retriable (network timeout, 500 error) vs non-retriable (400 error, validation failure)
- Retry retriable errors with exponential backoff (3 attempts max)
- Use idempotency keys to prevent duplicate side effects
- Return error to LLM after exhausting retries, allow LLM to handle gracefully

**V1 decision**: Retry retriable errors 3 times with exponential backoff. Use idempotency keys. Return error to LLM after exhausting retries.

---

### Q5: How to Handle Tool Execution Latency?
**Question**: Some tools have high latency (5-10s for external APIs). How to maintain conversational flow?

**Risk**: Long pauses break conversational experience. User thinks system is broken.

**Mitigation options**:
- Provide progress updates to user ("Checking your account balance...")
- Use streaming results: return partial results as they become available
- Offload long-running tools to background queue, notify user when complete
- Set realistic expectations in prompts ("This may take a few seconds")

**V1 decision**: Provide progress updates for tools >2s latency. Use streaming for tools that support it. Offload tools >10s to background queue.

---

### Q6: How to Handle Tool Execution Concurrency?
**Question**: If LLM calls multiple tools in parallel, how to handle concurrency? Execute in parallel or sequentially?

**Risk**: Parallel execution may cause race conditions or resource exhaustion. Sequential execution increases latency.

**Mitigation options**:
- Execute independent tools in parallel (get_weather + get_calendar)
- Execute dependent tools sequentially (validate_card → charge_card)
- Limit concurrency per user (max 3 parallel tools)
- Use dependency graph to determine execution order

**V1 decision**: Execute independent tools in parallel (max 3 concurrent). Use dependency graph for dependent tools. Limit to 3 parallel tools per user.

---

### Q7: How to Handle Tool Execution Rollback?
**Question**: If multi-step tool execution fails mid-way (charge_card succeeds, send_email fails), how to rollback?

**Risk**: Partial execution leaves system in inconsistent state. User charged but no confirmation sent.

**Mitigation options**:
- Implement compensating transactions (refund_card if send_email fails)
- Use Saga pattern: define compensation for each tool
- Store execution state, enable manual rollback
- Notify user of partial failure, offer to retry or rollback

**V1 decision**: Implement compensating transactions for critical tools (payment, booking). Use Saga pattern. Notify user of partial failures.

---

### Q8: How to Handle Tool Execution Security?
**Question**: How to prevent malicious tools from accessing sensitive data (environment secrets, database credentials, user PII)?

**Risk**: Malicious tools can leak sensitive data, cause security incidents.

**Mitigation options**:
- Sandbox all tools (OS-level or container-based)
- Enforce isolation boundaries (network, filesystem, environment)
- Use principle of least privilege (grant minimum permissions)
- Monitor sandbox violations, alert on suspicious behavior
- Code review all tools before deployment

**V1 decision**: Use OS-level sandboxing (Anthropic sandbox-runtime). Enforce network allowlist. Code review all tools. Monitor violations.

---

### Q9: How to Handle Tool Execution Observability Overhead?
**Question**: Logging every tool execution with full context adds latency and storage costs. Is this acceptable?

**Risk**: Observability overhead breaks P50 <500ms target (D-LT-001).

**Mitigation options**:
- Use async logging (don't block tool execution)
- Sample logging (100% of errors, 10% of successes)
- Optimize log format (binary instead of JSON)
- Use log aggregation (batch writes to database)

**V1 decision**: Use async logging. Log 100% of tool executions (critical for debugging). Optimize with batch writes. Monitor overhead, target <5%.

---

### Q10: How to Handle Tool Execution Testing?
**Question**: How to test tools in staging without calling production APIs (Stripe, Twilio)?

**Risk**: Testing in production causes real charges, sends real emails, modifies real data.

**Mitigation options**:
- Use test mode for external APIs (Stripe test keys, Twilio test numbers)
- Mock external APIs in staging (return fake results)
- Use feature flags to enable/disable tools per environment
- Implement dry-run mode (simulate execution without side effects)

**V1 decision**: Use test mode for external APIs. Mock APIs in staging. Implement dry-run mode for critical tools. Test with feature flags.
