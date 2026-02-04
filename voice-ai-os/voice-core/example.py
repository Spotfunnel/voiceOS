"""
Example usage of Voice Core pipeline

This demonstrates how to initialize and use the Voice Core pipeline.
In production, this would be controlled by Layer 2 (Orchestration).
"""

import asyncio
import os
from dotenv import load_dotenv
from voice_core import VoicePipeline


async def main():
    """Example: Start voice pipeline"""
    # Load environment variables
    load_dotenv()
    
    # Check required environment variables
    required_vars = [
        "DAILY_ROOM_URL",
        "DAILY_TOKEN",
        "DEEPGRAM_API_KEY",
        "OPENAI_API_KEY",
        "ELEVENLABS_API_KEY",
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"ERROR: Missing required environment variables: {', '.join(missing_vars)}")
        print("\nPlease create a .env file with:")
        for var in required_vars:
            print(f"{var}=your_{var.lower()}")
        return
    
    # Initialize pipeline
    pipeline = VoicePipeline(
        daily_room_url=os.getenv("DAILY_ROOM_URL"),
        daily_token=os.getenv("DAILY_TOKEN"),
    )
    
    print("Voice Core pipeline initialized")
    print("Starting pipeline...")
    print("(In production, this would be managed by Layer 2 - Orchestration)")
    
    # Start pipeline
    # Note: In production, Layer 2 would control when to start/stop
    try:
        await pipeline.start()
    except KeyboardInterrupt:
        print("\nStopping pipeline...")
        await pipeline.stop()
        print("Pipeline stopped")


if __name__ == "__main__":
    asyncio.run(main())
