# Agent Instructions (SpotFunnel Voice AI OS)

These instructions apply to any AI assistant working in this repository (Cursor, Claude Code, Codex, etc.).
They are the operating contract for building a production-grade voice AI platform.

## Mission
Ship a production-shaped V1 in 7 days and enable deployable customer agents by Day 8.

## Non-Negotiable Operating Rules
1. Humans do NOT manually edit code.
2. All work follows: PLAN → APPROVE → EXECUTE.
3. Claude (Sonnet/Opus) is for planning, research, critique ONLY.
4. Codex (GPT-5.2) executes approved plans and makes code edits.
5. Multi-file edits must be grouped and reviewed as diffs.
6. No silent commands. Any command that changes the system must be shown first.
7. Prefer simple, explicit designs over clever abstractions.

## Architecture Invariants (must not be violated)
- WebRTC (Daily) is the audio transport. No local OS audio dependencies.
- Python (Pipecat) runs the real-time voice runtime.
- Node/TypeScript is the control plane (agents, tools, policies, sessions, observability).
- Turn-taking and interruption behavior is runtime logic, not prompt logic.
- Tools are executed via the control plane gateway with strict schemas and logging.

## 3-Layer Reliability Model
### Layer 1: Directives (what to do)
- SOPs live in `directives/`
- Each directive defines: inputs, outputs, tools/scripts, edge cases, success criteria.

### Layer 2: Orchestration (decision-making)
- The AI assistant reads directives, routes tasks, sequences steps, and handles errors.
- The assistant does NOT invent workflows—uses directives or proposes updates.

### Layer 3: Execution (deterministic)
- Deterministic scripts live in `execution/` (can be Python/Node/bash).
- Prefer scripts and repeatable commands over manual steps.
- Record learnings back into directives.

## Self-Annealing Loop
When something breaks:
1. Read the error
2. Fix the smallest root cause
3. Re-run the minimal check
4. Update the relevant directive with the learning
5. Add a regression check if applicable

## Scope Control
- Do not expand scope beyond V1 without explicit instruction.
- If a request threatens the 7-day milestone, propose a V1-safe alternative.
