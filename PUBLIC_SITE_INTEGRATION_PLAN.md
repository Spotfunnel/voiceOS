# Public Site Integration Plan
**Date:** 2026-02-05  
**Approach:** Monorepo with separate apps + platform routing

## Executive Summary

We are integrating the Antigravity-exported public marketing site (Vite/React/Tailwind) into the SpotFunnel repo as a **separate application** in a monorepo structure. This preserves framework boundaries, prevents code pollution, and enables clean ownership separation.

**Key Decision:** Use **Approach 1** (preferred) — Keep public site as a separate Vite app, use platform routing to serve both apps from one domain.

---

## Integration Approach

### Approach 1: Monorepo + Separate Apps (SELECTED)

**Rationale:**
- Preserves the Antigravity export exactly as delivered (no porting required)
- Avoids framework conversion (Vite → Next) which would require ongoing maintenance
- Clean separation of concerns (marketing vs. dashboard)
- Platform routing (Vercel/Netlify/Cloudflare) trivially supports this pattern
- Future-proof: marketing team can update public site independently

**Structure:**
```
VoiceAIProduction/
├── apps/
│   ├── public-site/          # Antigravity export (Vite/React)
│   │   ├── README.md         # Antigravity README (verbatim)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── pages/            # /, /consultation, /contact, /terms, /privacy
│   │   ├── components/
│   │   └── ...
│   └── web/                  # Next.js app (dashboards)
│       ├── src/
│       │   ├── app/
│       │   │   ├── dashboard/  # Customer dashboard
│       │   │   └── admin/      # Admin control panel
│       │   ├── components/
│       │   └── server/
│       └── ...
├── voice-core/               # Python backend (unchanged)
├── voice-ai-os/              # Orchestration (unchanged)
├── monitoring/               # Observability (unchanged)
└── package.json              # Root workspace config
```

**Routing Plan (Single Domain):**

Platform: Vercel / Netlify / Cloudflare Pages

```
spotfunnel.com
├── /                    → apps/public-site (Vite build)
├── /consultation        → apps/public-site
├── /contact             → apps/public-site
├── /terms               → apps/public-site
├── /privacy             → apps/public-site
├── /dashboard           → apps/web (Next.js)
├── /dashboard/*         → apps/web (Next.js)
├── /admin               → apps/web (Next.js)
└── /admin/*             → apps/web (Next.js)
```

**Platform Configuration Example (Vercel `vercel.json`):**
```json
{
  "builds": [
    { "src": "apps/public-site/package.json", "use": "@vercel/static-build" },
    { "src": "apps/web/package.json", "use": "@vercel/next" }
  ],
  "routes": [
    { "src": "/dashboard(.*)", "dest": "apps/web$1" },
    { "src": "/admin(.*)", "dest": "apps/web$1" },
    { "src": "/(.*)", "dest": "apps/public-site/$1" }
  ]
}
```

---

## Folder Structure Changes

### Current State
```
VoiceAIProduction/
├── onboarding-ui/        # Next.js (dashboards)
├── voice-core/           # Python backend
├── voice-ai-os/          # Orchestration
├── monitoring/
└── voice-ai-os/research/public_site.zip
```

### Target State
```
VoiceAIProduction/
├── apps/
│   ├── public-site/      # NEW: Antigravity export (moved from research/)
│   └── web/              # RENAMED: onboarding-ui → apps/web
├── voice-core/
├── voice-ai-os/
├── monitoring/
├── package.json          # NEW: Root workspace manifest
└── BOUNDARIES.md         # NEW: Ownership documentation
```

### Migration Steps

1. **Create `apps/` folder structure**
   ```bash
   mkdir -p apps/public-site apps/web
   ```

2. **Move public site**
   ```bash
   # Extract and move Antigravity export
   mv voice-ai-os/research/public_site_extracted/public_site/* apps/public-site/
   ```

3. **Move Next.js app**
   ```bash
   # Rename onboarding-ui → apps/web
   mv onboarding-ui/* apps/web/
   rmdir onboarding-ui
   ```

4. **Create root workspace `package.json`**
   ```json
   {
     "name": "spotfunnel-monorepo",
     "private": true,
     "workspaces": [
       "apps/*",
       "monitoring"
     ],
     "scripts": {
       "dev:public": "npm run dev --workspace=apps/public-site",
       "dev:web": "npm run dev --workspace=apps/web",
       "build:public": "npm run build --workspace=apps/public-site",
       "build:web": "npm run build --workspace=apps/web",
       "lint:boundaries": "node scripts/check-boundaries.js"
     }
   }
   ```

5. **Add `apps/public-site/README.md`** (Antigravity README verbatim + ownership notice)

---

## Boundary Enforcement

### Ownership Model

| Folder | Owner | Edit Policy |
|--------|-------|-------------|
| `apps/public-site/` | **Antigravity (external)** | **Read-only**. Update by re-importing zip. |
| `apps/web/src/app/dashboard/` | **Cursor (internal)** | Editable. Customer-facing dashboard. |
| `apps/web/src/app/admin/` | **Cursor (internal)** | Editable. Operator control panel. |
| `apps/web/src/components/` | **Cursor (internal)** | Editable. Shared dashboard UI kit. |
| `apps/web/src/server/` | **Cursor (internal)** | Editable. Session/auth logic. |
| `voice-core/` | **Cursor (internal)** | Editable. Python backend. |

### Import Rules (Enforced)

**Forbidden Imports in `apps/public-site/`:**
- ❌ `@supabase/*` or `supabase`
- ❌ Any auth/session modules (`apps/web/src/server/*`)
- ❌ Database clients (`pg`, `prisma`, `typeorm`)
- ❌ Dashboard components (`apps/web/src/components/dashboard/*`)
- ❌ Admin components (`apps/web/src/app/admin/*`)

**Forbidden Imports in `apps/web/`:**
- ❌ `apps/public-site/*` (dashboards must not import marketing components)

**Allowed Cross-App Patterns:**
- ✅ Both apps can share design tokens via a neutral `packages/design-tokens/` (if needed)
- ✅ Both apps can use separate instances of shadcn/ui components (no shared folder)

### Automated Checks

**Script:** `scripts/check-boundaries.js`

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const FORBIDDEN_IMPORTS_PUBLIC = [
  /@supabase/,
  /supabase/,
  /\.\.\/web\//,
  /apps\/web/,
  /prisma/,
  /typeorm/,
  /pg(?!\.)/,  // Allow "page" but not "pg" module
];

const FORBIDDEN_IMPORTS_WEB = [
  /\.\.\/public-site\//,
  /apps\/public-site/,
];

function checkFile(filePath, forbiddenPatterns, context) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('import ')) {
      forbiddenPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          console.error(`❌ BOUNDARY VIOLATION in ${filePath}:${idx + 1}`);
          console.error(`   ${context}: ${line.trim()}`);
          console.error(`   Pattern matched: ${pattern}\n`);
          process.exitCode = 1;
        }
      });
    }
  });
}

// Check public site
glob.sync('apps/public-site/**/*.{ts,tsx,js,jsx}').forEach(file => {
  checkFile(file, FORBIDDEN_IMPORTS_PUBLIC, 'Public site must not import dashboard/db');
});

// Check web app
glob.sync('apps/web/**/*.{ts,tsx,js,jsx}').forEach(file => {
  checkFile(file, FORBIDDEN_IMPORTS_WEB, 'Dashboard must not import public site');
});

if (process.exitCode === 1) {
  console.error('\n❌ Boundary checks FAILED. See violations above.\n');
  process.exit(1);
} else {
  console.log('✅ Boundary checks PASSED.\n');
}
```

**Run in CI:**
```yaml
# .github/workflows/ci.yml
- name: Check boundaries
  run: npm run lint:boundaries
```

---

## Documentation

### `BOUNDARIES.md` (Root)

```markdown
# SpotFunnel Boundary Enforcement

## Folder Ownership

| Path | Owner | Edit Policy |
|------|-------|-------------|
| `apps/public-site/` | Antigravity (external vendor) | **Read-only**. Update by re-importing export. |
| `apps/web/` | Cursor (internal team) | Editable. Dashboards and admin. |
| `voice-core/` | Cursor (internal team) | Editable. Backend services. |

## Import Rules

### Public Site (`apps/public-site/`)
**Cannot import:**
- Dashboard components (`apps/web/`)
- Supabase clients
- Database/ORM libraries
- Auth/session modules

**Reasoning:** Public site is static-deployable and vendor-maintained.

### Web App (`apps/web/`)
**Cannot import:**
- Marketing components (`apps/public-site/`)

**Reasoning:** Dashboards and marketing have separate lifecycles.

## Updating the Public Site

1. Receive new export zip from Antigravity
2. Extract to temporary folder
3. Replace `apps/public-site/` contents
4. Run boundary checks: `npm run lint:boundaries`
5. Test public routes: `npm run dev:public`
6. Commit with message: `chore(public-site): update to Antigravity export YYYY-MM-DD`

## Verification

Run before every commit:
```bash
npm run lint:boundaries
```
```

### `apps/public-site/README.md`

Prepend to existing README:

```markdown
---
**OWNERSHIP NOTICE**

This folder contains the Antigravity-exported public marketing site.

- **Owner:** Antigravity (external vendor)
- **Edit Policy:** Do not edit by hand. Update by re-importing zip export.
- **Last Updated:** 2026-02-05
- **Export Source:** `voice-ai-os/research/public_site.zip`

To update:
1. Receive new export from Antigravity
2. Replace folder contents
3. Run `npm run lint:boundaries` from repo root
4. Commit with message: `chore(public-site): update to export YYYY-MM-DD`

---

[... original Antigravity README content follows ...]
```

---

## Forms Handling

The public site forms (Consultation, Contact) are currently static placeholders.

**Current State:**
- Forms log to console or simulate a delay
- No backend submission

**Recommended Approach (Separate Task):**
- Use a third-party form service (Formspree, Basin, Formspark)
- Or create a minimal `/api/forms` endpoint in `voice-core` (separate from dashboard APIs)
- Do NOT add Supabase or dashboard session logic to public site

**Example (Formspree):**
```typescript
// apps/public-site/pages/Consultation.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  
  try {
    const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    if (response.ok) {
      toast.success("Request submitted!");
      setSubmitted(true);
    }
  } catch (error) {
    toast.error("Failed to submit.");
  } finally {
    setIsLoading(false);
  }
};
```

---

## Verification Checklist

Before deploying:

### Public Site
- [ ] Public site builds successfully: `npm run build:public`
- [ ] Public routes render: `/`, `/consultation`, `/contact`, `/terms`, `/privacy`
- [ ] No Supabase imports: `npm run lint:boundaries`
- [ ] No dashboard imports: `npm run lint:boundaries`
- [ ] Forms are placeholders (log to console or use external service)
- [ ] Assets load correctly
- [ ] Mobile responsive

### Web App (Dashboards)
- [ ] Dashboard builds successfully: `npm run build:web`
- [ ] `/dashboard` route renders
- [ ] `/admin` routes render
- [ ] Session/auth works
- [ ] No public site imports: `npm run lint:boundaries`

### Platform Routing
- [ ] `vercel.json` or equivalent routing config added
- [ ] Public routes (`/`, `/consultation`) serve from `apps/public-site`
- [ ] Dashboard routes (`/dashboard`, `/admin`) serve from `apps/web`
- [ ] No route conflicts

### CI/CD
- [ ] Boundary checks run in CI
- [ ] Both apps build in CI
- [ ] Platform deployment config tested

---

## Timeline & Next Steps

### Phase 1: Folder Migration (1 hour)
- Create `apps/` structure
- Move public site export
- Move `onboarding-ui` → `apps/web`
- Add root `package.json` workspace config

### Phase 2: Boundary Enforcement (1 hour)
- Create `scripts/check-boundaries.js`
- Add `npm run lint:boundaries` script
- Test on current codebase
- Add to CI workflow

### Phase 3: Documentation (30 min)
- Create `BOUNDARIES.md`
- Update `apps/public-site/README.md` with ownership notice
- Update root `README.md` with new structure

### Phase 4: Platform Config (30 min)
- Add `vercel.json` or equivalent
- Configure routing rules
- Test deployment preview

### Phase 5: Validation (30 min)
- Run verification checklist
- Test all routes locally
- Test on deployed preview

**Total Estimated Time:** 3.5 hours

---

## Platform Deployment Examples

### Vercel
```json
{
  "builds": [
    {
      "src": "apps/public-site/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "apps/web/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    { "src": "/dashboard(.*)", "dest": "/apps/web$1" },
    { "src": "/admin(.*)", "dest": "/apps/web$1" },
    { "src": "/api/(.*)", "dest": "/apps/web/api/$1" },
    { "src": "/(.*)", "dest": "/apps/public-site/$1" }
  ]
}
```

### Netlify (`netlify.toml`)
```toml
[[redirects]]
  from = "/dashboard/*"
  to = "/.netlify/functions/web/:splat"
  status = 200

[[redirects]]
  from = "/admin/*"
  to = "/.netlify/functions/web/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/public-site/:splat"
  status = 200
```

### Cloudflare Pages (`_routes.json`)
```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/dashboard/*", "/admin/*"]
}
```

---

## Alternatives Considered (Rejected)

### Approach 2: Port Public Site to Next.js
**Pros:**
- Single framework
- Easier local dev (one `npm run dev`)

**Cons:**
- Requires porting Vite → Next (effort + ongoing maintenance)
- Couples marketing updates to Next version
- Antigravity export becomes stale (can't re-import)
- Risk of polluting public pages with Next-specific logic (server actions, etc.)

**Decision:** Rejected. Separate apps preserve vendor boundaries.

---

## Success Criteria

✅ Public site renders at `/`, `/consultation`, `/contact`, `/terms`, `/privacy`  
✅ Dashboards render at `/dashboard`, `/admin/*`  
✅ No Supabase/auth/db imports in public site  
✅ No marketing imports in dashboards  
✅ Boundary checks pass in CI  
✅ Single domain routing works  
✅ Antigravity README preserved verbatim  
✅ Update process documented  
