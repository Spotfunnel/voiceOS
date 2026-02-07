# Automated Stress Test Plan
**Pre-Production System Verification**

**Goal:** Fully automated stress testing of the entire system without user involvement.

---

## Test Strategy

1. **Setup Verification** - Ensure all dependencies and services are ready
2. **Database Tests** - Connection pooling, migrations, data integrity
3. **API Endpoint Tests** - All REST endpoints functional
4. **LLM Stress Tests** - Provider failover, circuit breakers, cost tracking
5. **TTS/STT Tests** - Multi-provider fallback, audio quality
6. **Pipeline Integration** - End-to-end voice pipeline
7. **Concurrent Load** - Multiple simultaneous calls
8. **Error Handling** - Graceful degradation under failure
9. **Memory/Resource** - No leaks, proper cleanup
10. **Telnyx Integration** - Webhook handling, call control

---

## Final Configuration Notes (Must-Have)

- **Telnyx only:** Twilio is fully removed; all telephony tests should use `telnyx`.
- **Daily transport optional:** If `daily-python` isn't available on Windows, Daily tests are skipped.
- **Anthropic credits required:** LLM adversarial stress tests fail if Anthropic credits are exhausted.
- **Tenant required for call load tests:** Concurrent call tests need a valid tenant with routing; otherwise the webhook returns "This number is not configured."
- **Ngrok vs Production:** Tests in dev use ngrok URL; production must point to your domain.
- **TODO:** Optimize agent response latency to <3 seconds for first response, <2 seconds for turn-taking.
- **TODO:** Optimize agent response latency to <3 seconds for first response, <2 seconds for turn-taking.
- **TODO:** Optimize agent response latency to <3 seconds for first response, <2 seconds for turn-taking.
- **TODO:** Optimize agent response latency to <3 seconds for first response, <2 seconds for turn-taking.
- **TODO:** Optimize agent response latency to <3 seconds for first response, <2 seconds for turn-taking.
- **TODO:** Optimize agent response latency to <3 seconds for first response, <2 seconds for turn-taking.

---

## Phase 1: Environment Setup (Automated)

### 1.1 Install Dependencies
```bash
pip install -r voice-core/requirements.txt
```

### 1.2 Verify Critical Imports
- Pipecat with Telnyx support
- All AI provider SDKs (OpenAI, Anthropic, Deepgram, Cartesia, ElevenLabs)
- Database drivers
- FastAPI + dependencies

### 1.3 Database Connection Test
- Get connection from pool
- Execute test query
- Return connection
- Verify no leaks

### 1.4 Environment Variables Check
- All required API keys present
- Database URL valid
- Telnyx credentials configured

---

## Phase 2: Database Stress Tests

### 2.1 Connection Pool Test
**Script:** `voice-core/tests/db_connection_test.py`
- Rapidly acquire 50 connections
- Hold for random duration
- Release all
- Verify pool recovers
- Check for connection leaks

### 2.2 Migration Verification
- All 12 migrations applied
- Tables exist with correct schema
- Indexes created
- Foreign keys enforced

### 2.3 Write Performance
- Insert 1000 call logs rapidly
- Insert 500 system errors
- Verify no deadlocks
- Check response times

---

## Phase 3: API Endpoint Tests

### 3.1 Health Check
```bash
GET /health
Expected: 200 {"status":"ok"}
```

### 3.2 Authentication Flow
- Create test session
- Verify session token
- Test auth middleware
- Session expiry
- Session cleanup

### 3.3 Telnyx Webhook
```bash
POST /api/telnyx/webhook
Payload: call.initiated event
Expected: JSON command response
```

---

## Phase 4: LLM Provider Stress Tests

### 4.1 Single Provider Test
**Script:** Create `test_llm_providers.py`
- OpenAI GPT-4o: 50 requests
- Gemini 2.5 Flash: 50 requests
- Verify responses
- Check latency
- Track costs

### 4.2 Fallback Test
- Simulate OpenAI failure
- Verify Gemini takes over
- No errors to user
- Circuit breaker activates

### 4.3 All Providers Failed
- Simulate all LLM failures
- Verify fallback message
- Verify Telnyx transfer called
- Error logged to system_errors

### 4.4 Anthropic Stress Test
**Script:** `voice-core/tests/run_stress_test_direct.py`
- Run 10 adversarial conversations
- Verify Claude handles edge cases
- Check for prompt injection resistance
- Verify structured outputs

---

## Phase 5: TTS/STT Provider Tests

### 5.1 TTS Multi-Provider
- Cartesia: 100 requests (primary)
- ElevenLabs: 50 requests (fallback)
- Verify audio quality
- Check latency
- Track costs

### 5.2 TTS Failover
- Simulate Cartesia failure
- Verify ElevenLabs takes over
- Circuit breaker recovery
- No audio gaps

### 5.3 STT Accuracy
- Deepgram: Process 50 audio samples
- Verify transcription accuracy
- Check latency
- Australian accent handling

---

## Phase 6: Voice Pipeline Integration

### 6.1 Pipeline Component Test
**Script:** Create `test_voice_pipeline.py`
- Initialize all components
- STT → LLM → TTS flow
- Verify frame processing
- Check memory usage
- No frame drops

### 6.2 VAD + Smart Turn V3
- 16kHz audio input
- Silero VAD detection
- Smart Turn classification
- 250ms threshold
- No false triggers

### 6.3 Error Handler Integration
- Simulate pipeline failure
- Verify PipelineErrorHandler called
- Fallback message generated
- TelnyxFallbackService activated

---

## Phase 7: Concurrent Load Tests

### 7.1 Concurrent Calls
**Script:** `voice-core/tests/load_test_concurrent_calls.py`
- Simulate 10 simultaneous calls
- Each call runs 30 seconds
- Monitor CPU/memory
- Check for race conditions
- Verify all complete successfully

### 7.2 Database Under Load
- All 10 calls write logs
- Concurrent read/write operations
- No deadlocks
- Connection pool stable

### 7.3 API Rate Limiting
- Send 200 requests/minute
- Verify rate limit activated
- Check 429 responses
- Verify system stability

---

## Phase 8: Error Scenario Tests

### 8.1 Database Failure
- Simulate DB connection loss
- Verify graceful degradation
- Error logged to Sentry (if configured)
- No crashes

### 8.2 API Key Invalid
- Test with invalid OpenAI key
- Verify fallback to Gemini
- User receives response
- Error logged

### 8.3 Network Timeout
- Simulate provider timeout
- Verify circuit breaker
- Fallback activated
- User experience maintained

### 8.4 Memory Exhaustion
- Run long-duration calls
- Monitor memory growth
- Verify cleanup on call end
- No memory leaks

---

## Phase 9: Telnyx Integration Tests

### 9.1 Webhook Validation
- Send call.initiated event
- Verify JSON response
- Stream URL correct
- Call answered

### 9.2 Call Control API
- Test speak command
- Test transfer command
- Test hangup command
- Verify all work

### 9.3 Fallback Service
- Trigger LLM failure
- Verify TelnyxFallbackService called
- Message played
- Transfer executed (to test number)

---

## Phase 10: Resource Monitoring

### 10.1 Memory Profiling
- Monitor baseline memory
- Run 20 calls
- Check for leaks
- Verify cleanup

### 10.2 CPU Usage
- Baseline CPU
- Under load CPU
- Smart Turn inference time
- VAD processing time

### 10.3 Database Connections
- Monitor pool usage
- Check for leaked connections
- Verify min/max respected
- Connection timeouts

---

## Automated Test Execution Order

```bash
# Phase 1: Setup
1. pip install -r requirements.txt
2. python test_imports.py
3. python check_db_tables.py
4. python verify_env_vars.py

# Phase 2: Database
5. python tests/db_connection_test.py

# Phase 3: API
6. Start backend: uvicorn src.bot_runner:app --host 0.0.0.0 --port 8000 &
7. curl http://localhost:8000/health
8. python test_api_endpoints.py

# Phase 4: LLM
9. python test_llm_providers.py
10. python tests/run_stress_test_direct.py

# Phase 5: TTS/STT
11. python test_tts_providers.py
12. python test_stt_deepgram.py

# Phase 6: Pipeline
13. python test_voice_pipeline.py

# Phase 7: Load
14. python tests/load_test_concurrent_calls.py

# Phase 8: Errors
15. python test_error_scenarios.py

# Phase 9: Telnyx
16. python test_telnyx_webhook.py

# Phase 10: Resources
17. python monitor_resources.py
```

---

## Success Criteria

### Must Pass (Critical)
- ✅ All dependencies installed
- ✅ Database migrations applied
- ✅ All API endpoints return 200
- ✅ LLM providers respond within 5s
- ✅ TTS/STT work correctly
- ✅ 10 concurrent calls complete successfully
- ✅ No memory leaks detected
- ✅ Error fallback works
- ✅ Telnyx webhook responds correctly

### Nice to Have (Non-Blocking)
- Response times < 2s average
- Zero errors in 100-call test
- CPU usage < 80% under load
- Memory stable after 1 hour

---

## Test Artifacts

All test results saved to:
- `test-results/test_summary.json` - Overall pass/fail
- `test-results/llm_results.json` - LLM stress test data
- `test-results/load_test.log` - Concurrent call logs
- `test-results/memory_profile.txt` - Memory analysis
- `test-results/errors.log` - All errors encountered

---

## Execution

Run full automated test suite:
```bash
cd voice-core
python run_full_stress_test.py
```

This will execute all tests and generate a comprehensive report.

---

**Ready to execute automated stress tests!** 🚀
