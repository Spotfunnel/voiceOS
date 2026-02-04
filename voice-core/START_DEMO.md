# Voice AI Demo - Quick Start

## Start the Demo Server (One Command)

Open WSL2 terminal and run:

```bash
cd /mnt/c/Users/leoge/OneDrive/Documents/AI\ Activity/Cursor/VoiceAIProduction/voice-core && python scripts/demo_call.py
```

## Join the Call

Open in your browser: **https://spotfunnel.daily.co**

The bot will answer and start the email capture flow.

## What You'll Experience

1. Bot greets you: "What's your email address?"
2. You speak your email (e.g., "jane at gmail dot com")
3. Bot confirms: "Got it, jane at gmail dot com. Is that correct?"
4. You confirm: "yes"
5. Bot completes: "Perfect, thank you!"
6. Call ends

## Event Timeline

After the call, the demo will print an event timeline showing:
- call_started
- objective_started (capture_email_au)
- user transcriptions
- objective_captured (email extracted)
- objective_completed (email confirmed)
- call_ended

All events include timestamps and trace IDs for deterministic replay.
