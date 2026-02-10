"""
Bot Runner - Telnyx Edition

Simple HTTP server to handle Telnyx voice calls.

Endpoints:
- POST /api/telnyx/webhook: Receive Telnyx call events
- WebSocket /ws/media-stream/{call_control_id}: Handle audio streaming
- GET /health: Health check

Usage:
    python bot_runner_telnyx.py
"""

import os
import asyncio
import base64
import json
import logging
from typing import Dict, Optional
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from pipecat.pipeline.task import PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.frames.frames import StartFrame, EndFrame, TextFrame, InputAudioRawFrame, AudioRawFrame
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from pipecat.audio.utils import create_stream_resampler

from minimal_pipeline import create_pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Minimal Voice AI - Telnyx", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active calls
active_calls: Dict[str, PipelineTask] = {}

# Store call contexts (for webhook → websocket handoff)
call_contexts: Dict[str, dict] = {}


class TelnyxAudioInputProcessor(FrameProcessor):
    """Receives audio from Telnyx WebSocket"""
    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)


class TelnyxAudioOutputProcessor(FrameProcessor):
    """Sends audio to Telnyx WebSocket"""
    def __init__(self, queue: asyncio.Queue, sample_rate: int = 16000):
        super().__init__()
        self._queue = queue
        self._sample_rate = sample_rate

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, AudioRawFrame):
            # Put audio in queue to be sent via WebSocket
            await self._queue.put(frame.audio)
            return
        await self.push_frame(frame, direction)


async def handle_call_control(call_control_id: str, from_number: str, to_number: str):
    """
    Asynchronously handle call control commands.
    This runs AFTER the webhook returns 200 OK.
    """
    import httpx
    
    api_key = os.getenv("TELNYX_API_KEY")
    base_url = "https://api.telnyx.com/v2/calls"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    try:
        # Answer call
        logger.info(f"Answering call {call_control_id}")
        
        async with httpx.AsyncClient() as client:
            # Answer the call
            answer_response = await client.post(
                f"{base_url}/{call_control_id}/actions/answer",
                headers=headers,
                json={},
            )
            
            if answer_response.status_code == 200:
                logger.info(f"Answered call {call_control_id}")
            else:
                logger.error(f"Failed to answer call: {answer_response.status_code} {answer_response.text}")
                return
            
            # Wait a moment for call to be established
            await asyncio.sleep(0.5)
            
            # Start streaming
            ngrok_url = os.getenv("NGROK_URL", "").replace("https://", "wss://").replace("http://", "ws://")
            ws_url = f"{ngrok_url}/ws/media-stream/{call_control_id}"
            
            logger.info(f"Starting media stream for {call_control_id}: {ws_url}")
            
            stream_response = await client.post(
                f"{base_url}/{call_control_id}/actions/streaming_start",
                headers=headers,
                json={
                    "stream_url": ws_url,
                    "stream_track": "both_tracks",
                },
            )
            
            if stream_response.status_code == 200:
                logger.info(f"Started media stream for {call_control_id}")
            else:
                logger.error(f"Failed to start stream: {stream_response.status_code} {stream_response.text}")
                return
        
        # Store call context
        call_contexts[call_control_id] = {
            "from": from_number,
            "to": to_number,
            "started_at": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Failed to handle call control for {call_control_id}: {e}")


@app.post("/api/telnyx/webhook")
async def telnyx_webhook(request: Request):
    """
    Telnyx webhook endpoint.
    
    CRITICAL: Must return 200 OK immediately.
    Call Control commands happen asynchronously AFTER returning.
    
    Receives call events from Telnyx:
    - call.initiated: Incoming call started
    - call.answered: Call answered
    - call.hangup: Call ended
    """
    try:
        event = await request.json()
        
        event_type = event.get("data", {}).get("event_type")
        payload = event.get("data", {}).get("payload", {})
        
        call_control_id = payload.get("call_control_id")
        
        logger.info(f"Telnyx webhook: {event_type} for call {call_control_id}")
        
        if event_type == "call.initiated":
            # Incoming call
            from_number = payload.get("from")
            to_number = payload.get("to")
            
            logger.info(f"Incoming call from {from_number} to {to_number}")
            
            # Handle call control asynchronously (AFTER returning 200 OK)
            asyncio.create_task(handle_call_control(call_control_id, from_number, to_number))
        
        elif event_type == "call.hangup":
            # Call ended
            logger.info(f"Call hangup: {call_control_id}")
            call_contexts.pop(call_control_id, None)
            active_calls.pop(call_control_id, None)
        
        # Return immediately (CRITICAL for Call Control)
        return JSONResponse({"status": "ok"})
        
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return JSONResponse({"status": "error", "message": str(e)})


@app.websocket("/ws/media-stream/{call_control_id}")
async def telnyx_media_stream(websocket: WebSocket, call_control_id: str):
    """
    Telnyx media stream WebSocket endpoint.
    
    Receives audio from Telnyx and sends TTS audio back.
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for call {call_control_id}")
    
    # Get call context
    context = call_contexts.get(call_control_id, {})
    
    # Audio queue for outbound audio
    audio_out_queue: asyncio.Queue[bytes] = asyncio.Queue()
    
    # Create transport processors
    transport_input = TelnyxAudioInputProcessor()
    transport_output = TelnyxAudioOutputProcessor(queue=audio_out_queue, sample_rate=16000)
    
    # Create pipeline
    pipeline = create_pipeline(
        transport_input=transport_input,
        transport_output=transport_output,
    )
    
    # Create task and runner
    task = PipelineTask(pipeline)
    runner = PipelineRunner(handle_sigint=False)
    
    # Store active call
    active_calls[call_control_id] = task
    
    # Audio format tracking
    encoding = "LINEAR16"
    sample_rate = 16000
    
    async def send_outbound_audio():
        """Send TTS audio back to Telnyx"""
        while True:
            try:
                audio_bytes = await audio_out_queue.get()
                
                # Encode to base64
                payload = base64.b64encode(audio_bytes).decode("ascii")
                
                # Send to Telnyx
                await websocket.send_text(json.dumps({
                    "event": "media",
                    "media": {
                        "payload": payload
                    }
                }))
                
            except WebSocketDisconnect:
                logger.info(f"WebSocket send disconnected for {call_control_id}")
                break
            except Exception as e:
                logger.error(f"WebSocket send error: {e}")
                break
    
    async def receive_inbound_audio():
        """Receive audio from Telnyx"""
        nonlocal encoding, sample_rate
        
        while True:
            try:
                raw_message = await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for {call_control_id}")
                break
            except Exception as e:
                logger.error(f"WebSocket receive error: {e}")
                break
            
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON: {raw_message}")
                continue
            
            event = message.get("event")
            
            if event == "start":
                # Stream started
                media_format = message.get("start", {}).get("media_format", {})
                encoding = media_format.get("encoding", "LINEAR16")
                sample_rate = int(media_format.get("sample_rate", 16000))
                
                logger.info(f"Stream started: encoding={encoding}, sample_rate={sample_rate}")
                continue
            
            elif event == "media":
                # Audio data
                media = message.get("media", {})
                
                # Skip outbound track (our own audio)
                if media.get("track") == "outbound":
                    continue
                
                payload = media.get("payload")
                if not payload:
                    continue
                
                try:
                    # Decode audio
                    audio_bytes = base64.b64decode(payload)
                    
                    # Send to pipeline (LINEAR16 16kHz is perfect for Deepgram)
                    await task.queue_frame(
                        InputAudioRawFrame(
                            audio=audio_bytes,
                            sample_rate=sample_rate,
                            num_channels=1,
                        )
                    )
                    
                except Exception as e:
                    logger.error(f"Audio decode error: {e}")
                    continue
            
            elif event == "stop":
                logger.info(f"Stream stopped for {call_control_id}")
                break
    
    # Run pipeline
    async def run_pipeline():
        try:
            logger.info(f"Starting pipeline for {call_control_id}")
            await runner.run(task)
            logger.info(f"Pipeline finished for {call_control_id}")
        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            raise
    
    # Start all tasks
    pipeline_task = asyncio.create_task(run_pipeline())
    sender_task = asyncio.create_task(send_outbound_audio())
    receiver_task = asyncio.create_task(receive_inbound_audio())
    
    # Wait for pipeline to initialize
    await asyncio.sleep(0.1)
    
    # Send StartFrame
    await task.queue_frame(
        StartFrame(
            allow_interruptions=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=16000,
        )
    )
    
    # Send initial greeting
    await task.queue_frame(
        TextFrame("Hi! This is SpotFunnel. How can I help you today?")
    )
    
    try:
        # Wait for receiver to finish (call ends)
        await receiver_task
    finally:
        # Clean up
        await task.queue_frame(EndFrame())
        try:
            await pipeline_task
        finally:
            sender_task.cancel()
            active_calls.pop(call_control_id, None)
            logger.info(f"Cleaned up call {call_control_id}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return JSONResponse({
        "status": "healthy",
        "active_calls": len(active_calls),
        "call_ids": list(active_calls.keys()),
    })


@app.get("/")
async def root():
    """Root endpoint"""
    return JSONResponse({
        "service": "Minimal Voice AI - Telnyx",
        "version": "1.0.0",
        "endpoints": {
            "telnyx_webhook": "POST /api/telnyx/webhook",
            "health": "GET /health",
        },
        "phone": os.getenv("TELNYX_PHONE_NUMBER", "+61240675354"),
        "docs": "/docs",
    })


if __name__ == "__main__":
    import uvicorn
    
    # Get configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    # Validate environment
    required_vars = [
        "DEEPGRAM_API_KEY",
        "GOOGLE_API_KEY",
        "CARTESIA_API_KEY",
        "TELNYX_API_KEY",
        "NGROK_URL",
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing environment variables: {', '.join(missing_vars)}")
        exit(1)
    
    logger.info("=" * 60)
    logger.info("Minimal Voice AI - Telnyx Edition")
    logger.info("=" * 60)
    logger.info(f"Server: {host}:{port}")
    logger.info(f"Webhook: {os.getenv('NGROK_URL')}/api/telnyx/webhook")
    logger.info(f"Phone: {os.getenv('TELNYX_PHONE_NUMBER', '+61240675354')}")
    logger.info("=" * 60)
    
    # Run server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )
