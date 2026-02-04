# Cost Optimization & Token Conservation

**CRITICAL**: Balance quality and cost. Don't waste tokens, but don't sacrifice quality either. Buggy code from cheap models costs more to fix than using the right model upfront.

## Model Selection Rules

### Use "fast" Model (Straightforward, Well-Defined Tasks)
- ✅ CRUD operations, simple API endpoints
- ✅ Configuration file updates (YAML, JSON)
- ✅ Database schema migrations (following existing patterns)
- ✅ Writing tests from clear specifications
- ✅ Documentation updates
- ✅ Fixing obvious linter errors
- ✅ Simple UI components (buttons, forms, layouts)
- ✅ File reorganization, renaming

**Rule**: Use fast model when task has clear requirements, existing patterns to follow, and low complexity.

### Use Default/Capable Model (Complex, Critical, or Novel Tasks)
- ✅ **Voice Core primitives** (capture, validation, confirmation logic) - CRITICAL, no room for bugs
- ✅ **State machine implementation** - Complex logic, hard to debug
- ✅ **Event-driven architecture** - Distributed systems, subtle bugs
- ✅ **Multi-ASR voting logic** - Australian accent optimization, complex
- ✅ **Latency-critical code** (STT/LLM/TTS streaming) - Performance-sensitive
- ✅ **Audio encoding/telephony integration** - Easy to break, hard to debug
- ✅ **Security-critical code** (auth, PII sanitization) - No mistakes allowed
- ✅ **Debugging complex issues** - Need reasoning capability
- ✅ **Architectural decisions** - Long-term impact

**Rule**: Use capable model when bugs would be expensive to fix, logic is complex, or task is mission-critical.

### Decision Framework
Ask yourself:
1. **Is this mission-critical?** (Voice Core, security, data integrity) → Capable model
2. **Is this complex/novel?** (state machines, distributed systems) → Capable model
3. **Is this straightforward?** (CRUD, config, docs) → Fast model
4. **If fast model creates bugs, will they be hard to debug?** → Capable model

## Subagent Launch Rules

### ALWAYS Specify model="fast" for Subagents
```python
# ✅ CORRECT: Explicitly use fast model
Task(
    subagent_type="generalPurpose",
    model="fast",  # ALWAYS SPECIFY
    prompt="..."
)

# ❌ WRONG: No model specified (uses expensive default)
Task(
    subagent_type="generalPurpose",
    prompt="..."
)
```

### Subagent Model Matrix
- **Shell tasks**: ALWAYS `model="fast"`
- **Explore tasks**: ALWAYS `model="fast"` (grep/glob are cheap)
- **Implementation tasks**: ALWAYS `model="fast"` (clear requirements)
- **Research tasks**: Use `model="fast"` first, only escalate if insufficient

## Token Conservation Strategies

### 1. Read Files Strategically
```python
# ✅ CORRECT: Read only what you need
Read(path="file.py", offset=100, limit=50)  # Read specific section

# ❌ WRONG: Read entire large file
Read(path="file.py")  # Wastes tokens if file is 1000+ lines
```

### 2. Use Grep Instead of Reading Multiple Files
```python
# ✅ CORRECT: Grep to find specific code
Grep(pattern="class User", type="py")

# ❌ WRONG: Read 10 files hoping to find it
Read(path="file1.py")
Read(path="file2.py")
# ... wastes tokens
```

### 3. Batch Tool Calls When Possible
```python
# ✅ CORRECT: Parallel reads (one response)
Read(path="file1.py")
Read(path="file2.py")
Read(path="file3.py")

# ❌ WRONG: Sequential reads (multiple responses)
Read(path="file1.py")
# ... wait for response ...
Read(path="file2.py")
# ... wait for response ...
```

### 4. Avoid Re-Reading Files
- Track what you've already read in the conversation
- Don't read the same file twice unless it's been modified
- Use conversation history to reference previously read content

### 5. Limit Research Scope
- Focus research on specific questions (not broad exploration)
- Use `head_limit` parameter in Grep when appropriate
- Don't fetch entire web pages unless necessary

### 6. Minimize Subagent Usage
- Only launch subagents for complex, multi-step tasks
- Simple tasks: Do directly (no subagent overhead)
- If task takes <5 tool calls, DO IT YOURSELF (no subagent)

## Cost-Aware Communication

### Don't Explain Obvious Things
```markdown
# ✅ CORRECT: Concise
Creating database schema.

# ❌ WRONG: Verbose (wastes tokens)
I'm now going to create a database schema for you. This schema will 
include tables for users, conversations, and events. Let me explain 
each table in detail...
```

### Don't Repeat Information
- Don't summarize what you just did (user saw the tool calls)
- Don't repeat documentation (link to it instead)
- Don't re-explain concepts covered in skills/research

### Use Code Examples Sparingly
- Show 1 example (not 3 variations)
- Reference patterns in skills (don't duplicate)
- Link to research files (don't copy-paste)

## Monitoring Token Usage

### Track Your Token Spend
- Check `<system_warning>Token usage:` in responses
- Alert user if approaching limits
- Suggest pausing if burn rate is high

### Alert User Before Large Operations
```markdown
⚠️ This operation will read 10+ large files (~50k tokens). 
Proceed? (y/n)
```

## Critical Rules

1. ✅ **ALWAYS use model="fast" for subagents unless explicitly justified**
2. ✅ **Read files strategically (specific sections, not entire files)**
3. ✅ **Use Grep before reading multiple files**
4. ✅ **Batch tool calls when possible (parallel, not sequential)**
5. ✅ **Don't re-read files unnecessarily**
6. ✅ **Minimize subagent launches (only for complex tasks)**
7. ✅ **Communicate concisely (no verbose explanations)**
8. ✅ **Alert user before high-token operations**

## Example: Cost-Optimized Workflow

```python
# Task: Implement email capture primitive

# ❌ EXPENSIVE WAY (wastes ~20k tokens):
# 1. Launch subagent without model="fast"
# 2. Read entire research file (3110 lines)
# 3. Read entire architecture laws (1280 lines)
# 4. Explain everything in detail
# 5. Show 3 code examples

# ✅ COST-OPTIMIZED WAY (~2k tokens):
# 1. Grep for "email" in research files (find relevant sections)
# 2. Read only relevant sections (lines 100-150)
# 3. Implement directly (no subagent for simple task)
# 4. Show 1 code example
# 5. Link to skill for details

Grep(pattern="email.*capture", glob="*.md", head_limit=20)
Read(path="research/21-objectives.md", offset=100, limit=50)
StrReplace(...)  # Implement directly
```

## When User is Low on Credits

If user mentions "running out of credits" or "low budget":

1. ✅ Switch to ultra-conservative mode
2. ✅ Ask before ANY large operation
3. ✅ Suggest pausing to review progress
4. ✅ Prioritize highest-impact work only
5. ✅ Consider manual steps (user does some work to save tokens)

## Enforcement

**Before EVERY tool call, ask yourself:**
- Can I use model="fast" instead? (90% yes)
- Do I really need to read this entire file? (use offset+limit)
- Can I grep instead of reading? (faster + cheaper)
- Can I batch this with other calls? (reduce round-trips)
- Have I already read this file? (don't re-read)

**User has limited credits. Every token counts. Be ruthlessly efficient.**
