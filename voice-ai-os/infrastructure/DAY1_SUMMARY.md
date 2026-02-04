# Day 1 Foundation - Setup Summary

## ✅ Completed Deliverables

### 1. Docker Compose Configuration (`docker-compose.yml`)

**Services Configured:**
- **PostgreSQL 15** - Optimized for high write throughput
  - Write-optimized settings: `synchronous_commit=off`, increased WAL buffers
  - Health checks with proper startup period
  - Persistent volumes for data
- **Redis 7** - For phone → tenant routing cache
  - AOF persistence enabled
  - Memory limits and LRU eviction policy
  - Health checks configured
- **PgAdmin 4** - Database management UI (optional)
  - Health checks and dependency on PostgreSQL

**Key Optimizations:**
- PostgreSQL configured for high write throughput (events table)
- All services have health checks
- Proper service dependencies
- Environment variable support

### 2. Database Schema (`postgres/init.sql`)

**Tables Created:**
- `tenants` - Multi-tenant customer data
- `objective_configs` - Versioned, immutable configurations
- `conversations` - Conversation metadata with trace_id
- `events` - Append-only event stream (optimized for writes)
- `objectives` - Caching table for objective state

**Critical Indexes for High Write Throughput:**
- `idx_events_trace_id_sequence` - Composite index on (trace_id, sequence_number)
- `idx_events_tenant_id_timestamp` - Tenant-based queries
- `idx_events_event_type` - Event type filtering
- `idx_events_timestamp` - Time-based queries
- `idx_tenants_phone_number` - Phone → tenant routing

**Features:**
- Event sourcing functions (`emit_event`, `get_conversation_events`)
- Views for common queries
- Triggers for `updated_at` timestamps
- Seed data for development

### 3. Database Migrations (`database/migrations/`)

**Migration System:**
- `001_initial_schema.sql` - Initial schema migration
- `migrate.py` - Python migration runner
  - Tracks applied migrations in `schema_migrations` table
  - Supports dry-run mode
  - Idempotent migrations (uses `IF NOT EXISTS`)

**Usage:**
```bash
python database/migrate.py --database-url $DATABASE_URL
```

### 4. Environment Variables (`.env.example`)

**Configured Variables:**
- Database: `DATABASE_URL`, `POSTGRES_*`
- Redis: `REDIS_URL`, `REDIS_PORT`, `REDIS_PASSWORD`
- API Keys: Deepgram, AssemblyAI, OpenAI, ElevenLabs, Twilio
- Application: `NODE_ENV`, `LOG_LEVEL`, `PORT`
- Feature Flags: `ENABLE_REDIS_CACHE`, `ENABLE_EVENT_STREAMING`

### 5. Setup Scripts

**Linux/Mac** (`scripts/setup.sh`):
- Checks prerequisites (Docker, Docker Compose, Python)
- Creates `.env` from `.env.example`
- Starts Docker services
- Waits for services to be healthy
- Installs Python dependencies
- Runs database migrations

**Windows** (`scripts/setup.ps1`):
- Same functionality as Linux/Mac script
- PowerShell-native implementation
- Color-coded output

## 📊 Database Schema Overview

### Core Tables

1. **tenants**
   - Stores customer (tenant) information
   - Phone number for routing (cached in Redis)
   - Multi-tenant isolation

2. **conversations**
   - Conversation metadata
   - Links to events via `trace_id`
   - Status tracking

3. **events** (Append-only)
   - Event-sourced architecture
   - Indexed by `trace_id` + `sequence_number`
   - Optimized for high write throughput
   - Never updated or deleted

4. **objectives**
   - Caching table for objective state
   - Reconstructable from events
   - Tracks objective execution

5. **objective_configs**
   - Versioned, immutable configurations
   - JSONB objective graphs
   - Active/inactive status

### Indexes

**Events Table (High Write Throughput):**
- `idx_events_trace_id_sequence` - Primary query pattern (replay)
- `idx_events_tenant_id_timestamp` - Tenant-based queries
- `idx_events_event_type` - Event filtering
- `idx_events_timestamp` - Time-based queries

**Routing:**
- `idx_tenants_phone_number` - Phone → tenant lookup (cached in Redis)

## 🚀 Setup Instructions

### Quick Start

**Linux/Mac:**
```bash
cd infrastructure
./scripts/setup.sh
```

**Windows PowerShell:**
```powershell
cd infrastructure
.\scripts\setup.ps1
```

### Manual Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with your API keys**

3. **Start Docker services:**
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to be healthy:**
   ```bash
   docker-compose ps
   ```

5. **Run migrations:**
   ```bash
   python database/migrate.py --database-url $DATABASE_URL
   ```

### Verify Setup

**Check services:**
```bash
docker-compose ps
```

**Check PostgreSQL:**
```bash
docker-compose exec postgres pg_isready -U spotfunnel
```

**Check Redis:**
```bash
docker-compose exec redis redis-cli ping
```

**View logs:**
```bash
docker-compose logs -f
```

## 🔗 Connection Strings

**PostgreSQL:**
```
postgresql://spotfunnel:dev@localhost:5432/spotfunnel
```

**Redis:**
```
redis://localhost:6379
```

**PgAdmin:**
```
http://localhost:5050
```

## 📝 Next Steps for Day 2

1. **API Layer**
   - REST API endpoints for tenants, conversations, events
   - Authentication/authorization
   - Rate limiting

2. **Phone Routing Service**
   - Redis caching for phone → tenant lookups
   - Sub-100ms routing performance
   - Fallback to database

3. **Event Ingestion**
   - Event streaming endpoint
   - Validation and sanitization
   - Batch insertion for performance

4. **Configuration Management**
   - Objective graph validation
   - Version management
   - Deployment workflows

## 🧪 Testing

**Test PostgreSQL connection:**
```bash
docker-compose exec postgres psql -U spotfunnel -d spotfunnel -c "SELECT COUNT(*) FROM tenants;"
```

**Test Redis connection:**
```bash
docker-compose exec redis redis-cli SET test_key "test_value"
docker-compose exec redis redis-cli GET test_key
```

**Test migrations:**
```bash
python database/migrate.py --database-url $DATABASE_URL --dry-run
```

## 📚 File Structure

```
infrastructure/
├── docker-compose.yml          # Docker services configuration
├── .env.example                # Environment variables template
├── postgres/
│   └── init.sql               # Initial schema (runs on first startup)
├── database/
│   ├── schema.sql             # Reference schema
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── migrate.py             # Migration runner
│   └── requirements.txt        # Python dependencies
└── scripts/
    ├── setup.sh               # Linux/Mac setup script
    └── setup.ps1              # Windows setup script
```

## ⚠️ Important Notes

1. **PostgreSQL Write Optimization:**
   - `synchronous_commit=off` for better write performance
   - Increased WAL buffers and checkpoint intervals
   - Suitable for development; adjust for production

2. **Redis Caching:**
   - Phone → tenant mappings should be cached in Redis
   - TTL recommended for cache entries
   - Fallback to database on cache miss

3. **Event Sourcing:**
   - Events are append-only (never updated/deleted)
   - Use `emit_event()` function for consistency
   - Sequence numbers ensure ordering

4. **Multi-Tenant Isolation:**
   - All queries must filter by `tenant_id`
   - Use views and functions for safety
   - Indexes support tenant-based queries

5. **Environment Variables:**
   - Never commit `.env` to version control
   - Use `.env.example` as template
   - Rotate API keys regularly

## 🐛 Troubleshooting

**Services won't start:**
- Check Docker is running: `docker ps`
- Check ports are available: `netstat -an | grep 5432`
- View logs: `docker-compose logs`

**Migrations fail:**
- Ensure PostgreSQL is healthy: `docker-compose ps`
- Check connection string in `.env`
- Verify Python dependencies: `pip install -r database/requirements.txt`

**Connection errors:**
- Verify services are up: `docker-compose ps`
- Check environment variables: `cat .env`
- Test connection: `docker-compose exec postgres pg_isready`
