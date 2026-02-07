# Integration Test Checklist
*Manual testing checklist for production readiness*

## Authentication Flow

### Login
- [ ] Login with valid credentials (admin)
- [ ] Verify `session_token` cookie set
- [ ] Verify `sf_session` cookie set
- [ ] Verify redirect to dashboard
- [ ] Login with invalid email → expect error
- [ ] Login with invalid password → expect error
- [ ] Check session in database: `SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;`

### Session Validation
- [ ] Access protected endpoint with valid session → expect 200
- [ ] Access protected endpoint without cookie → expect 401
- [ ] Delete session from DB, try to access → expect 401
- [ ] Login, verify `last_login_at` updated in users table

### Logout
- [ ] Logout via `/api/auth/logout`
- [ ] Verify session deleted from database
- [ ] Verify cookies cleared
- [ ] Try to access protected endpoint → expect 401

### Authorization
- [ ] Admin user can access `/api/admin/agents` → expect 200
- [ ] Customer user tries `/api/admin/agents` → expect 403 (if you have customer role)
- [ ] User tries to access another tenant's data → expect 403

---

## Voice Pipeline

### Basic Call Flow
- [ ] Start test call: `POST /start_call`
- [ ] Verify call appears in `call_logs` table
- [ ] Verify call status is "active" or "in_progress"
- [ ] Stop call: `POST /stop_call`
- [ ] Verify call status updated to "completed"
- [ ] Verify duration calculated
- [ ] Check costs tracked (STT, LLM, TTS)

### Knowledge Base Integration
- [ ] Create knowledge base via `/api/knowledge-bases`
- [ ] Start call with knowledge base configured
- [ ] Ask question that requires knowledge base
- [ ] Verify correct response
- [ ] Check logs for RAG retrieval

### Caller History Context
- [ ] Make first call from a phone number
- [ ] Verify `call_history` entry created
- [ ] Make second call from same number
- [ ] Verify bot has context from previous call

### Call Transfer
- [ ] Configure `transfer_contact_phone` in tenant config
- [ ] Make call and request transfer
- [ ] Verify transfer initiated
- [ ] Check call log for transfer outcome

---

## Error Handling

### LLM Provider Failure
- [ ] Set invalid OpenAI and Gemini API keys in `.env`
- [ ] Start test call
- [ ] Verify fallback message plays to caller
- [ ] Verify call transfers (if transfer phone configured)
- [ ] Check `system_errors` table for logged error
- [ ] Check `call_logs` status is "failed"
- [ ] Restore valid API keys

### TTS Provider Failure
- [ ] Set invalid Cartesia and ElevenLabs API keys
- [ ] Start test call
- [ ] Verify fallback message plays via Twilio TTS
- [ ] Verify call transfers or hangs up gracefully
- [ ] Check `system_errors` table
- [ ] Restore valid API keys

### Database Connection Failure
- [ ] Stop PostgreSQL service
- [ ] Try to start call → expect error
- [ ] Try to access dashboard → expect error
- [ ] Check logs for connection error
- [ ] Restart PostgreSQL
- [ ] Verify system recovers

---

## Cost Tracking

### Per-Call Costs
- [ ] Make 3 test calls
- [ ] Query `call_logs`: `SELECT call_id, stt_cost_usd, llm_cost_usd, tts_cost_usd, total_cost_usd FROM call_logs ORDER BY started_at DESC LIMIT 3;`
- [ ] Verify costs are non-zero and reasonable
- [ ] Verify `total_cost_usd = stt_cost_usd + llm_cost_usd + tts_cost_usd`

### Admin Cost Analytics
- [ ] Access Admin Intelligence page
- [ ] Check "Cost Analytics" section
- [ ] Verify shows real cost data (not mock)
- [ ] Verify cost breakdown by provider (STT, LLM, TTS)
- [ ] Test date range filter

---

## Admin Features

### Agent Management
- [ ] Access Admin Control Panel → Agents page
- [ ] Verify shows all tenants
- [ ] Click "View Details" on tenant
- [ ] Verify tenant config loads

### Onboarding New Agent
- [ ] Start onboarding: `POST /api/onboarding/start`
- [ ] Complete each step (system prompt, knowledge base, telephony)
- [ ] Complete onboarding: `POST /api/onboarding/{session_id}/complete`
- [ ] Verify new tenant created
- [ ] Verify tenant config saved

### User Invitation
- [ ] Invite user: `POST /api/admin/invite-user`
- [ ] Check email (if configured) or database for invitation
- [ ] Accept invitation → set password
- [ ] Login with new user

### Intelligence Dashboard
- [ ] Make 10+ test calls with varied outcomes
- [ ] Access Intelligence page
- [ ] Verify "Outcome Distribution" shows real data
- [ ] Verify "Reason Taxonomy" shows real reasons
- [ ] Verify "Action Required Rate" calculated correctly

### Quality Dashboard
- [ ] Trigger some errors (invalid API keys)
- [ ] Access Quality page
- [ ] Verify shows real errors from `system_errors` table
- [ ] Verify grouped by type and severity
- [ ] Verify error details include stack trace

---

## Customer Dashboard (View-Only)

### Call Logs
- [ ] Login as customer user
- [ ] Access Customer Dashboard
- [ ] Verify shows calls for their tenant only
- [ ] Test filters (date range, status, outcome)
- [ ] Test search (phone number, reason)
- [ ] Verify call details modal loads

### Export
- [ ] Click "Export" button
- [ ] Verify CSV download
- [ ] Verify CSV contains correct data

### Action Items
- [ ] Mark call as "requires action"
- [ ] Verify appears in action items list
- [ ] Resolve action item
- [ ] Verify removed from list

### Archive
- [ ] Archive old call
- [ ] Verify hidden from main list
- [ ] Toggle "Show archived"
- [ ] Verify appears in archived list

---

## Stress & Load Testing

### Adversarial Conversations
- [ ] Run: `python voice-core/tests/manual_stress_test.py`
- [ ] Target: ≥85% pass rate
- [ ] Target: <120s duration
- [ ] Review failed conversations for improvements

### Concurrent Calls
- [ ] Run: `python voice-core/tests/load_test_concurrent_calls.py 10`
- [ ] Target: ≥90% success rate
- [ ] Target: <10s avg duration
- [ ] Monitor CPU and memory during test

### Database Connection Pool
- [ ] Run: `python voice-core/tests/db_connection_test.py`
- [ ] Target: 100% success rate
- [ ] Verify no connection leaks

---

## Production Environment

### SSL/HTTPS
- [ ] Access via HTTPS: `https://yourdomain.com`
- [ ] Verify valid SSL certificate (no warnings)
- [ ] Test all API endpoints via HTTPS
- [ ] Verify WebSocket works over WSS

### CORS
- [ ] Access frontend from production domain
- [ ] Verify API calls work (no CORS errors in console)
- [ ] Try to access from unauthorized domain → expect CORS error

### Rate Limiting
- [ ] Make 100+ rapid requests to same endpoint
- [ ] Verify rate limit kicks in (429 response)
- [ ] Verify `X-RateLimit-*` headers present
- [ ] Wait for reset period, verify access restored

### Error Monitoring
- [ ] Trigger error (e.g., access invalid endpoint)
- [ ] Check Sentry dashboard for captured error
- [ ] Verify error includes context (user, tenant, etc.)

### Health Check
- [ ] Access `/health` endpoint
- [ ] Verify returns 200 OK
- [ ] Verify response time <100ms
