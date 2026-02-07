# Public Site Integration Summary

**Date:** 2026-02-05  
**Status:** ✅ Complete (pending dependency installation)

## What Was Done

### 1. Folder Structure Created

✅ **Created monorepo structure:**
```
VoiceAIProduction/
├── apps/
│   ├── public-site/        # NEW: Antigravity Vite export
│   └── web/                # NEW: Renamed from onboarding-ui
├── scripts/
│   └── check-boundaries.js # NEW: Boundary enforcement
├── package.json            # NEW: Root workspace config
├── vercel.json             # NEW: Platform routing config
├── BOUNDARIES.md           # NEW: Ownership documentation
└── PUBLIC_SITE_INTEGRATION_PLAN.md  # NEW: Full integration plan
```

### 2. Public Site Moved

✅ **Source:** `voice-ai-os/research/public_site_extracted/public_site/`  
✅ **Destination:** `apps/public-site/`  
✅ **Ownership notice added to README**

**Contents:**
- Vite + React + Tailwind application
- Pages: `/`, `/consultation`, `/contact`, `/terms`, `/privacy`
- No Supabase, no auth, no database dependencies (verified)
- Static forms (console logging only)

### 3. Dashboard App Moved

✅ **Source:** `onboarding-ui/`  
✅ **Destination:** `apps/web/`

**Contents:**
- Next.js application
- Routes: `/dashboard`, `/admin/*`
- Customer dashboard components
- Server-side session logic
- Call logs API

### 4. Boundary Enforcement

✅ **Created `scripts/check-boundaries.js`:**
- Scans all `.ts`, `.tsx`, `.js`, `.jsx` files
- Detects forbidden imports:
  - Public site ❌ dashboard/supabase/database
  - Dashboard ❌ public site
- Runs via: `npm run lint:boundaries`

✅ **Created `BOUNDARIES.md`:**
- Documents ownership model
- Lists import rules
- Provides update procedures
- Troubleshooting guide

### 5. Root Workspace Configuration

✅ **Created `package.json` at repo root:**
- Defines workspaces: `apps/*`, `monitoring`
- Scripts:
  - `npm run dev:public` — Start public site
  - `npm run dev:web` — Start dashboard
  - `npm run build:public` — Build public site
  - `npm run build:web` — Build dashboard
  - `npm run lint:boundaries` — Check boundaries

✅ **Dependencies:**
- `concurrently` — Run multiple dev servers
- `glob` — File scanning for boundary checks

### 6. Platform Routing

✅ **Created `vercel.json`:**
- Routes `/dashboard/*` → `apps/web`
- Routes `/admin/*` → `apps/web`
- Routes `/*` → `apps/public-site` (catch-all)

### 7. Documentation

✅ **Created/Updated:**
- `PUBLIC_SITE_INTEGRATION_PLAN.md` — Full integration plan
- `BOUNDARIES.md` — Ownership and import rules
- `apps/public-site/README.md` — Added ownership notice
- This summary document

---

## Verification Steps

### ✅ Completed

- [x] Folder structure created
- [x] Public site moved to `apps/public-site/`
- [x] Dashboard moved to `apps/web/`
- [x] Boundary check script created
- [x] Documentation written
- [x] Platform routing config added
- [x] Ownership notices added

### ⏳ Pending (Requires npm install to complete)

- [ ] Install root workspace dependencies (`npm install` in progress)
- [ ] Run boundary checks: `npm run lint:boundaries`
- [ ] Test public site dev server: `npm run dev:public`
- [ ] Test dashboard dev server: `npm run dev:web`
- [ ] Verify no forbidden imports exist

### 📋 Next Steps (Post-Install)

1. **Run boundary checks:**
   ```bash
   npm run lint:boundaries
   ```
   Expected: ✅ No violations

2. **Test public site locally:**
   ```bash
   npm run dev:public
   # Visit http://localhost:8080
   ```
   Verify pages: `/`, `/consultation`, `/contact`, `/terms`, `/privacy`

3. **Test dashboard locally:**
   ```bash
   npm run dev:web
   # Visit http://localhost:3000/dashboard
   ```
   Verify dashboard renders

4. **Update `.gitignore` (if needed):**
   ```
   # Remove old path
   - /onboarding-ui/node_modules
   - /onboarding-ui/.next
   
   # Add new paths
   + /apps/*/node_modules
   + /apps/*/.next
   + /apps/*/dist
   ```

5. **Update CI/CD:**
   - Add boundary check to CI workflow
   - Update build/deploy scripts to use `apps/*` paths
   - Test deployment preview

6. **Clean up old files:**
   ```bash
   # After verifying apps/* works:
   rm -rf onboarding-ui/  # Already moved to apps/web
   rm -rf voice-ai-os/research/public_site_extracted/
   rm voice-ai-os/research/public_site.zip  # Keep as backup or remove
   ```

---

## Architecture Decision

**Selected:** Approach 1 — Monorepo with separate apps

**Why:**
- ✅ Preserves Antigravity export exactly as delivered
- ✅ No framework conversion required (Vite stays Vite)
- ✅ Clean separation of ownership (Antigravity vs. Cursor)
- ✅ Platform routing trivially supports multi-app pattern
- ✅ Future updates: just replace `apps/public-site/` folder
- ✅ No risk of polluting marketing with dashboard logic

**Rejected:** Approach 2 (Port to Next.js)
- ❌ Requires porting Vite → Next (effort + maintenance)
- ❌ Couples marketing to Next.js version
- ❌ Can't re-import future Antigravity exports
- ❌ Risk of adding server actions/API routes to public pages

---

## Routing Model

Single domain (`spotfunnel.com`) serves both apps:

| Path | Serves | App |
|------|--------|-----|
| `/` | Marketing home | `apps/public-site` |
| `/consultation` | Booking form | `apps/public-site` |
| `/contact` | Contact form | `apps/public-site` |
| `/terms` | Terms page | `apps/public-site` |
| `/privacy` | Privacy page | `apps/public-site` |
| `/dashboard` | Customer dashboard | `apps/web` (Next.js) |
| `/dashboard/*` | Dashboard routes | `apps/web` (Next.js) |
| `/admin` | Admin control panel | `apps/web` (Next.js) |
| `/admin/*` | Admin routes | `apps/web` (Next.js) |

**Platform:** Vercel / Netlify / Cloudflare Pages (configured via `vercel.json`)

---

## Import Rules (Enforced)

### Public Site (`apps/public-site/`)

**CANNOT import:**
- ❌ `@supabase/*` or `supabase`
- ❌ `apps/web/*` (dashboard code)
- ❌ `prisma`, `typeorm`, `pg` (database clients)
- ❌ Auth/session modules

**WHY:** Public site is static-deployable, vendor-maintained, no secrets.

### Dashboard (`apps/web/`)

**CANNOT import:**
- ❌ `apps/public-site/*` (marketing code)

**WHY:** Separate lifecycles, no coupling.

**Enforcement:** Automated via `npm run lint:boundaries`

---

## Forms Handling

**Current state:**
- Consultation form: logs to console, simulates delay
- Contact form: logs to console, simulates delay

**Recommended approach:**
- Use external form service (Formspree, Basin, etc.)
- OR create minimal `/api/forms` endpoint in `voice-core`
- Do NOT add Supabase/auth to public site

---

## Questions & Troubleshooting

### How do I update the public site?

1. Get new export zip from Antigravity
2. Extract and replace `apps/public-site/*` contents
3. Run `npm run lint:boundaries`
4. Test with `npm run dev:public`
5. Commit: `chore(public-site): update to export YYYY-MM-DD`

See `BOUNDARIES.md` for full procedure.

### What if boundary check fails?

```bash
❌ BOUNDARY VIOLATION
File: apps/public-site/pages/Consultation.tsx:15
Reason: Public site cannot import from dashboard app
Line: import { useAuth } from '../../web/src/contexts/AuthContext';
```

**Fix:** Remove the import. Public site must be standalone.

### Can I create a shared component library?

**No** — Public site and dashboard have different owners.

**Exception:** Design tokens package (colors, spacing only) is allowed.

---

## Success Metrics

✅ Folder structure migrated  
⏳ Boundary checks pass (pending npm install)  
⏳ Public site builds independently  
⏳ Dashboard builds independently  
✅ Single domain routing configured  
✅ Documentation complete  
✅ Update process documented  

---

## Next Iteration (Future)

1. **CI Integration:**
   - Add boundary check to GitHub Actions
   - Add build tests for both apps
   - Add deployment preview comments

2. **Forms Integration:**
   - Connect Consultation form to backend
   - Connect Contact form to backend
   - Add form validation

3. **Analytics:**
   - Add analytics to public site (no user data)
   - Track form submissions
   - Monitor page views

4. **Performance:**
   - Optimize public site build size
   - Add CDN configuration
   - Enable caching headers

---

## Files Created/Modified

### Created
- `apps/` folder structure
- `apps/public-site/` (moved from research)
- `apps/web/` (moved from onboarding-ui)
- `scripts/check-boundaries.js`
- `package.json` (root)
- `vercel.json`
- `BOUNDARIES.md`
- `PUBLIC_SITE_INTEGRATION_PLAN.md`
- `PUBLIC_SITE_INTEGRATION_SUMMARY.md` (this file)

### Modified
- `apps/public-site/README.md` (added ownership notice)

### To Be Removed (After Verification)
- `onboarding-ui/` (already copied to `apps/web/`)
- `voice-ai-os/research/public_site_extracted/`
- `voice-ai-os/research/public_site.zip` (optional: keep as backup)

---

## Contact

- **Public site updates:** Antigravity (external vendor)
- **Dashboard features:** Cursor team (internal)
- **Boundary enforcement:** See `BOUNDARIES.md`
- **Integration questions:** See `PUBLIC_SITE_INTEGRATION_PLAN.md`
