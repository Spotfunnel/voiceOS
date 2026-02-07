# Security Notes (Active Findings)

This document tracks known security findings discovered during routine dependency audits.
It does **not** replace an incident response process; it is a working backlog for fixes.

## Current Findings (2026-02-05)

### 1) Next.js (runtime) - High
- **Package:** `next`
- **Installed version:** `14.2.35`
- **Path:** `onboarding-ui/node_modules/next`
- **Advisories:**
  - GHSA-9g9p-9gw9-jx7f (DoS via Image Optimizer `remotePatterns`)
  - GHSA-h25m-26qc-wcjf (DoS via RSC request deserialization)
- **Exploitability:** **Runtime** dependency. Potentially exploitable in production if the affected features are exposed.
- **Mitigations (no major upgrade):**
  - Avoid or tightly restrict `images.remotePatterns` in `next.config.js`.
  - Apply request size limits / rate limiting at the edge or reverse proxy.
  - Keep RSC endpoints behind auth where possible.
- **Targeted upgrade plan (no Next major):**
  - **Pin:** `next@14.2.35` (already current; no patched 14.x available via npm).
  - **Action:** Schedule a controlled framework upgrade with regression gates to a patched major (see roadmap).

### 2) glob (dev-only) - High
- **Package:** `glob`
- **Installed version:** `10.3.10`
- **Path:** `onboarding-ui/node_modules/glob` (via `@next/eslint-plugin-next` → `eslint-config-next`)
- **Advisory:** GHSA-5j98-mcp5-4vw2 (CLI command injection via `-c/--cmd`)
- **Exploitability:** **Dev-only** dependency (eslint tooling). Not executed in production runtime.
- **Targeted upgrade plan (no Next major):**
  - Add npm override to force `glob@10.5.0` for eslint tooling.
  - Keep `eslint-config-next@14.2.35` pinned.

## Notes
- We will **not** upgrade Next major/minor via `npm audit fix --force` in this phase.
- Framework upgrades will be handled as a separate task with regression gates.
