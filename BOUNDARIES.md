# SpotFunnel Boundary Enforcement

This document defines ownership boundaries and import rules for the SpotFunnel monorepo.

## Folder Ownership

| Path | Owner | Edit Policy | Purpose |
|------|-------|-------------|---------|
| `apps/public-site/` | **Antigravity** (external vendor) | **Read-only**. Update by re-importing export. | Public marketing website (Vite/React) |
| `apps/web/` | **Cursor** (internal team) | Editable. Dashboards and admin UI. | Next.js app for /dashboard and /admin |
| `voice-core/` | **Cursor** (internal team) | Editable. Backend services. | Python voice pipeline backend |
| `voice-ai-os/` | **Cursor** (internal team) | Editable. Orchestration. | Orchestration layer |
| `monitoring/` | **Cursor** (internal team) | Editable. Observability. | Metrics and monitoring |

## Import Rules

### Public Site (`apps/public-site/`)

**Purpose:** Static-deployable marketing site with no backend dependencies.

**CANNOT import:**
- ❌ Dashboard components (`apps/web/`)
- ❌ Supabase clients (`@supabase/*`, `supabase`)
- ❌ Database/ORM libraries (`prisma`, `typeorm`, `pg`)
- ❌ Auth/session modules (`apps/web/src/server/session`)
- ❌ Dashboard contexts (`apps/web/src/contexts/`)

**Reasoning:** 
- Public site is vendor-maintained (Antigravity export)
- Must remain static-deployable (no secrets/env vars)
- Updates happen by re-importing, not editing

### Web App (`apps/web/`)

**Purpose:** Customer dashboard + admin control panel.

**CANNOT import:**
- ❌ Marketing components (`apps/public-site/`)

**CAN import:**
- ✅ Supabase (if needed for dashboards)
- ✅ Auth/session modules
- ✅ Database clients
- ✅ Shared UI components within `apps/web/src/components/`

**Reasoning:**
- Dashboards and marketing have separate lifecycles
- No coupling between customer-facing UI and marketing site

## Enforcement

### Automated Checks

Run before every commit:

```bash
npm run lint:boundaries
```

This script (`scripts/check-boundaries.js`) scans all TypeScript/JavaScript files and fails if forbidden imports are detected.

### CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Install dependencies
  run: npm install

- name: Check boundary enforcement
  run: npm run lint:boundaries
```

## Updating the Public Site

When Antigravity delivers a new export:

1. **Receive export zip**
   ```bash
   # Extract to temporary location
   unzip new-export.zip -d /tmp/public_site_new
   ```

2. **Replace folder contents**
   ```bash
   # Backup current (optional)
   cp -r apps/public-site apps/public-site.backup
   
   # Replace
   rm -rf apps/public-site/*
   cp -r /tmp/public_site_new/* apps/public-site/
   ```

3. **Restore ownership notice**
   ```bash
   # Re-add ownership notice to README (see template below)
   ```

4. **Run boundary checks**
   ```bash
   npm run lint:boundaries
   ```

5. **Test locally**
   ```bash
   npm run dev:public
   # Visit http://localhost:8080
   ```

6. **Commit**
   ```bash
   git add apps/public-site/
   git commit -m "chore(public-site): update to Antigravity export 2026-02-XX"
   ```

### README Ownership Notice Template

Prepend to `apps/public-site/README.md`:

```markdown
---
**OWNERSHIP NOTICE**

This folder contains the Antigravity-exported public marketing site.

- **Owner:** Antigravity (external vendor)
- **Edit Policy:** Do not edit by hand. Update by re-importing zip export.
- **Last Updated:** YYYY-MM-DD
- **Export Source:** Contact Antigravity for latest export

To update:
1. Receive new export from Antigravity
2. Replace folder contents (see `BOUNDARIES.md` in repo root)
3. Run `npm run lint:boundaries` from repo root
4. Test with `npm run dev:public`
5. Commit with message: `chore(public-site): update to export YYYY-MM-DD`

---

[... original Antigravity README follows ...]
```

## Allowed Cross-App Patterns

### Design Tokens (Future)

If both apps need shared design tokens (colors, spacing, etc.), create:

```
packages/
└── design-tokens/
    ├── package.json
    ├── colors.ts
    └── spacing.ts
```

Both apps can import from `@spotfunnel/design-tokens`.

**Rule:** Design tokens package must NOT contain components, hooks, or business logic.

### UI Components

**Public Site:**
- Uses its own shadcn/ui components in `apps/public-site/components/ui/`
- Styled with Tailwind for marketing aesthetic

**Web App:**
- Uses its own shadcn/ui components in `apps/web/src/components/ui/`
- Styled with Tailwind for dashboard aesthetic

**Rule:** Do NOT create a shared component library between public site and dashboards. They have different owners and lifecycles.

## Troubleshooting

### "Boundary violation" error in CI

```
❌ BOUNDARY VIOLATION
File: apps/public-site/pages/Consultation.tsx:15
Reason: Public site cannot import from dashboard app
Line: import { useAuth } from '../../web/src/contexts/AuthContext';
```

**Fix:** Remove the import. Public site must not depend on dashboard code.

### Public site needs form submission

**Correct approach:**
- Use external service (Formspree, Basin, etc.)
- OR create minimal `/api/forms` endpoint in `voice-core` (separate from dashboard APIs)

**Incorrect approach:**
- ❌ Import Supabase into public site
- ❌ Import session/auth from `apps/web/`

See `PUBLIC_SITE_INTEGRATION_PLAN.md` for form handling examples.

## Questions?

- **Public site updates:** Contact Antigravity vendor
- **Dashboard features:** Internal Cursor team
- **Boundary enforcement:** Run `npm run lint:boundaries` and read this doc

## Success Metrics

✅ Boundary checks pass in CI  
✅ Public site builds without dashboard dependencies  
✅ Dashboard builds without public site dependencies  
✅ Single domain routing works (`/` → public, `/dashboard` → web)  
✅ Update process documented and tested  
