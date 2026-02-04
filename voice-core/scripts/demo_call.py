"""
End-to-End Demo: Answer Phone → Capture Email → Save to Database → Hang Up

DAY 2 DELIVERABLE: Complete demo script with:
- Real audio pipeline (not mocked)
- Real database writes
- Events persisted to PostgreSQL
- Trace ID throughout call

Usage:
    python scripts/demo_call.py

Environment Variables Required:
    DAILY_ROOM_URL: Daily.co room URL
    DAILY_ROOM_TOKEN: Daily.co room token
    DEEPGRAM_API_KEY: Deepgram API key for STT
    OPENAI_API_KEY: OpenAI API key for LLM
    ELEVENLABS_API_KEY: ElevenLabs API key for TTS
    DATABASE_URL: PostgreSQL connection string (optional, defaults to localhost)
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.transports.daily_transport import DailyTransportWrapper
from src.pipeline.email_capture_pipeline import EmailCapturePipeline
from src.events.event_emitter import EventEmitter
from src.database.db_service import get_db_service
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask


async def demo_call():
    """
    Execute end-to-end demo call.
    
    Flow:
    1. Answer incoming call (Daily.co room)
    2. Load tenant config (capture_email objective)
    3. Execute conversation (capture email)
    4. Save result to PostgreSQL
    5. Output event log
    """
    # Load environment variables
    load_dotenv()
    
    # Check required environment variables (DAILY_ROOM_TOKEN is optional for public rooms)
    required_vars = [
        "DAILY_ROOM_URL",
        "DEEPGRAM_API_KEY",
        "OPENAI_API_KEY",
        "CARTESIA_API_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"❌ ERROR: Missing required environment variables: {', '.join(missing_vars)}")
        print("\nPlease create a .env file with:")
        for var in required_vars:
            print(f"  {var}=your_{var.lower()}")
        print("  DAILY_ROOM_TOKEN=your_daily_room_token (optional for public rooms)")
        sys.exit(1)
    
    # Generate trace ID for correlation
    trace_id = str(uuid.uuid4())
    conversation_id = str(uuid.uuid4())
    tenant_id = "demo-tenant"
    
    print("=" * 80)
    print("VOICE AI DEMO: Email Capture")
    print("=" * 80)
    print(f"Trace ID: {trace_id}")
    print(f"Conversation ID: {conversation_id}")
    print(f"Tenant ID: {tenant_id}")
    print()
    
    # Initialize database service
    db_service = None
    try:
        db_service = get_db_service()
        print("✓ Database service initialized")
    except Exception as e:
        print(f"⚠️  Warning: Database connection failed: {e}")
        print("   Continuing without database persistence...")
        print("   Set DATABASE_URL environment variable to enable database writes.")
        print()
    
    # Create event emitter
    event_emitter = EventEmitter(conversation_id=conversation_id)
    
    # Add database observer for events
    if db_service:
        async def save_event_to_db(event):
            """Observer to save events to database"""
            await db_service.save_event(
                trace_id=trace_id,
                tenant_id=tenant_id,
                event_type=event.event_type,
                payload=event.data or {},
                conversation_id=conversation_id
            )
        
        event_emitter.add_observer(save_event_to_db)
        print("✓ Event persistence enabled")
    
    # Create Daily.co transport
    print("\n📞 Connecting to Daily.co room...")
    transport = DailyTransportWrapper.from_env(event_emitter=event_emitter)
    
    # Create email capture pipeline (STT → Email Capture → TTS)
    pipeline_builder = EmailCapturePipeline(
        event_emitter=event_emitter,
        trace_id=trace_id,
        locale="en-AU",
    )
    pipeline = pipeline_builder.build_pipeline(
        transport_input=transport.input(),
        transport_output=transport.output(),
    )
    
    # Create pipeline task and runner
    task = PipelineTask(pipeline)
    runner = PipelineRunner()
    
    print("✓ Pipeline configured")
    print()
    print("Expected conversation flow:")
    print("  1. Agent: 'What's your email address?'")
    print("  2. User: 'jane at gmail dot com'")
    print("  3. Agent: 'Got it, jane at gmail dot com. Is that correct?'")
    print("  4. User: 'Yes'")
    print("  5. Agent: 'Perfect, thank you!'")
    print("  6. Email saved to database")
    print()
    print("Starting call... (Press Ctrl+C to stop)")
    print("-" * 80)
    
    try:
        # Start transport
        await transport.start()
        print("✓ Transport started")
        
        # Emit call started event
        await event_emitter.emit(
            "call_started",
            data={
                "room_url": transport.room_url,
                "trace_id": trace_id,
                "conversation_id": conversation_id
            },
            metadata={"component": "demo_call"}
        )
        
        # Run pipeline (with timeout for demo)
        print("✓ Pipeline running...")
        print()
        
        # Send initial greeting to activate audio and welcome the user
        from pipecat.frames.frames import TextFrame
        greeting = TextFrame("Hello! I'm the SpotFunnel AI receptionist. How can I help you today?")
        await task.queue_frame(greeting)
        
        # Run for up to 2 minutes (enough time for email capture)
        await asyncio.wait_for(
            runner.run(task),
            timeout=120.0
        )
        
    except asyncio.TimeoutError:
        print("\n⏱️  Call timeout (2 minutes)")
    except KeyboardInterrupt:
        print("\n\n⚠️  Call interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during call: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Stop transport
        print("\n📴 Stopping transport...")
        await transport.stop()
        
        # Get captured email
        captured_email = pipeline_builder.get_captured_email()
        
        # Save objective to database if email was captured
        if captured_email and db_service:
            print("\n💾 Saving captured email to database...")
            objective_id = await db_service.save_objective(
                conversation_id=conversation_id,
                objective_type="capture_email_au",
                captured_data={"email": captured_email},
                trace_id=trace_id,
                tenant_id=tenant_id,
                state="COMPLETED"
            )
            
            if objective_id:
                print(f"✓ Email saved to database (objective_id: {objective_id})")
            else:
                print("⚠️  Failed to save email to database")
        
        # Emit call ended event
        await event_emitter.emit(
            "call_ended",
            data={
                "trace_id": trace_id,
                "conversation_id": conversation_id,
                "captured_email": captured_email
            },
            metadata={"component": "demo_call"}
        )
        
        # Print event summary
        print("\n" + "=" * 80)
        print("EVENT SUMMARY")
        print("=" * 80)
        events = event_emitter.get_events()
        for i, event in enumerate(events, 1):
            print(f"{i}. {event.event_type} ({event.timestamp})")
            if event.data:
                print(f"   Data: {event.data}")
        
        print(f"\nTotal events: {len(events)}")
        print("\n" + "=" * 80)
        print("📊 EVENT TIMELINE VIEWER")
        print("=" * 80)
        print("To visualize this timeline:")
        print("1. Copy the EVENT SUMMARY section above")
        print("2. Open: voice-core/scripts/event_timeline_viewer.html in your browser")
        print("3. Paste the output into the viewer")
        print("=" * 80)
        
        if captured_email:
            print(f"\n✅ SUCCESS: Email captured: {captured_email}")
        else:
            print("\n⚠️  Email not captured (call may have ended early)")
        
        # Close database connection
        if db_service:
            db_service.close()
        
        print("\n" + "=" * 80)
        print("Demo completed!")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(demo_call())
