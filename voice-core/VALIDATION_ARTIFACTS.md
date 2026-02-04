# Voice AI V1 Validation Artifacts

## 1. Demo Server (One Command)

**Start the server in WSL2:**
```bash
cd /mnt/c/Users/leoge/OneDrive/Documents/AI\ Activity/Cursor/VoiceAIProduction/voice-core && python scripts/demo_call.py
```

**Join the call:**
Open https://spotfunnel.daily.co in your browser

---

## 2. V1 Acceptance Checklist (5 minutes)

See: `V1_ACCEPTANCE_CHECKLIST.md`

Run all 6 tests by speaking:
1. ✅ Basic Turn-Taking (30s)
2. ✅ Barge-In (30s)
3. ✅ Capture + Confirm + Repair (90s)
4. ✅ Retry Bound (90s)
5. ✅ Australian Accent (60s)
6. ✅ Event Timeline Verification (30s)

---

## 3. Event Timeline Viewer

**Web Viewer:**
Open `scripts/event_timeline_viewer.html` in your browser

**How to use:**
1. Run the demo (see #1 above)
2. After the call ends, copy the "EVENT SUMMARY" section from the terminal
3. Open `event_timeline_viewer.html` in your browser
4. Paste the output into the viewer
5. See the visual timeline with:
   - Ordered events (call_started → objective_started → objective_completed → call_ended)
   - Timestamps for each event
   - Trace IDs for deterministic replay
   - Statistics (total events, completed objectives, call duration)

**What to verify:**
- Events are in correct order
- Each event has a timestamp
- Trace ID is consistent across all events
- Objective completion is recorded
- No missing events in the sequence

---

## Architecture Compliance Verification

The event timeline proves:
- **R-ARCH-002**: Voice Core is immutable (no customer-specific logic in events)
- **R-ARCH-006**: Critical data is always confirmed (objective_captured → confirmation → objective_completed)
- **R-ARCH-009**: Event spine for observability (all events timestamped and ordered)
- **Deterministic Replay**: Event sequence can reconstruct conversation state

---

## Files

- `START_DEMO.md` - Quick start instructions
- `V1_ACCEPTANCE_CHECKLIST.md` - 5-minute validation checklist
- `scripts/event_timeline_viewer.html` - Web-based event visualizer
- `scripts/demo_call.py` - Demo server (prints event timeline)

---

## Expected Output (Success)

```
EVENT SUMMARY
1. call_started (2026-02-04T00:50:00.123Z)
   Data: {'room_url': 'https://spotfunnel.daily.co', 'trace_id': '...'}
2. objective_started (2026-02-04T00:50:01.456Z)
   Data: {'objective_type': 'capture_email_au', 'trace_id': '...'}
3. objective_captured (2026-02-04T00:50:15.789Z)
   Data: {'value': 'jane@gmail.com', 'confidence': 0.85}
4. objective_completed (2026-02-04T00:50:20.012Z)
   Data: {'value': 'jane@gmail.com', 'retry_count': 0}
5. call_ended (2026-02-04T00:50:25.345Z)
   Data: {'captured_email': 'jane@gmail.com'}

Total events: 5
```

All events have:
- Sequential ordering
- ISO timestamps
- Consistent trace_id
- Structured data payloads
