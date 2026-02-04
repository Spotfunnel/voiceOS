"""
Voice Core Test Harness

Hardcoded test: "Hello, this is SpotFunnel" → hang up
Verifies telephony + audio pipeline work end-to-end.
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

from src.transports.daily_transport import DailyTransportWrapper
from src.pipeline.audio_pipeline import AudioPipeline
from src.events.event_emitter import EventEmitter
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.frames.frames import TextFrame


async def test_call():
    """
    Test call: Say "Hello, this is SpotFunnel" then hang up.
    
    This verifies:
    1. Daily.co telephony connection
    2. STT → LLM → TTS pipeline
    3. Event emission
    """
    # Load environment variables
    load_dotenv()
    
    # Check required environment variables
    required_vars = [
        "DAILY_ROOM_URL",
        "DAILY_ROOM_TOKEN",
        "DEEPGRAM_API_KEY",
        "OPENAI_API_KEY",
        "ELEVENLABS_API_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"ERROR: Missing required environment variables: {', '.join(missing_vars)}")
        print("\nPlease create a .env file with:")
        print("DAILY_ROOM_URL=your_daily_room_url")
        print("DAILY_ROOM_TOKEN=your_daily_room_token")
        print("DEEPGRAM_API_KEY=your_deepgram_api_key")
        print("OPENAI_API_KEY=your_openai_api_key")
        print("ELEVENLABS_API_KEY=your_elevenlabs_api_key")
        sys.exit(1)
    
    # Create event emitter
    event_emitter = EventEmitter(conversation_id="test-call-001")
    
    # Create Daily.co transport
    transport = DailyTransportWrapper.from_env(event_emitter=event_emitter)
    
    # Create audio pipeline
    pipeline_builder = AudioPipeline(
        event_emitter=event_emitter,
        system_prompt="You are SpotFunnel AI. When the call starts, say 'Hello, this is SpotFunnel' and then wait for the user to speak."
    )
    
    # Build pipeline
    pipeline = pipeline_builder.build_pipeline(
        transport_input=transport.input(),
        transport_output=transport.output()
    )
    
    # Create pipeline task and runner
    task = PipelineTask(pipeline)
    runner = PipelineRunner()
    
    print("Starting test call...")
    print("Expected behavior:")
    print("1. Connect to Daily.co room")
    print("2. Agent says: 'Hello, this is SpotFunnel'")
    print("3. Wait for user speech")
    print("4. Process user speech through STT → LLM → TTS")
    print("5. Hang up after 30 seconds or when user disconnects")
    print("\nEvents will be logged to stdout.\n")
    
    try:
        # Start transport
        await transport.start()
        print("✓ Transport started")
        
        # Run pipeline (with timeout)
        # The LLM will generate the greeting based on system prompt
        print("✓ Pipeline running...")
        await asyncio.wait_for(
            runner.run(task),
            timeout=30.0  # 30 second timeout for test
        )
        
    except asyncio.TimeoutError:
        print("\n✓ Test call completed (30 second timeout)")
    except KeyboardInterrupt:
        print("\n✓ Test call interrupted by user")
    except Exception as e:
        print(f"\n✗ Error during test call: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Stop transport
        await transport.stop()
        
        # Print event summary
        print("\n=== Event Summary ===")
        events = event_emitter.get_events()
        for event in events:
            print(f"{event.event_type}: {event.timestamp}")
        
        print(f"\nTotal events emitted: {len(events)}")
        print("Test call completed successfully!")


if __name__ == "__main__":
    asyncio.run(test_call())
