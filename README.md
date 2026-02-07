# SpotFunnel Voice AI Platform

Production-grade voice AI platform for Australian businesses with integrated public marketing site.

## Monorepo Structure

```
VoiceAIProduction/
├── apps/
│   ├── public-site/          # Marketing website (Vite/React/Tailwind)
│   │   └── README.md         # ⚠️ Read-only: Antigravity vendor export
│   └── web/                  # Dashboards (Next.js)
│       ├── src/app/dashboard/  # Customer dashboard
│       └── src/app/admin/      # Admin control panel
├── voice-core/               # Python voice pipeline backend
├── voice-ai-os/              # Orchestration layer
├── monitoring/               # Observability stack
└── scripts/                  # Tooling and checks
```

## Quick Start

### Install Dependencies

```bash
# Root workspace (installs all apps)
npm install
```

### Development

```bash
# Public marketing site
npm run dev:public
# → http://localhost:8080

# Dashboard (Next.js)
npm run dev:web
# → http://localhost:3000

# Both simultaneously
npm run dev:all
```

### Production Builds

```bash
# Public site
npm run build:public

# Dashboard
npm run build:web

# Both
npm run build:all
```

### Boundary Enforcement

```bash
# Check for forbidden imports
npm run lint:boundaries
```

See `BOUNDARIES.md` for ownership rules and import restrictions.

## Routing (Single Domain)

| Path | App | Description |
|------|-----|-------------|
| `/` | `public-site` | Marketing home |
| `/consultation` | `public-site` | Booking form |
| `/contact` | `public-site` | Contact form |
| `/terms`, `/privacy` | `public-site` | Legal pages |
| `/dashboard` | `web` | Customer dashboard |
| `/admin/*` | `web` | Admin control panel |

**Platform:** Configured via `vercel.json` (Vercel/Netlify/Cloudflare)

## Architecture

### Apps

#### `apps/public-site/` (Antigravity Export)

- **Framework:** Vite + React + Tailwind
- **Owner:** Antigravity (external vendor)
- **Edit Policy:** Read-only. Update by re-importing export.
- **Purpose:** Static marketing site
- **Pages:** Home, Consultation, Contact, Terms, Privacy
- **Constraints:**
  - No Supabase
  - No auth/session
  - No database dependencies
  - No backend logic

See `apps/public-site/README.md` for update procedures.

#### `apps/web/` (Internal Dashboard)

- **Framework:** Next.js 14 + React + Tailwind
- **Owner:** Cursor (internal team)
- **Edit Policy:** Editable
- **Purpose:** Customer dashboard + admin control panel
- **Routes:**
  - `/dashboard` — Customer dashboard (call logs, analytics, config)
  - `/admin/*` — Operator control panel (multi-tenant management)
- **Features:**
  - Server-side session management
  - Real-time WebSocket updates
  - Call log export
  - SpotFunnel design system

### Backend

#### `voice-core/` (Python)

- **Framework:** FastAPI + Pipecat
- **Purpose:** Real-time voice pipeline
- **Endpoints:**
  - `/start_call`, `/stop_call` — Call lifecycle
  - `/api/dashboard/*` — Dashboard APIs
  - `/ws/dashboard/{tenant_id}` — Real-time updates
- **Database:** PostgreSQL (schema in `voice-ai-os/orchestration/schema/`)

#### `voice-ai-os/` (Orchestration)

- **Purpose:** Tenant configuration, objective graphs, event sourcing
- **Schema:** `orchestration/schema/schema.sql`

#### `monitoring/` (Observability)

- **Framework:** TypeScript + Python
- **Purpose:** Metrics collection, alerting, cost tracking
- **Dashboards:** Grafana configurations

## Development Workflow

### Adding Features to Dashboard

1. Edit `apps/web/src/app/dashboard/` or `apps/web/src/app/admin/`
2. Add components to `apps/web/src/components/dashboard/`
3. Run `npm run lint:boundaries` to verify no public site imports
4. Test with `npm run dev:web`

### Updating Public Site

1. Receive new export from Antigravity
2. Replace `apps/public-site/` contents
3. Run `npm run lint:boundaries`
4. Test with `npm run dev:public`
5. Commit: `chore(public-site): update to export YYYY-MM-DD`

See `BOUNDARIES.md` for full procedures.

### Adding Backend APIs

1. Edit `voice-core/src/api/`
2. Add endpoints to router
3. Register router in `voice-core/src/bot_runner.py`
4. Update schema in `voice-ai-os/orchestration/schema/` if needed

## Testing

```bash
# Frontend linting (web app)
cd apps/web
npm run lint

# Backend tests
cd voice-core
pytest tests/

# Boundary checks (monorepo)
npm run lint:boundaries
```

## Deployment

### Platform Routing (Vercel Example)

`vercel.json` configures multi-app routing:
- Public routes (`/`, `/consultation`, etc.) → `apps/public-site`
- Dashboard routes (`/dashboard/*`, `/admin/*`) → `apps/web`

See `vercel.json` for configuration details.

### Environment Variables

**Public Site:**
- None required (static build)

**Dashboard (`apps/web`):**
- `DEFAULT_TENANT_ID` — Fallback tenant for dev/testing
- `DEFAULT_ROLE` — Fallback role for dev/testing

**Backend (`voice-core`):**
- `DATABASE_URL` or `POSTGRES_*` — Database connection
- `DEEPGRAM_API_KEY` — STT service
- `GEMINI_API_KEY`, `OPENAI_API_KEY` — LLM providers
- `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY` — TTS providers

## Documentation

- **`BOUNDARIES.md`** — Ownership model and import rules
- **`PUBLIC_SITE_INTEGRATION_PLAN.md`** — Full integration plan
- **`PUBLIC_SITE_INTEGRATION_SUMMARY.md`** — What was done
- **`SECURITY.md`** — Security findings and mitigation plans
- **`apps/public-site/README.md`** — Public site documentation (Antigravity)
- **`apps/web/README.md`** — Dashboard documentation

## Contributing

### Ownership

- **Public Site (`apps/public-site/`):** Antigravity vendor. Do not edit by hand.
- **Everything Else:** Cursor internal team. Editable.

### Before Committing

1. Run boundary checks: `npm run lint:boundaries`
2. Run linters: `cd apps/web && npm run lint`
3. Test locally: `npm run dev:all`

### Import Rules

See `BOUNDARIES.md` for detailed import restrictions.

**TL;DR:**
- Public site: no dashboard/database imports
- Dashboard: no public site imports

## Contact

- **Public site updates:** Antigravity vendor
- **Dashboard/backend:** Cursor internal team
- **Boundary questions:** See `BOUNDARIES.md`
