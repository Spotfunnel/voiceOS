# Database Schema Documentation

## Core Tables

### tenants
Customer organizations (agents).

**Key fields:**
- `tenant_id`: UUID primary key
- `business_name`: Organization name
- `phone_number`: Routing phone number
- `state`, `timezone`, `locale`: Locale settings
- `status`: active/inactive/suspended
- `metadata`: JSONB configuration

### objective_configs
Active objective graph configuration per tenant.

**Key fields:**
- `config_id`: UUID primary key
- `tenant_id`: FK to tenants
- `version`: Integer version
- `objective_graph`: JSONB objective graph
- `active`: Boolean
- `schema_version`: Schema version

### users
Customer user accounts (1:1 with tenants).

**Key fields:**
- `user_id`: UUID primary key
- `tenant_id`: FK to tenants
- `email`: Unique login email
- `password_hash`: bcrypt hash
- `role`: customer/operator
- `last_login`: Timestamp

### sessions
Active session tokens for authentication.

**Key fields:**
- `session_id`: UUID primary key
- `user_id`: FK to users
- `session_hash`: SHA-256 hash of session token
- `expires_at`: Expiration timestamp
- `last_accessed_at`: Last activity timestamp
- `user_agent`: Browser/device user agent
- `ip_address`: IP address when created

### call_logs
Comprehensive call history and analytics.

**Key fields:**
- `call_log_id`: UUID primary key
- `call_id`: Unique call identifier
- `tenant_id`: FK to tenants
- `status`: Call status
- `transcript`: Conversation text
- `summary`: AI-generated summary
- `outcome`: Call outcome category
- `captured_data`: JSONB extracted fields
- `stt_cost_usd`, `llm_cost_usd`, `tts_cost_usd`, `total_cost_usd`: Cost tracking

### system_errors
Structured error logs for monitoring and quality.

**Key fields:**
- `error_id`: UUID primary key
- `tenant_id`: FK to tenants (optional)
- `call_id`: Related call (optional)
- `error_type`, `error_message`, `stack_trace`
- `severity`: ERROR/CRITICAL/WARNING
- `context`: JSONB context payload
- `resolved`: Boolean

## Relationships

```
tenants ──┬── objective_configs
          ├── users ── sessions
          ├── call_logs
          └── system_errors
```

## Migration History

1. `001_initial_schema.sql` - Base schema
2. `002_add_user_authentication.sql` - Users/auth tables
3. `003_add_dashboard_options.sql` - Dashboard config
4. `004_add_calendar_integration.sql`
5. `005_add_phone_routing.sql`
6. `006_add_multi_knowledge_bases.sql`
7. `007_fix_onboarding_foreign_key.sql`
8. `008_add_call_history.sql`
9. `009_add_sessions_table.sql`
10. `010_add_call_logs.sql`
11. `011_add_system_errors.sql`
12. `012_session_improvements.sql`

## Notes

- Prisma schema in `infrastructure/prisma/schema.prisma` reflects an earlier model; update before using Prisma in production.
- All production access currently uses direct SQL via `psycopg2` in `voice-core`.
