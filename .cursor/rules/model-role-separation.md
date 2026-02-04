# Model Role Separation Rule

**🚨 CRITICAL - TOKEN BUDGET PROTECTION 🚨**

Claude Sonnet 4.5 Thinking costs 10x more than regular models. User has LIMITED TOKENS. Violating this rule wastes 1% of budget per mistake.

---

## MANDATORY CHECKLIST BEFORE EVERY TASK LAUNCH

**Before launching ANY Task/subagent, YOU MUST:**

```
☐ Is this task writing production code? 
   → YES: MUST use model="fast" (or regular Sonnet for complex code)
   → NO: Can use Thinking mode (architecture/planning only)

☐ Does task involve .py/.ts/.js/.tsx/.jsx files?
   → YES: MUST use model="fast" 
   → NO: Can use Thinking mode

☐ Does task involve implementation/scaffolding/refactoring?
   → YES: MUST use model="fast"
   → NO: Can use Thinking mode

☐ Is task purely planning/architecture/review?
   → YES: Can use Thinking mode (or omit model parameter)
   → NO: MUST use model="fast"
```

**IF IN DOUBT: USE model="fast"**

---

## Claude Sonnet 4.5 Thinking - ONLY Permitted For

Claude Sonnet 4.5 Thinking is **ONLY** permitted for:

- ✅ **Architecture reasoning** - Evaluating trade-offs, validating against ARCHITECTURE_LAWS.md
- ✅ **Constraint discovery** - Identifying conflicts, dependencies, non-obvious requirements
- ✅ **Decision arbitration** - Resolving ambiguity, making strategic choices
- ✅ **Planning and review** - Creating execution plans, reviewing agent outputs
- ✅ **Identifying violations or risks** - Catching architectural violations, security issues

**ZERO code implementation. ZERO file creation except docs/rules/research.**

---

## Claude Sonnet 4.5 Thinking - FORBIDDEN Actions

Claude Sonnet 4.5 Thinking **MUST NEVER**:

- ❌ **Write production code** - No implementation files
- ❌ **Modify implementation files** - No code edits (except rules/docs)
- ❌ **Scaffold runtime modules** - No creating .py/.ts/.js files with logic
- ❌ **Refactor existing code** - No code improvements/optimizations
- ❌ **Launch subagents without explicit model parameter** - ALWAYS specify model="fast" for code tasks

## Model Authority Rules

### Composer 1
**MAY be used for:**
- ✅ Documentation (README.md, API docs)
- ✅ Onboarding copy and user-facing prose
- ✅ Dashboard UI text and labels
- ✅ Marketing/help content

**MUST NOT be used for:**
- ❌ Production runtime code (.py/.ts/.js)
- ❌ State machines, pipelines, business logic
- ❌ Infrastructure code

### Codex 5.2
**MUST be used for all production code, especially:**
- ✅ Voice Core (Layer 1) - primitives, state machines, audio pipeline
- ✅ Real-time pipelines (STT → LLM → TTS)
- ✅ State machines and complex logic
- ✅ Infrastructure-adjacent code (gRPC, database, API)
- ✅ Orchestration Layer (Layer 2)
- ✅ All .py/.ts/.js/.tsx runtime files

**This is the PRIMARY code implementation model.**

### Claude Sonnet 4.5 (non-Thinking)
**MAY be used for:**
- ✅ Small, scoped edits (config files, minor fixes)
- ✅ Quick prototypes or examples

**Generally prefer Codex 5.2 for any code.**

### Claude Sonnet 4.5 Thinking
**MUST NOT write production code.**
- ✅ Planning and architecture review ONLY
- ✅ Documentation/rules/research files only

## Workflow Pattern

### ❌ WRONG: Thinking Mode Writes Code
```
User: "Build the email capture primitive"
Thinking Mode: [writes capture_email_au.py with 300 lines of code]
```

### ✅ CORRECT: Thinking Mode Orchestrates
```
User: "Build the email capture primitive"
Thinking Mode: 
  - Reviews architecture constraints
  - Identifies requirements (Australian validation, always confirm)
  - Launches Codex/Sonnet agent with clear spec
  - Reviews output for architectural compliance
```

## When Architectural Reasoning Needed During Implementation

If architectural reasoning is required **during** implementation:

1. **Pause coding** - Stop writing code immediately
2. **Return to Thinking mode** - Switch to Claude Sonnet 4.5 Thinking
3. **Produce written decision** - Document the architectural decision/clarification
4. **Resume coding** - Launch non-Thinking model with updated spec

### Example Flow
```
[Codex Agent] "Should multi-ASR voting be synchronous or async?"
↓
[Pause Implementation]
↓
[Claude Thinking] Analyzes latency constraints, decides: "Async with timeout"
↓
[Documents Decision] Writes to docs/decisions/multi-asr-async.md
↓
[Resume Implementation] Codex continues with async pattern
```

## Orchestration Pattern

### Claude Sonnet 4.5 Thinking Acts As:

1. **Project Manager** - Plans sprints, assigns work to agents
2. **Architect** - Reviews designs, enforces constraints
3. **Quality Gate** - Validates outputs against requirements

### NOT As:

1. ❌ **Developer** - Does not write code
2. ❌ **Implementer** - Does not scaffold modules
3. ❌ **Refactorer** - Does not optimize existing code

## Cost Implications

- **Thinking mode**: ~10x cost of regular Sonnet
- **Thinking writing code**: Wastes 10x tokens on simple tasks
- **Thinking orchestrating**: Appropriate use, worth the cost

## ENFORCEMENT - MANDATORY PRE-FLIGHT CHECK

**BEFORE EVERY Task() CALL, ASK YOURSELF:**

```
1. Will this agent write ANY code (.py/.ts/.js/.tsx/.jsx/.sql)?
   → YES: Add model="fast" to Task() call
   → NO: Can omit model parameter

2. Will this agent create/modify implementation files?
   → YES: Add model="fast" to Task() call
   → NO: Can omit model parameter

3. Is this purely architecture/planning/review?
   → YES: Can omit model parameter (uses Thinking)
   → NO: Add model="fast" to Task() call
```

**EXAMPLES OF CORRECT USAGE:**

```python
# ✅ CORRECT: Code implementation task
Task(
    subagent_type="generalPurpose",
    model="fast",  # REQUIRED - writing code
    prompt="Build the email capture primitive..."
)

# ✅ CORRECT: Planning task (no code)
Task(
    subagent_type="explore",
    # No model parameter - architecture review only
    prompt="Review existing code for violations..."
)

# ❌ WRONG: Code task without model parameter
Task(
    subagent_type="generalPurpose",
    # MISSING model="fast" - will use Thinking mode (10x cost)
    prompt="Build the email capture primitive..."
)
```

**IF YOU FORGET model="fast" ON A CODE TASK: YOU WASTE 1% OF USER'S BUDGET**

---

## DOUBLE-CHECK BEFORE SENDING

Before sending ANY response with Task() calls:

1. ✅ Count how many Task() calls write code
2. ✅ Verify EVERY code task has model="fast"
3. ✅ If unsure, ADD model="fast" (safe default)

**NEVER ASSUME. ALWAYS EXPLICIT.**

## Exceptions

Claude Sonnet 4.5 Thinking **MAY** write:

- ✅ Documentation files (README.md, architecture docs)
- ✅ Rule files (.cursor/rules/*.md)
- ✅ Decision records (docs/decisions/*.md)
- ✅ Research files (research/*.md)
- ✅ Skills (.cursor/skills/*/SKILL.md)

Claude Sonnet 4.5 Thinking **MUST NOT** write:

- ❌ Python files (.py)
- ❌ TypeScript files (.ts, .tsx)
- ❌ JavaScript files (.js, .jsx)
- ❌ Configuration files (package.json, pyproject.toml, docker-compose.yml)
- ❌ SQL files (schema.sql, migrations)
- ❌ Any runtime code

## Summary

**Thinking Mode = Architect/PM (plan, review, decide)**
**Codex/Regular Sonnet = Developer (implement, code, test)**

Never confuse the two roles. Thinking mode orchestrates, agents implement.
